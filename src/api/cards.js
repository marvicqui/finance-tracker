export async function listCards() {
  const r = await fetch('/api/cards', { credentials: 'include' });
  if (!r.ok) throw new Error('Error al leer tarjetas');
  return r.json();
}

export async function addCard(card) {
  const r = await fetch('/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(card)
  });
  if (r.status === 409) throw new Error('Ya existe una tarjeta con ese nombre.');
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(t || 'Error al crear tarjeta');
  }
  return r.json();
}

export async function deleteCard(id) {
  const r = await fetch(`/api/cards/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!r.ok && r.status !== 204) throw new Error('Error al borrar tarjeta');
  return true;
}
