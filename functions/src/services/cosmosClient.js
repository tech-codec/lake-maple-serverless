const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseName = process.env.COSMOS_DATABASE;

if (!endpoint || !key || !databaseName) {
  throw new Error(
    "Missing Cosmos DB configuration. Check COSMOS_ENDPOINT, COSMOS_KEY, and COSMOS_DATABASE.",
  );
}

const client = new CosmosClient({
  endpoint,
  key,
});

const database = client.database(databaseName);

module.exports = {
  client,
  database,
};
