import { useEffect, useState, useCallback } from 'react';
import * as api from '../api/cards';

export function useCards(userId) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) { setCards([]); return; }
      setLoading(true); setError(null);
      try {
        const data = await api.listCards();
        if (!cancelled) setCards(data);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const create = useCallback(async (card) => {
    if (!userId) throw new Error('No usuario');
    const c = await api.addCard(card);
    setCards(prev => [c, ...prev]);
    return c;
  }, [userId]);

  const remove = useCallback(async (id) => {
    if (!userId) throw new Error('No usuario');
    await api.deleteCard(id);
    setCards(prev => prev.filter(x => x.id !== id));
  }, [userId]);

  return { cards, loading, error, create, remove };
}
