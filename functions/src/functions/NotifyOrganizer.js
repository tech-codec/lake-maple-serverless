const { app } = require("@azure/functions");
const { EmailClient } = require("@azure/communication-email");

const connectionString = process.env.COMMUNICATION_CONNECTION_STRING;

const senderAddress = process.env.EMAIL_SENDER;

const organizerEmail = process.env.ORGANIZER_EMAIL;

const emailClient = new EmailClient(connectionString);

app.serviceBusQueue("NotifyOrganizer", {
  queueName: process.env.REGISTRATION_QUEUE || "registration-queue",
  connection: "SERVICE_BUS_CONNECTION",

  handler: async (message, context) => {
    context.log("NotifyOrganizer function started.");

    try {
      const registration =
        typeof message === "string" ? JSON.parse(message) : message;

      context.log(
        `Processing registration notification for contestant ${registration.contestantId}`,
      );

      const emailMessage = {
        senderAddress,

        content: {
          subject: "New Lake Maple Fishing Competition Registration",

          plainText: `A new contestant has registered for the Lake Maple Fishing Competition.

Name: ${registration.firstName} ${registration.lastName}
Email: ${registration.email}
Registration Date: ${registration.registrationDate}
Contestant ID: ${registration.contestantId}`,
        },

        recipients: {
          to: [
            {
              address: organizerEmail,
            },
          ],
        },
      };

      const poller = await emailClient.beginSend(emailMessage);

      const result = await poller.pollUntilDone();

      context.log(
        `Organizer email operation completed. Status: ${result.status}`,
      );
    } catch (error) {
      context.error("NotifyOrganizer failed:", error);

      throw error;
    }
  },
});
