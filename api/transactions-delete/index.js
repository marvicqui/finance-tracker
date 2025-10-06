import { CosmosClient } from "@azure/cosmos";

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DB || "finance";
const containerId = process.env.COSMOS_CONTAINER || "transactions";

export default async function (context, req) {
  try {
    const id = context.bindingData.id;
    const userId = req.query.userId; // partition key

    if (!id || !userId) {
      context.res = { status: 400, jsonBody: { error: "id and userId (partition key) required" } };
      return;
    }

    const client = new CosmosClient({ endpoint, key });
    const container = client.database(databaseId).container(containerId);

    await container.item(id, userId).delete();
    context.res = { status: 204 };
  } catch (e) {
    context.log.error(e);
    context.res = { status: 500, jsonBody: { error: e.message } };
  }
}
