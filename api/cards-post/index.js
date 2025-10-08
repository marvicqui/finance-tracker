// api/cards-post/index.js
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
  const where = (step, extra) => context.log(`[cards-post] ${step}`, extra || "");
  try {
    where("start");

    const principal = getClientPrincipal(req);
    if (!principal) {
      where("no principal");
      context.res = { status: 401, body: { error: "Unauthorized" } };
      return;
    }

    const userId = principal.userId;
    const body = req.body || {};
    // Normaliza/valida
    const name = (body.name || "").toString().trim();
    const limit = Number(body.limit);
    const balance = Number(body.balance || 0);
    const cutoffDay = Number(body.cutoffDay || 1);
    const paymentDay = Number(body.paymentDay || 10);

    if (!name) {
      context.res = { status: 400, body: { error: "El nombre es requerido" } };
      return;
    }
    if (!Number.isFinite(limit) || limit <= 0) {
      context.res = { status: 400, body: { error: "El límite debe ser un número > 0" } };
      return;
    }
    if (!Number.isFinite(balance) || balance < 0) {
      context.res = { status: 400, body: { error: "El saldo debe ser un número >= 0" } };
      return;
    }
    if (!Number.isInteger(cutoffDay) || cutoffDay < 1 || cutoffDay > 31) {
      context.res = { status: 400, body: { error: "El día de corte debe estar entre 1 y 31" } };
      return;
    }
    if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
      context.res = { status: 400, body: { error: "El día de pago debe estar entre 1 y 31" } };
      return;
    }

    where("cosmos init");
    const client = new CosmosClient({ endpoint, key });
    const container = client.database(databaseId).container(containerId);

    // Dup por nombre (case-insensitive) + userId
    where("dup-check", { name, userId });
    const { resources: dup } = await container.items.query({
      query: "SELECT TOP 1 c.id FROM c WHERE c.userId = @user AND LOWER(c.name) = LOWER(@name)",
      parameters: [
        { name: "@user", value: userId },
        { name: "@name", value: name }
      ]
    }).fetchAll();

    if (dup && dup.length) {
      where("dup-found", dup[0]);
      context.res = { status: 409, body: { error: "Ya existe una tarjeta con ese nombre." } };
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

    where("create", item);
    const { resource } = await container.items.create(item, { disableAutomaticIdGeneration: true });

    where("success", resource?.id);
    context.res = { status: 201, body: resource };
  } catch (e) {
    // Devuelve error detallado para verlo en el cliente
    where("error", { message: e?.message, code: e?.code, body: e?.body });
    let msg = e?.message || "Error al crear tarjeta";
    // Si es error de Cosmos, intenta extraer más detalle
    if (e?.body && typeof e.body === "string") {
      try {
        const jb = JSON.parse(e.body);
        if (jb?.message) msg = jb.message;
      } catch {}
    }
    context.res = { status: 500, body: { error: msg, code: e?.code || null } };
  }
};
