const { app } = require("@azure/functions");
const { blobServiceClient } = require("../services/blobClient");

app.storageBlob("PublishLeaderboard", {
  path: "reports/generated/{name}",
  connection: "LAKE_MAPLE_STORAGE_CONNECTION",

  handler: async (blob, context) => {
    context.log("PublishLeaderboard started.");

    try {
      const blobName = context.triggerMetadata.name;

      context.log(`New leaderboard report detected: ${blobName}`);

      // ----------------------------------
      // Parse report
      // ----------------------------------

      const content = blob.toString("utf8");

      const report = JSON.parse(content);

      if (!report.leaderboard || !Array.isArray(report.leaderboard)) {
        throw new Error("Invalid leaderboard report.");
      }

      // ----------------------------------
      // Add publication metadata
      // ----------------------------------

      const publishedReport = {
        ...report,

        publishedAt: new Date().toISOString(),

        status: "published",
      };

      const output = JSON.stringify(publishedReport, null, 2);

      // ----------------------------------
      // Write latest published leaderboard
      // ----------------------------------

      const containerName = process.env.REPORTS_CONTAINER || "reports";

      const containerClient =
        blobServiceClient.getContainerClient(containerName);

      const publishedBlob = containerClient.getBlockBlobClient(
        "published/latest-leaderboard.json",
      );

      await publishedBlob.uploadData(Buffer.from(output), {
        overwrite: true,

        blobHTTPHeaders: {
          blobContentType: "application/json",
        },

        metadata: {
          status: "published",

          sourceReport: blobName,
        },
      });

      context.log("Leaderboard published successfully.");

      context.log(
        `Published ${publishedReport.leaderboard.length} categories.`,
      );
    } catch (error) {
      context.error("PublishLeaderboard failed:", error);

      throw error;
    }
  },
});
