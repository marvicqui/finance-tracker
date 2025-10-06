import { CosmosClient } from "@azure/cosmos";
import { randomUUID } from "crypto";
const { COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DB = "finance", COSMOS_CONTAINER = "transactions" } = process.env;

export default async function (context, req) {
  try {
    // Asegura que obtengamos el body en Node v4:
    let b = req.body;
    if (!b) {
      try { b = await req.json(); } catch { b = null; }
    }

    const errs = [];
    if (!b) errs.push("body required");
    if (!b?.userId) errs.push("userId required");
    if (!b?.date) errs.push("date (YYYY-MM-DD) required");
    if (typeof b?.amount !== "number") errs.push("amount must be number");
    if (!b?.category) errs.push("category required");
    if (errs.length) return (context.res = { status: 400, jsonBody: { errors: errs } });

    const now = new Date().toISOString();
    const item = {
      id: randomUUID(),
      userId: b.userId,
      date: b.date,
      amount: b.amount,
      category: b.category,
      note: b.note ?? "",
      account: b.account ?? "Other",
      tags: Array.isArray(b.tags) ? b.tags : [],
      createdAt: now,
      updatedAt: now
    };

    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
    const container = client.database(COSMOS_DB).container(COSMOS_CONTAINER);
    const { resource } = await container.items.create(item);
    context.res = { status: 201, jsonBody: resource };
  } catch (e) {
    context.log.error(e);
    context.res = { status: 500, jsonBody: { error: e.message } };
  }
}
