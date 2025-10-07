export async function addCard(card) {
  const r = await fetch('/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(card)
  });

  if (r.status === 409) throw new Error('Ya existe una tarjeta con ese nombre.');

  if (!r.ok) {
    // Muestra el error real
    let msg = 'Error al crear tarjeta';
    try {
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await r.json();
        if (j?.error) msg = j.error;
      } else {
        const t = await r.text();
        if (t) msg = t;
      }
    } catch {}
    throw new Error(msg);
  }
  return r.json();
}
