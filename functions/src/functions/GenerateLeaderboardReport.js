const { app } = require("@azure/functions");
const { database } = require("../services/cosmosClient");
const { blobServiceClient } = require("../services/blobClient");

app.timer("GenerateLeaderboardReport", {
  schedule: process.env.LEADERBOARD_REPORT_SCHEDULE || "0 0 1 * * *",

  handler: async (timer, context) => {
    context.log("GenerateLeaderboardReport started.");

    try {
      if (timer.isPastDue) {
        context.warn("Leaderboard report timer invocation is past due.");
      }

      // ------------------------------------
      // Read leaderboard records
      // ------------------------------------

      const leaderboardContainer = database.container("leaderboards");

      const query = {
        query: "SELECT * FROM c ORDER BY c.fishType",
      };

      const { resources: leaders } = await leaderboardContainer.items
        .query(query)
        .fetchAll();

      context.log(`Found ${leaders.length} leaderboard entries.`);

      // ------------------------------------
      // Build report
      // ------------------------------------

      const generatedAt = new Date().toISOString();

      const report = {
        competition: "Lake Maple Fishing Competition",

        reportType: "Daily Leaderboard",

        generatedAt,

        totalCategories: leaders.length,

        leaderboard: leaders.map((leader, index) => ({
          position: index + 1,

          fishType: leader.fishType,

          contestantId: leader.contestantId,

          contestantName: leader.contestantName,

          weight: leader.weight,

          fishCatchId: leader.fishCatchId,

          updatedAt: leader.updatedAt,
        })),
      };

      // ------------------------------------
      // Generate file name
      // ------------------------------------

      const date = generatedAt.substring(0, 10);

      const blobName = `generated/leaderboard-${date}.json`;

      const containerName = process.env.REPORTS_CONTAINER || "reports";

      const containerClient =
        blobServiceClient.getContainerClient(containerName);

      const blobClient = containerClient.getBlockBlobClient(blobName);

      const reportContent = JSON.stringify(report, null, 2);

      // ------------------------------------
      // Upload report
      // ------------------------------------

      await blobClient.uploadData(Buffer.from(reportContent), {
        overwrite: true,

        blobHTTPHeaders: {
          blobContentType: "application/json",
        },

        metadata: {
          reportType: "daily-leaderboard",

          generatedAt,
        },
      });

      context.log(`Leaderboard report generated: ${blobName}`);

      context.log(`Report contains ${leaders.length} fish categories.`);
    } catch (error) {
      context.error("GenerateLeaderboardReport failed:", error);

      throw error;
    }
  },
});
