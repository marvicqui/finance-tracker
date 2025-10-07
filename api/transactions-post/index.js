import { CosmosClient } from "@azure/cosmos";
import { randomUUID } from "crypto";

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

    const body = req.body || {};
    // ignoramos body.userId si llegara; usamos el del token
    const { date, amount, category, note = "", account = "Other", tags = [] } = body;

    if (!date || typeof amount !== "number" || !category) {
      context.res = { status: 400, jsonBody: { error: "date, amount (number) y category son requeridos" } };
      return;
    }

    const item = {
      id: body.id || randomUUID(),
      userId,            // <- partición
      date,              // YYYY-MM-DD
      amount,            // negativo egreso / positivo ingreso
      category,
      note,
      account,
      tags,
      createdAt: new Date().toISOString(),
    };

    const client = new CosmosClient({ endpoint, key });
    const container = client.database(databaseId).container(containerId);
    const { resource } = await container.items.create(item, { disableAutomaticIdGeneration: true });

    context.res = { status: 201, jsonBody: resource };
  } catch (e) {
    context.log.error(e);
    context.res = { status: 500, jsonBody: { error: String(e.message || e) } };
  }
}
