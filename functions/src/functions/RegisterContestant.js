const { app, output } = require("@azure/functions");
const crypto = require("crypto");
const { database } = require("../services/cosmosClient");

const registrationQueueOutput = output.serviceBusQueue({
  queueName: process.env.REGISTRATION_QUEUE || "registration-queue",
  connection: "SERVICE_BUS_CONNECTION",
});

app.http("RegisterContestant", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "contestants/register",

  extraOutputs: [registrationQueueOutput],

  handler: async (request, context) => {
    context.log("RegisterContestant function started.");

    try {
      const body = await request.json();

      const firstName = body.firstName?.trim();
      const lastName = body.lastName?.trim();
      const email = body.email?.trim().toLowerCase();

      if (!firstName || !lastName || !email) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: "firstName, lastName, and email are required.",
          },
        };
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email)) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            message: "A valid email address is required.",
          },
        };
      }

      const contestant = {
        id: crypto.randomUUID(),
        firstName,
        lastName,
        email,
        registrationDate: new Date().toISOString(),
        status: "registered",
      };

      const container = database.container("contestants");

      const { resource } = await container.items.create(contestant);

      const registrationMessage = {
        eventType: "ContestantRegistered",
        contestantId: resource.id,
        firstName: resource.firstName,
        lastName: resource.lastName,
        email: resource.email,
        registrationDate: resource.registrationDate,
      };

      context.extraOutputs.set(registrationQueueOutput, registrationMessage);

      context.log(
        `Contestant registered and queue message created: ${resource.id}`,
      );

      return {
        status: 201,
        jsonBody: {
          success: true,
          message: "Contestant registered successfully.",
          contestant: {
            id: resource.id,
            firstName: resource.firstName,
            lastName: resource.lastName,
            email: resource.email,
            registrationDate: resource.registrationDate,
            status: resource.status,
          },
        },
      };
    } catch (error) {
      context.error("RegisterContestant failed:", error);

      return {
        status: 500,
        jsonBody: {
          success: false,
          message:
            "An unexpected error occurred while registering the contestant.",
        },
      };
    }
  },
});
