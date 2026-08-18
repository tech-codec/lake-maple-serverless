const { app } = require("@azure/functions");

app.storageBlob("ProcessFishPhoto", {
  path: "fish-photos/{name}",
  connection: "LAKE_MAPLE_STORAGE_CONNECTION",

  handler: async (blob, context) => {
    const blobName = context.triggerMetadata.name;

    context.log(`ProcessFishPhoto triggered for: ${blobName}`);

    context.log(`Blob size: ${blob.length} bytes`);

    /*
     * Later we can add:
     *
     * - image validation
     * - resizing
     * - malware/file checks
     * - metadata extraction
     * - update Cosmos DB photoStatus
     */

    context.log("Fish photo processing completed.");
  },
});
