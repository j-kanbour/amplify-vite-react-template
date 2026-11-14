import type { AppSyncIdentity, AppSyncIdentityCognito } from "aws-lambda";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/manage-parents";
import type { Schema } from "../../../data/resource";
import { normaliseEmail, requireStaffOrg } from "../../employees/shared";

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

const ses = new SESv2Client({});
// Same verified sender as the employee invites
const FROM = "jkanbour1@gmail.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s()-]{6,20}$/;

const clean = (s: unknown) => (typeof s === "string" && s.trim() ? s.trim() : null);

type Contact = { firstName: string; lastName: string; email: string | null; phone: string | null; address: string | null };

/** The caller's org, provided they're staff there. */
async function staff(db: Db, identity: AppSyncIdentity | null | undefined) {
  const id = identity as AppSyncIdentityCognito | null;
  if (!id?.sub || !id.username) throw new Error("Unauthorized");
  return requireStaffOrg(db, `${id.sub}::${id.username}`, "Only admins and tutors can manage parents.");
}

/** The parent's fields from the mutation arguments, validated. Shared by add and edit. */
async function parentFields(db: Db, orgId: string, a: Record<string, unknown>) {
  const firstName = clean(a.firstName);
  const lastName = clean(a.lastName);
  const email = normaliseEmail(typeof a.email === "string" ? a.email : "");
  const phone = clean(a.phone);
  if (!firstName || !lastName) throw new Error("First and last name are required.");
  if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
  if (phone && !PHONE_RE.test(phone)) throw new Error("Enter a valid phone number.");

  // The second parent is only kept when there's at least a name
  const secondary: Contact | null =
    clean(a.secondFirstName) || clean(a.secondLastName)
      ? {
          firstName: clean(a.secondFirstName) ?? "",
          lastName: clean(a.secondLastName) ?? "",
          email: clean(a.secondEmail) ? normaliseEmail(a.secondEmail as string) : null,
          phone: clean(a.secondPhone),
          address: clean(a.secondAddress),
        }
      : null;
  if (secondary) {
    if (!secondary.firstName || !secondary.lastName) throw new Error("The second parent needs a first and last name.");
    if (secondary.email && !EMAIL_RE.test(secondary.email)) throw new Error("Enter a valid email for the second parent.");
    if (secondary.phone && !PHONE_RE.test(secondary.phone)) throw new Error("Enter a valid phone number for the second parent.");
  }

  // The bundle must be one of this org's
  const bundleId = clean(a.bundleId);
  const bundle = bundleId ? (await db.models.Bundle.get({ id: bundleId })).data : null;
  if (bundleId && (!bundle || bundle.orgId !== orgId)) throw new Error("That bundle isn't available.");

  return {
    fields: {
      firstName,
      lastName,
      email,
      phone,
      address: clean(a.address),
      bundleId: bundle?.id ?? null,
      notes: clean(a.notes),
      onboardingMessage: clean(a.onboardingMessage),
      secondary,
    },
    bundle,
  };
}

/** The parent, provided it belongs to the org. */
async function findParent(db: Db, orgId: string, parentId: string) {
  const { data: parent } = parentId ? await db.models.Parent.get({ id: parentId }) : { data: null };
  if (!parent || parent.orgId !== orgId) throw new Error("Parent not found.");
  return parent;
}

/**
 * Creates the Parent record, then sends the welcome email. The record is kept
 * even when the email fails (emailStatus says which), so nothing typed is
 * lost and the details can be re-sent later.
 */
