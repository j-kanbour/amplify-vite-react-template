// src/handler.ts
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type { Schema } from "../../../data/resource";

const ses = new SESv2Client({}); 
const FROM = "jkanbour1@gmail.com"; 

export const handler: Schema["sendEmployeeInviteEmail"]["functionHandler"] = async (event) => {
  const { to, subject, text, orgName } = JSON.parse(event.body ?? "{}");

  if (!to || !subject || !(text)) {
    return { statusCode: 400, body: JSON.stringify({ error: "to, subject and text/html required" }) };
  }

  const inviteLink = generateInviteLink(orgName, to);
  const html = buildHtmlEmail(orgName, inviteLink);

  try {
    const res = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: FROM,
        Destination: { ToAddresses: Array.isArray(to) ? to : [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: {
              ...(text && { Text: { Data: text, Charset: "UTF-8" } }),
              ...(html && { Html: { Data: html, Charset: "UTF-8" } }),
            },
          },
        },
      })
    );
    return { statusCode: 200, body: JSON.stringify({ messageId: res.MessageId }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to send email" }) };
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

const generateInviteLink = (orgId: string, email: string) => {

}