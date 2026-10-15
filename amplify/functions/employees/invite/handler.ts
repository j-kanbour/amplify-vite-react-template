import type { Handler } from 'aws-lambda';
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({ region: "ap-southeast-2" });

type SendEmailEvent = {
  email: string;
  name: string;
  orgName: string;
  message: string;
};

export const handler: Handler<SendEmailEvent, void> = async (event) => {
  const { email, orgName, name, message } = event;
  
  const recipiant = email;
  const subject = `${orgName} has invited you to join Tutor Studio`;
  const body = message;

  const command = new SendEmailCommand({
    Source: "",
    Destination: {
      ToAddress: [recipiant],
    },
    Message: {
      Body: {
        Text: { Data: body },
      },
      Subject: { Data: subject }
    }
  });

  try {
    const result = await sesClient.send(command); 
  } catch (error) {
    console.error(`Error sending invite to ${recipiant}: ${error}`)
  }
};