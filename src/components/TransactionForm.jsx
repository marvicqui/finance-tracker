import { useState } from "react";

export default function TransactionForm({ onCreate }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");

  async function submit(e){
    e.preventDefault();
    const val = Number(amount);
    if (Number.isNaN(val)) return alert("Amount must be a number (use - for expenses)");
    await onCreate({ date, amount: val, category, note, account: "Other" });
    setAmount(""); setNote("");
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 items-end">
      <div className="flex flex-col">
        <label>Date</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded px-2 py-1"/>
      </div>
      <div className="flex flex-col">
        <label>Amount</label>
        <input placeholder="-250.75" value={amount} onChange={e=>setAmount(e.target.value)} className="border rounded px-2 py-1"/>
      </div>
      <div className="flex flex-col">
        <label>Category</label>
        <select value={category} onChange={e=>setCategory(e.target.value)} className="border rounded px-2 py-1">
          <option>Food</option><option>Bills</option><option>Rent</option>
          <option>Transport</option><option>Entertainment</option><option>Other</option>
        </select>
      </div>
      <div className="flex flex-col grow min-w-[200px]">
        <label>Note</label>
        <input value={note} onChange={e=>setNote(e.target.value)} className="border rounded px-2 py-1"/>
      </div>
      <button className="px-3 py-2 border rounded">Add</button>
    </form>
  );
}
