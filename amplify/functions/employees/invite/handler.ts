// src/handler.ts
import { createHash, randomUUID } from "node:crypto";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/send-employee-invite-email";
import type { Schema } from "../../../data/resource";

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

const ses = new SESv2Client({}); 
const FROM = "jkanbour1@gmail.com"; 
const URL = "main.d1r1w88reoeqd8.amplifyapp.com" //temp

export const handler: Schema["sendEmployeeInviteEmail"]["functionHandler"] = async (event) => {
  const { to, subject, text, orgName } = event.arguments;
  const inviteToken = randomUUID();
  const db = await getDb();

  // record the invite before emailing, so every link sent has a token to match
  const { data: invite, errors } = await db.models.EmployeeInvite.create({
    email: to,
    orgName,
    inviteToken,
    status: "pending",
  });
  if (errors?.length || !invite) {
    console.error(errors);
    throw new Error("Failed to create invite");
  }

  const inviteLink = generateInviteLink(orgName, to, inviteToken);
  const html = buildHtmlEmail(orgName, inviteLink);

  try {
    const res = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: FROM,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: {
              ...(text && { Text: { Data: text, Charset: "UTF-8" } }),
              Html: { Data: html, Charset: "UTF-8" },
            },
          },
        },
      })
    );
    await db.models.EmployeeInvite.update({ id: invite.id, messageId: res.MessageId });
    return { messageId: res.MessageId };
  } catch (err) {
    console.error(err);
    throw new Error("Failed to send email");
  }
};

const buildHtmlEmail = (name: string, inviteLink: string) => {
  return `
    <html>
      <body>
        <p>Hi ${name},</p>
        <p>You have been invited to join ${inviteLink}. Please click the link below to accept the invitation:</p>
        <a href="${inviteLink}">Accept Invitation</a>
        <p>Best regards,<br/>The Team</p>
      </body>
    </html>
  `;
}

// one-way: the onboarding page can't read these back, only compare them
// against the invite looked up by token (hash the stored values the same way)
const hash = (value: string) =>
  createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

const generateInviteLink = (orgId: string, to: string, inviteToken: string) => {
  const params = new URLSearchParams({ o: hash(orgId), e: hash(to), t: inviteToken });
  return `https://${URL}/onboardEmployee?${params}`;
}