const { CosmosClient } = require("@azure/cosmos");
const { randomUUID } = require("crypto");

function getClientPrincipal(req) {
  const v = req.headers["x-ms-client-principal"];
  if (!v) return null;
  try { return JSON.parse(Buffer.from(v, "base64").toString("utf8")); }
  catch { return null; }
}

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DB || "finance";
const containerId = process.env.COSMOS_CARDS_CONTAINER || "cards";

module.exports = async function (context, req) {
  try {
    const principal = getClientPrincipal(req);
    if (!principal) return (context.res = { status: 401, body: { error: "Unauthorized" } });

    const userId = principal.userId;
    const body = req.body || {};
    const name = (body.name || '').trim();
    const limit = Number(body.limit);
    const balance = Number(body.balance || 0);
    const cutoffDay = Number(body.cutoffDay || 1);
    const paymentDay = Number(body.paymentDay || 10);

    if (!name || Number.isNaN(limit)) {
      context.res = { status: 400, body: { error: "name y limit (number) son requeridos" } };
      return;
    }

    const client = new CosmosClient({ endpoint, key });
    const container = client.database(databaseId).container(containerId);

    // Duplicado por nombre (case-insensitive) para el mismo usuario
    const { resources: dup } = await container.items.query({
      query: "SELECT TOP 1 c.id FROM c WHERE c.userId = @user AND LOWER(c.name) = LOWER(@name)",
      parameters: [
        { name: "@user", value: userId },
        { name: "@name", value: name }
      ]
    }).fetchAll();

    if (dup && dup.length) {
      context.res = { status: 409, body: { error: "DUPLICATE" } };
      return;
    }

    const item = {
      id: body.id || randomUUID(),
      type: "card",
      userId,
      name,
      limit,
      balance,
      cutoffDay,
      paymentDay,
      createdAt: new Date().toISOString()
    };

    const { resource } = await container.items.create(item, { disableAutomaticIdGeneration: true });
    context.res = { status: 201, body: resource };
  } catch (e) {
    context.log.error(e);
    context.res = { status: 500, body: { error: String(e.message || e) } };
  }
};
