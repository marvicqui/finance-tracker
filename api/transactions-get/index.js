import { CosmosClient } from "@azure/cosmos";

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DB || "finance";
const containerId = process.env.COSMOS_CONTAINER || "transactions";

export default async function (context, req) {
  try {
    const userId = req.query.userId;   // opcional
    const month  = req.query.month;    // opcional: "YYYY-MM"

    const client = new CosmosClient({ endpoint, key });
    const container = client.database(databaseId).container(containerId);

    const where = [];
    const params = [];
    if (userId) { where.push("c.userId = @userId"); params.push({ name: "@userId", value: userId }); }
    if (month)  { where.push("STARTSWITH(c.date, @month)"); params.push({ name: "@month", value: month }); }

    const query = `SELECT * FROM c ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY c.date DESC`;
    context.log(`Query: ${query} | Params: ${JSON.stringify(params)}`);

    const { resources } = await container.items.query({ query, parameters: params }).fetchAll();

    // >>> Fuerza JSON siempre <<<
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resources ?? [])
    };
  } catch (e) {
    context.log.error(e);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(e?.message || e) })
    };
  }
}
