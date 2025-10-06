import { useEffect, useState } from "react";
import { listTransactions, addTransaction, deleteTransaction } from "../api/transactions";

export function useTransactions(userId, month) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  async function refresh() {
    setLoading(true); setError(null);
    try {
      const data = await listTransactions({ userId, month });
      setItems(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  async function create(tx) {
    const created = await addTransaction({ ...tx, userId });
    setItems(prev => [created, ...prev]);
    return created;
  }

  async function remove(id) {
    await deleteTransaction(id, userId);
    setItems(prev => prev.filter(x => x.id !== id));
  }

  useEffect(() => { refresh(); }, [userId, month]);
  return { items, loading, error, refresh, create, remove };
}
