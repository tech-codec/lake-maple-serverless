const { app } = require("@azure/functions");
const { EmailClient } = require("@azure/communication-email");

const emailClient = new EmailClient(
  process.env.COMMUNICATION_CONNECTION_STRING,
);

app.serviceBusQueue("NotifyPreviousLeader", {
  queueName: process.env.LEADER_CHANGE_QUEUE || "leader-change-queue",

  connection: "SERVICE_BUS_CONNECTION",

  handler: async (message, context) => {
    context.log("NotifyPreviousLeader started.");

    try {
      const event = typeof message === "string" ? JSON.parse(message) : message;

      if (!event.previousLeaderEmail) {
        context.warn("Previous leader email missing.");

        return;
      }

      const emailMessage = {
        senderAddress: process.env.EMAIL_SENDER,

        recipients: {
          to: [
            {
              address: event.previousLeaderEmail,
            },
          ],
        },

        content: {
          subject: `Your ${event.fishType} record was beaten!`,

          plainText: `Your Lake Maple Fishing Competition record has been surpassed.

Fish: ${event.fishType}

Your previous record:
${event.previousWeight} kg

New leader:
${event.newLeaderName}

New record:
${event.newWeight} kg

Keep fishing — you can still reclaim first place!`,
        },
      };

      const poller = await emailClient.beginSend(emailMessage);

      const result = await poller.pollUntilDone();

      context.log(`Previous leader notification completed: ${result.status}`);
    } catch (error) {
      context.error("NotifyPreviousLeader failed:", error);

      throw error;
    }
  },
});
