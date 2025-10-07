import { CosmosClient } from "@azure/cosmos";

function getClientPrincipal(req) {
  const v = req.headers["x-ms-client-principal"];
  if (!v) return null;
  return JSON.parse(Buffer.from(v, "base64").toString("utf8"));
}

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DB || "finance";
const containerId = process.env.COSMOS_CARDS_CONTAINER || "cards"; // <-- contenedor para tarjetas

export default async function (context, req) {
  try {
    const principal = getClientPrincipal(req);
    if (!principal) { context.res = { status: 401, jsonBody: { error: "Unauthorized" } }; return; }
    const userId = principal.userId;

    const client = new CosmosClient({ endpoint, key });
    const container = client.database(databaseId).container(containerId);

    const query = "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC";
    const { resources } = await container.items.query({
      query,
      parameters: [{ name: "@userId", value: userId }]
    }).fetchAll();

    context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(resources ?? []) };
  } catch (e) {
    context.log.error(e);
    context.res = { status: 500, jsonBody: { error: String(e.message || e) } };
  }
}
