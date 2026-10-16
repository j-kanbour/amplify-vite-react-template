// src/handler.ts
import { randomUUID } from "node:crypto";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type { Schema } from "../../../data/resource";

const ses = new SESv2Client({}); 
const FROM = "jkanbour1@gmail.com"; 
const URL = "main.d1r1w88reoeqd8.amplifyapp.com" //temp

export const handler: Schema["sendEmployeeInviteEmail"]["functionHandler"] = async (event) => {
  const { to, subject, text, orgName } = event.arguments;
  const inviteToken = randomUUID();

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

const generateInviteLink = (orgId: string, to: string, inviteToken: string) => {
  return `https://${URL}/onboardEmployee?orgid=${orgId}&userEmail=${to}&t=${inviteToken}`
}