async function addParent(identity: AppSyncIdentity | null | undefined, args: Record<string, unknown>) {
  const db = await getDb();
  const { me, org } = await staff(db, identity);
  const { fields, bundle } = await parentFields(db, org.id, args);

  const { data: parent, errors } = await db.models.Parent.create({
    orgId: org.id,
    ...fields,
    addedBy: me.id,
    emailStatus: "pending",
  });
  if (errors?.length || !parent) {
    console.error(errors);
    throw new Error("Failed to save the parent.");
  }

  const content: EmailContent = {
    ...fields,
    orgName: org.name,
    orgContact: [org.contactEmail, org.phone, org.website].filter((s): s is string => !!s?.trim()),
    message: fields.onboardingMessage,
    addedBy: me.name,
    bundle: bundle
      ? {
          name: bundle.name ?? "Bundle",
          price: formatPrice(bundle.price),
          priceUnit: bundle.priceUnit ?? null,
          sessions: bundle.sessions ?? null,
          features: (bundle.features ?? []).filter((f): f is string => !!f),
          description: bundle.description ?? null,
        }
      : null,
  };

  let messageId: string | undefined;
  try {
    const res = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: FROM,
        Destination: { ToAddresses: [fields.email] },
        Content: {
          Simple: {
            Subject: { Data: `Welcome to ${org.name}`, Charset: "UTF-8" },
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
    await db.models.Parent.update({ id: parent.id, emailStatus: "failed" });
    return { parentId: parent.id, emailSent: false };
  }

  // The email has gone out, so a failure here mustn't be reported as one
  const { errors: updateErrors } = await db.models.Parent.update({
    id: parent.id,
    emailStatus: "sent",
    emailMessageId: messageId,
  });
  if (updateErrors?.length) console.error(updateErrors);

  return { parentId: parent.id, emailSent: true };
}

/** Replaces the parent's details with the form's. No email: the parent isn't told about edits. */
async function updateParent(identity: AppSyncIdentity | null | undefined, args: Record<string, unknown>) {
  const db = await getDb();
  const { org } = await staff(db, identity);
  const parent = await findParent(db, org.id, clean(args.parentId) ?? "");
  const { fields } = await parentFields(db, org.id, args);

  const { errors } = await db.models.Parent.update({ id: parent.id, ...fields });
  if (errors?.length) {
    console.error(errors);
    throw new Error("Failed to save the changes.");
  }
  return { parentId: parent.id };
}

async function deleteParent(identity: AppSyncIdentity | null | undefined, args: Record<string, unknown>) {
  const db = await getDb();
  const { org } = await staff(db, identity);
  const parent = await findParent(db, org.id, clean(args.parentId) ?? "");

  const { errors } = await db.models.Parent.delete({ id: parent.id });
  if (errors?.length) {
    console.error(errors);
    throw new Error("Failed to remove the parent.");
  }
  return { parentId: parent.id };
}

/**
 * Amplify invokes custom-operation handlers with its own payload, which has
 * fieldName at the top level (see amplify/functions/employees/membership).
 */
type Event = {
  fieldName?: string;
  info?: { fieldName?: string };
  arguments: Record<string, unknown>;
  identity?: AppSyncIdentity | null;
};

/** One function serves add, edit and remove; the payload says which. */
export const handler = async (event: Event) => {
  const args = event.arguments ?? {};
  switch (event.fieldName ?? event.info?.fieldName) {
    case "addParent":
      return addParent(event.identity, args);
    case "editParent":
      return updateParent(event.identity, args);
    case "removeParent":
      return deleteParent(event.identity, args);
    default:
      throw new Error(`Unknown field ${event.fieldName ?? event.info?.fieldName}`);
  }
};

/** "$45", "$45.50", or the text as typed when it isn't a plain number. */
function formatPrice(price?: string | null) {
  const text = (price ?? "").trim();
  if (!text) return null;
  const n = Number(text.replace(/^\$/, "").replace(/,/g, ""));
  if (!Number.isFinite(n)) return text;
  return `$${Number.isInteger(n) ? n.toLocaleString("en-AU") : n.toFixed(2)}`;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Tutor Studio tokens (src/index.css), inlined: email clients ignore <style>.
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
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  orgName: string;
  orgContact: string[];
  message: string | null;
  addedBy: string;
  secondary: Contact | null;
  bundle: {
    name: string;
    price: string | null;
    priceUnit: string | null;
    sessions: number | null;
    features: string[];
    description: string | null;
  } | null;
};

const contactRows = (c: Contact): [string, string | null][] => [
  ["Name", `${c.firstName} ${c.lastName}`],
  ["Email", c.email],
  ["Phone", c.phone],
  ["Address", c.address],
];

const htmlRows = (rows: [string, string | null][]) =>
  rows
    .filter((r): r is [string, string] => !!r[1])
    .map(
      ([k, v]) => `<tr>
        <td style="padding:6px 12px 6px 0;font-size:14px;color:${C.ink2};white-space:nowrap;vertical-align:top;">${escapeHtml(k)}</td>
        <td style="padding:6px 0;font-size:14px;color:${C.ink};white-space:pre-line;">${escapeHtml(v)}</td>
      </tr>`
    )
    .join("");

const section = (title: string, body: string) => `<tr><td style="padding:0 0 20px;">
    <div style="font-family:${FONT_DISPLAY};font-size:15px;font-weight:600;color:${C.ink};padding:0 0 6px;border-bottom:1px solid ${C.hairline};margin-bottom:6px;">${escapeHtml(title)}</div>
    ${body}
  </td></tr>`;

const buildHtmlEmail = (c: EmailContent) => {
  const org = escapeHtml(c.orgName);
  const note = c.message
    ? `<tr><td style="padding:0 0 24px;">
        <div style="background:${C.orange50};border-left:4px solid ${C.orange};border-radius:8px;padding:14px 16px;font-size:15px;line-height:1.5;color:${C.ink};white-space:pre-line;">${escapeHtml(c.message)}</div>
      </td></tr>`
    : "";

  const bundle = c.bundle
    ? section(
        "Your bundle",
        `<div style="font-size:16px;font-weight:700;color:${C.ink};padding:6px 0 2px;">${escapeHtml(c.bundle.name)}</div>
        ${c.bundle.description ? `<div style="font-size:14px;color:${C.ink2};padding:0 0 6px;">${escapeHtml(c.bundle.description)}</div>` : ""}
        ${
          c.bundle.price
            ? `<div style="font-size:14px;color:${C.ink};padding:0 0 6px;"><span style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:700;">${escapeHtml(c.bundle.price)}</span> ${escapeHtml(c.bundle.priceUnit ?? "")}${c.bundle.sessions ? ` · ${c.bundle.sessions} session${c.bundle.sessions === 1 ? "" : "s"}` : ""}</div>`
            : ""
        }
        ${
          c.bundle.features.length
            ? `<ul style="margin:4px 0 0;padding-left:20px;font-size:14px;color:${C.ink};line-height:1.6;">${c.bundle.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`
            : ""
        }`
      )
    : "";

  const primary = section(
    "Your details",
    `<table role="presentation" cellpadding="0" cellspacing="0">${htmlRows(
      contactRows({ firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, address: c.address })
    )}</table>`
  );
  const secondary = c.secondary
    ? section("Second parent or guardian", `<table role="presentation" cellpadding="0" cellspacing="0">${htmlRows(contactRows(c.secondary))}</table>`)
    : "";

  const contact = c.orgContact.length
    ? `<tr><td style="border-top:1px solid ${C.hairline};padding:16px 0 0;font-size:13px;line-height:1.6;color:${C.ink2};">
        Questions? Reach ${org} at ${c.orgContact.map(escapeHtml).join(" · ")}.
      </td></tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Welcome to ${org}</title>
  </head>
  <body style="margin:0;padding:0;background:${C.canvas};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas};">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${FONT_BODY};color:${C.ink};">
          <tr><td align="center" style="padding:0 0 24px;"><span style="font-family:${FONT_DISPLAY};font-size:24px;font-weight:600;color:${C.ink};">${org}</span></td></tr>
          <tr><td style="background:${C.card};border:1px solid ${C.hairline};border-radius:16px;box-shadow:0 16px 40px rgba(92,83,73,0.14);padding:32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:0 0 8px;font-family:${FONT_DISPLAY};font-size:24px;font-weight:600;line-height:1.25;color:${C.ink};">
                Welcome to ${org}
              </td></tr>
              <tr><td style="padding:0 0 24px;font-size:15px;line-height:1.6;color:${C.ink2};">
                Hi ${escapeHtml(c.firstName)},<br />
                ${escapeHtml(c.addedBy)} has set you up with ${org}. Here's a copy of the details we have on file. If anything isn't right, just reply to this email.
              </td></tr>
              ${note}
              ${bundle}
              ${primary}
              ${secondary}
              ${contact}
            </table>
          </td></tr>
          <tr><td align="center" style="padding:24px 0 0;font-size:12px;line-height:1.5;color:${C.ink2};">
            Sent by ${org} via Tutor Studio &middot; &copy; ${new Date().getFullYear()}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
};

const textRows = (rows: [string, string | null][]) =>
  rows.filter((r): r is [string, string] => !!r[1]).map(([k, v]) => `${k}: ${v}`);

const buildTextEmail = (c: EmailContent) =>
  [
    `Hi ${c.firstName},`,
    "",
    `${c.addedBy} has set you up with ${c.orgName}. Here's a copy of the details we have on file. If anything isn't right, just reply to this email.`,
    ...(c.message ? ["", c.message] : []),
    ...(c.bundle
      ? [
          "",
          "YOUR BUNDLE",
          c.bundle.name,
          ...(c.bundle.description ? [c.bundle.description] : []),
          ...(c.bundle.price
            ? [`${c.bundle.price} ${c.bundle.priceUnit ?? ""}${c.bundle.sessions ? ` · ${c.bundle.sessions} session${c.bundle.sessions === 1 ? "" : "s"}` : ""}`.trim()]
            : []),
          ...c.bundle.features.map((f) => `- ${f}`),
        ]
      : []),
    "",
    "YOUR DETAILS",
    ...textRows(contactRows({ firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, address: c.address })),
    ...(c.secondary ? ["", "SECOND PARENT OR GUARDIAN", ...textRows(contactRows(c.secondary))] : []),
    ...(c.orgContact.length ? ["", `Questions? Reach ${c.orgName} at ${c.orgContact.join(" · ")}.`] : []),
  ].join("\n");
