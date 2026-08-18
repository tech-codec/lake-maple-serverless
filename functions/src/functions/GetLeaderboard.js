const { app } = require("@azure/functions");
const { database } = require("../services/cosmosClient");

app.http("GetLeaderboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "leaderboard",

  handler: async (request, context) => {
    context.log("GetLeaderboard started.");

    try {
      const container = database.container("leaderboards");

      const query = {
        query: "SELECT * FROM c ORDER BY c.fishType",
      };

      const { resources } = await container.items.query(query).fetchAll();

      return {
        status: 200,
        jsonBody: {
          success: true,
          leaderboard: resources,
        },
      };
    } catch (error) {
      context.error("GetLeaderboard failed:", error);

      return {
        status: 500,
        jsonBody: {
          success: false,
          message: "Unable to retrieve leaderboard.",
        },
      };
    }
  },
});
