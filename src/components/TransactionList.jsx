export default function TransactionList({ items, onDelete }) {
  if (!items?.length) return <p className="text-sm text-gray-500">No transactions yet.</p>;
  return (
    <ul className="divide-y">
      {items.map(tx => (
        <li key={tx.id} className="py-2 flex justify-between items-center">
          <div>
            <div className="font-medium">{tx.category} — {tx.note || "…"}</div>
            <div className="text-xs text-gray-500">{tx.date} · {tx.account}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-mono ${tx.amount < 0 ? "text-red-600":"text-green-600"}`}>
              {tx.amount.toFixed(2)}
            </span>
            <button onClick={()=>onDelete(tx.id)} className="text-xs border px-2 py-1 rounded">Delete</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
