import { randomBytes } from "node:crypto";
import type { AppSyncIdentityCognito } from "aws-lambda";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/send-employee-invite-email";
import type { Schema } from "../../../data/resource";
import { INVITE_TTL_MS, hashToken, isInviteRole, normaliseEmail } from "../shared";

// Built on first invoke, not at import time: see the note in
// amplify/auth/post-confirmation/handler.ts.
let dbPromise: Promise<ReturnType<typeof generateClient<Schema>>> | undefined;

const getDb = () => {
  dbPromise ??= (async () => {
    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
    Amplify.configure(resourceConfig, libraryOptions);
    return generateClient<Schema>();
  })();
  return dbPromise;
};

type Db = ReturnType<typeof generateClient<Schema>>;

// The SDK already retries throttling and 5xx errors (3 attempts), so there's
// no retry loop here: retrying a rejected message won't change the answer.
const ses = new SESv2Client({});
const FROM = "jkanbour1@gmail.com";

/**
 * The caller's active org, provided they're an Admin of it. Users made before
 * Memberships existed have none, so their User.role stands in.
 */
async function requireAdminOrg(db: Db, identity: AppSyncIdentityCognito | null) {
  if (!identity?.sub || !identity.username) throw new Error("Unauthorized");

  const { data: users } = await db.models.User.listUserByProfileOwner({
    profileOwner: `${identity.sub}::${identity.username}`,
  });
  const me = users[0];
  if (!me?.orgId) throw new Error("You're not part of an organisation.");

  const { data: memberships } = await me.memberships();
  const membership = memberships.find((m) => m.orgId === me.orgId);
  const isAdmin = membership ? membership.role === "admin" : me.role === "Admin";
  if (!isAdmin) throw new Error("Only admins can invite employees.");

  const { data: org } = await db.models.Organisation.get({ id: me.orgId });
  if (!org) throw new Error("Organisation not found.");
  return { me, org };
}

async function isAlreadyMember(db: Db, email: string, orgId: string) {
  const { data: users } = await db.models.User.listUserByEmail({ email });
  for (const user of users) {
    if (user.orgId === orgId) return true;
    const { data: memberships } = await user.memberships();
    if (memberships.some((m) => m.orgId === orgId)) return true;
  }
  return false;
}

/** A new invite replaces any earlier pending one for the same person and org. */
async function revokePendingInvites(db: Db, email: string, orgId: string) {
  const { data: invites } = await db.models.EmployeeInvite.listEmployeeInviteByEmail({ email });
  await Promise.all(
    invites
      .filter((i) => i.orgId === orgId && i.status === "pending")
      .map((i) => db.models.EmployeeInvite.update({ id: i.id, status: "revoked" }))
  );
}

export const handler: Schema["sendEmployeeInviteEmail"]["functionHandler"] = async (event) => {
  const db = await getDb();
  const { me, org } = await requireAdminOrg(db, event.identity as AppSyncIdentityCognito | null);

  const email = normaliseEmail(event.arguments.email);
  const name = event.arguments.name.trim();
  const { role, phone, startDate, message, logoUrl } = event.arguments;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (!name) throw new Error("Full name is required.");
  if (!isInviteRole(role)) throw new Error("Role must be Admin or Tutor.");

  if (await isAlreadyMember(db, email, org.id)) {
    throw new Error(`${email} is already a member of ${org.name}.`);
  }
  await revokePendingInvites(db, email, org.id);

  // Record the invite before emailing, so every link sent has an invite to match
  const inviteToken = randomBytes(32).toString("base64url");
  const { data: invite, errors } = await db.models.EmployeeInvite.create({
    email,
    name,
    phone: phone?.trim() || null,
    role,
    startDate: startDate || null,
    orgId: org.id,
    orgName: org.name,
    inviteTokenHash: hashToken(inviteToken),
    status: "pending",
    invitedBy: me.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  });
  if (errors?.length || !invite) {
    console.error(errors);
    throw new Error("Failed to create invite");
  }

  const content = {
    inviteeName: name,
    orgName: org.name,
    role,
    inviteLink: generateInviteLink(inviteToken),
    logoUrl,
    message,
  };

  let messageId: string | undefined;
  try {
    const res = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: FROM,
        Destination: { ToAddresses: [email] },
        Content: {
          Simple: {
            Subject: { Data: `You've been invited to join ${org.name}`, Charset: "UTF-8" },
            Body: {
              Text: { Data: buildTextEmail(content), Charset: "UTF-8" },
              Html: { Data: buildHtmlEmail(content), Charset: "UTF-8" },
            },
          },
        },
      })
    );
    messageId = res.MessageId;
  } catch (err) {
    console.error(err);
    // Kept as 'failed' rather than deleted, so there's a record to resend from
    await db.models.EmployeeInvite.update({ id: invite.id, status: "failed" });
    // SES only reports problems it can see straight away (a malformed or
    // suppressed address, an unverified sender). Bounces arrive later.
    throw new Error(`Couldn't send the invite to ${email}. Check the address and try again.`);
  }

  // The email has gone out, so a failure here mustn't be reported as one
  const { errors: updateErrors } = await db.models.EmployeeInvite.update({ id: invite.id, messageId });
  if (updateErrors?.length) console.error(updateErrors);

  return { inviteId: invite.id, messageId };
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Tutor Studio tokens (src/index.css). Email clients ignore CSS variables and
// <style> blocks, so everything is inlined and laid out with tables.
const C = {
  orange: "#f26b21",
  orange50: "#fef2e9",
  canvas: "#fbf6ec",
  card: "#ffffff",
  hairline: "#e8dfcf",
  ink: "#2b2521",
  ink2: "#5c5349",
};
const FONT_DISPLAY = "'Fredoka', 'Nunito', Helvetica, Arial, sans-serif";
const FONT_BODY = "'Nunito', Helvetica, Arial, sans-serif";

