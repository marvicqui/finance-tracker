import { useEffect, useState, useCallback } from 'react';
import { listCards, addCard, deleteCard } from '../api/cards'; // 👈 asegúrate de este path/nombres

export function useCards(userId) {
  const [cards, setCards]   = useState([]);
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState(null);

  // carga inicial / cuando cambia el usuario
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!userId) { setCards([]); return; }
      setLoad(true);
      setError(null);
      try {
        const data = await listCards();           // 👈 llamada a API
        if (alive) setCards(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) setError(e);
      } finally {
        if (alive) setLoad(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [userId]);

  // crear
  const create = useCallback(async (card) => {
    setError(null);
    const created = await addCard(card);         // 👈 llamada a API
    // optimista / o puedes recargar listCards() si prefieres
    setCards(prev => [created, ...prev]);
    return created;
  }, []);

  // borrar
  const remove = useCallback(async (id) => {
    setError(null);
    await deleteCard(id);                        // 👈 llamada a API
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  return { cards, loading, error, create, remove };
}
