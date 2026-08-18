const { BlobServiceClient } = require("@azure/storage-blob");

const connectionString =
  process.env.LAKE_MAPLE_STORAGE_CONNECTION || process.env.AzureWebJobsStorage;

if (!connectionString) {
  throw new Error("Missing Blob Storage connection string.");
}

const blobServiceClient =
  BlobServiceClient.fromConnectionString(connectionString);

module.exports = {
  blobServiceClient,
};