type EmailContent = {
  inviteeName?: string | null;
  orgName: string;
  role: string;
  inviteLink: string;
  /** Public, non-expiring URL (a presigned S3 URL will break once it expires). */
  logoUrl?: string | null;
  message?: string | null;
};

const buildHtmlEmail = ({ inviteeName, orgName, role, inviteLink, logoUrl, message }: EmailContent) => {
  const org = escapeHtml(orgName);
  const link = escapeHtml(inviteLink);
  const greeting = inviteeName ? `Hi ${escapeHtml(inviteeName)},` : "Hi there,";

  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${org}" height="56" style="display:block;margin:0 auto;max-height:56px;max-width:200px;height:auto;border:0;" />`
    : `<span style="font-family:${FONT_DISPLAY};font-size:24px;font-weight:600;color:${C.ink};">${org}</span>`;

  const note = message
    ? `<tr><td style="padding:0 0 24px;">
        <div style="background:${C.orange50};border-left:4px solid ${C.orange};border-radius:8px;padding:14px 16px;font-size:15px;line-height:1.5;color:${C.ink};white-space:pre-line;">${escapeHtml(message)}</div>
      </td></tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>You're invited to join ${org}</title>
  </head>
  <body style="margin:0;padding:0;background:${C.canvas};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas};">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:${FONT_BODY};color:${C.ink};">
          <tr><td align="center" style="padding:0 0 24px;">${logo}</td></tr>
          <tr><td style="background:${C.card};border:1px solid ${C.hairline};border-radius:16px;box-shadow:0 16px 40px rgba(92,83,73,0.14);padding:32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:0 0 8px;font-family:${FONT_DISPLAY};font-size:24px;font-weight:600;line-height:1.25;color:${C.ink};">
                You're invited to join ${org}
              </td></tr>
              <tr><td style="padding:0 0 24px;font-size:15px;line-height:1.6;color:${C.ink2};">
                ${greeting}<br />
                ${org} has invited you to join their team on Tutor Studio as ${role === "Admin" ? "an Admin" : "a Tutor"}. Accept the invitation to set up your account, or to add ${org} to the account you already have. The link works for 7 days.
              </td></tr>
              ${note}
              <tr><td align="center" style="padding:0 0 24px;">
                <a href="${link}" style="display:inline-block;background:${C.orange};color:#ffffff;font-family:${FONT_BODY};font-size:16px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:999px;">Accept invitation</a>
              </td></tr>
              <tr><td style="border-top:1px solid ${C.hairline};padding:16px 0 0;font-size:13px;line-height:1.5;color:${C.ink2};">
                Button not working? Paste this link into your browser:<br />
                <a href="${link}" style="color:${C.orange};word-break:break-all;">${link}</a>
              </td></tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding:24px 0 0;font-size:12px;line-height:1.5;color:${C.ink2};">
            If you weren't expecting this invitation, you can ignore this email.<br />
            &copy; ${new Date().getFullYear()} Tutor Studio
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
};

const buildTextEmail = ({ inviteeName, orgName, role, inviteLink, message }: EmailContent) =>
  [
    inviteeName ? `Hi ${inviteeName},` : "Hi there,",
    "",
    `${orgName} has invited you to join their team on Tutor Studio as ${role === "Admin" ? "an Admin" : "a Tutor"}.`,
    ...(message ? ["", message] : []),
    "",
    `Accept the invitation (the link works for 7 days): ${inviteLink}`,
    "",
    "If you weren't expecting this invitation, you can ignore this email.",
  ].join("\n");

const generateInviteLink = (inviteToken: string) => {
  const params = new URLSearchParams({ t: inviteToken });
  return `${env.APP_URL}/join?${params}`;
};
