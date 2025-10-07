import { CosmosClient } from "@azure/cosmos";

function getClientPrincipal(req) {
  const v = req.headers["x-ms-client-principal"];
  if (!v) return null;
  return JSON.parse(Buffer.from(v, "base64").toString("utf8"));
}

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DB || "finance";
const containerId = process.env.COSMOS_CONTAINER || "transactions";

export default async function (context, req) {
  try {
    const principal = getClientPrincipal(req);
    if (!principal) {
      context.res = { status: 401, jsonBody: { error: "Unauthorized" } };
      return;
    }
    const userId = principal.userId;

    // id por ruta: /api/transactions/{id}
    const id = context.bindingData?.id || req.query?.id;
    if (!id) {
      context.res = { status: 400, jsonBody: { error: "id requerido en ruta o query" } };
      return;
    }

    const client = new CosmosClient({ endpoint, key });
    const container = client.database(databaseId).container(containerId);
    // importante: siempre pasar partitionKey = userId
    await container.item(id, userId).delete();

    context.res = { status: 204 };
  } catch (e) {
    context.log.error(e);
    // Si el doc no existe o no pertenece al usuario, devolvemos 404
    context.res = { status: 404, jsonBody: { error: "Not found" } };
  }
}
