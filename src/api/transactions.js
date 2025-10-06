async function parseJsonSafe(res) {
  const text = await res.text();              // <- evita fallo si body está vacío/HTML
  if (!text) return null;
  try { return JSON.parse(text); }
  catch (e) {
    // Te deja pista de qué devolvió el backend (p. ej. HTML de 502/404)
    throw new Error(`Invalid JSON (${res.status}): ${text.slice(0,200)}`);
  }
}

export async function listTransactions(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`/api/transactions${q ? `?${q}` : ""}`);
  if (!res.ok) throw new Error(`List failed (${res.status})`);
  return (await parseJsonSafe(res)) ?? [];    // <- si vacío, regresa []
}

export async function addTransaction(t) {
  const res = await fetch(`/api/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(t)
  });
  if (!res.ok) throw new Error(`Create failed (${res.status})`);
  return await parseJsonSafe(res);
}

export async function deleteTransaction(id, userId) {
  const res = await fetch(`/api/transactions/${id}?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
  return true; // 204 no tiene body
}
