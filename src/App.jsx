import React, { useState, useMemo, useEffect } from 'react';
import { getUser, login, logout } from './auth';
import { PlusCircle, Trash2, CreditCard, TrendingUp, TrendingDown, DollarSign, Download, Upload } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTransactions } from './hooks/useTransactions'; // API hacia Azure Functions/Cosmos

const FinanceTracker = () => {
  // === Filtro: por mes o histórico ===
  const [rangeMode, setRangeMode] = useState('month');                 // 'month' | 'all'
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM (default: mes actual)

  // Para pedir datos: si histórico => pasamos "" como month para traer todo
  const queryMonth = rangeMode === 'all' ? '' : month;

  // --- Sesión Entra ID (SWA) ---
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  useEffect(() => {
  (async () => {
    try { setUser(await getUser()); }
    finally { setLoadingUser(false); }
  })();
  }, []);

  if (loadingUser) {
  return <div className="p-6">Cargando sesión…</div>;
  }

  // Si no hay usuario aún, puedes mostrar un loader o un botón de login.
  // Con tu staticwebapp.config.json ya configurado, SWA redirige 401→/login,
  // pero este fallback es útil por si accedes directo a /login o en local.
  if (!user) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Finance Tracker</h1>
        <p className="mb-4">Necesitas iniciar sesión.</p>
        <button onClick={login} className="border px-3 py-2 rounded">
          Entrar con Microsoft
        </button>
      </div>
    );
  }


  // === Datos desde Cosmos vía hook ===
  const userId = user.userId;          // o user.userDetails si prefieres particionar por email
  const { items, loading, error, create, remove } = useTransactions(userId, queryMonth);

  // Helpers para navegar meses
  function fmt(ymDate) { return ymDate.toISOString().slice(0, 7); }
  function addMonths(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, (m - 1) + delta, 1);
    return fmt(d);
  }
  const gotoPrev = () => setMonth(addMonths(month, -1));
  const gotoNext = () => setMonth(addMonths(month, 1));

  // Adaptar items → shape de UI
  const transactions = useMemo(() => {
    return (items || []).map(t => ({
      id: t.id,
      date: t.date,
      type: t.amount < 0 ? 'egreso' : 'ingreso',
      category: t.category,
      amount: Math.abs(t.amount),
      description: t.note ?? ''
    }));
  }, [items]);

  // Estado local de tarjetas (UI)
  const [creditCards, setCreditCards] = useState([
    { id: 1, name: 'Visa Oro', limit: 30000, balance: 15000, cutoffDay: 15, paymentDay: 25 },
    { id: 2, name: 'Mastercard', limit: 20000, balance: 5000, cutoffDay: 10, paymentDay: 20 }
  ]);

  // Form transacción
  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'egreso',
    category: '',
    amount: '',
    description: ''
  });

  // Form tarjeta
  const [newCard, setNewCard] = useState({
    name: '',
    limit: '',
    balance: '',
    cutoffDay: '',
    paymentDay: ''
  });

  const [activeTab, setActiveTab] = useState('dashboard');

  const categories = {
    ingreso: ['Salario', 'Freelance', 'Inversiones', 'Otros'],
    egreso: ['Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Entretenimiento', 'Salud', 'Educación', 'Otros']
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  // Crear en Cosmos
  const addTransaction = async () => {
    const { category, amount, description, date, type } = newTransaction;
    const n = Number(amount);
    if (!category || Number.isNaN(n)) return;

    const signed = type === 'egreso' ? -Math.abs(n) : Math.abs(n);
    await create({ date, amount: signed, category, note: description, account: 'Other' });

    setNewTransaction({
      date: new Date().toISOString().split('T')[0],
      type: 'egreso',
      category: '',
      amount: '',
      description: ''
    });
  };

  // Borrar en Cosmos
  const deleteTransaction = async (id) => { await remove(id); };

  // Export/Import local (import crea transacciones en Cosmos)
  const exportData = () => {
    const data = { transactions, creditCards, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finanzas-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        let ok = 0, fail = 0, errors = [];

        if (Array.isArray(data.transactions)) {
          const chunks = (arr, size) => arr.reduce((a,_,i)=> (i%size? a[a.length-1].push(arr[i]) : a.push([arr[i]]), a), []);
          for (const batch of chunks(data.transactions, 5)) {
            const results = await Promise.allSettled(batch.map(tx => {
              const signed = tx.type === 'egreso' ? -Math.abs(Number(tx.amount)) : Math.abs(Number(tx.amount));
              return create({
                date: tx.date,
                amount: signed,
                category: tx.category,
                note: tx.description ?? '',
                account: 'Other'
              });
            }));
            results.forEach(r => r.status === 'fulfilled' ? ok++ : (fail++, errors.push(String(r.reason))));
          }
        }
        if (Array.isArray(data.creditCards)) setCreditCards(data.creditCards);

        alert(`Importación completada. Éxitos: ${ok}, Fallos: ${fail}`);
      } catch (err) {
        console.error(err);
        alert('Error al importar datos: ' + String(err));
      }
    };
    reader.readAsText(file);
  };

  // Estadísticas (sobre el rango actualmente cargado)
  const statistics = useMemo(() => {
    const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((sum, t) => sum + t.amount, 0);
    const totalEgresos = transactions.filter(t => t.type === 'egreso').reduce((sum, t) => sum + t.amount, 0);
    const balance = totalIngresos - totalEgresos;

    const egresosPorCategoria = transactions
      .filter(t => t.type === 'egreso')
      .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {});
    const pieData = Object.entries(egresosPorCategoria).map(([name, value]) => ({ name, value }));

    const transactionsByMonth = transactions.reduce((acc, t) => {
      const m = t.date.substring(0, 7);
      if (!acc[m]) acc[m] = { month: m, ingresos: 0, egresos: 0 };
      if (t.type === 'ingreso') acc[m].ingresos += t.amount;
      else acc[m].egresos += t.amount;
      return acc;
    }, {});
    const lineData = Object.values(transactionsByMonth).sort((a, b) => a.month.localeCompare(b.month));

    const totalCreditLimit = creditCards.reduce((sum, c) => sum + c.limit, 0);
    const totalCreditUsed = creditCards.reduce((sum, c) => sum + c.balance, 0);
    const creditAvailable = totalCreditLimit - totalCreditUsed;

    return { totalIngresos, totalEgresos, balance, pieData, lineData, totalCreditLimit, totalCreditUsed, creditAvailable };
  }, [transactions, creditCards]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 flex items-center gap-3">
            <DollarSign className="text-green-600" size={40} />
            Control de Finanzas Personales
          </h1>
          <div className="flex gap-2">
            <button onClick={exportData} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              <Download size={20} />
              Exportar
            </button>
            <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">
              <Upload size={20} />
              Importar
              <input type="file" accept=".json" onChange={importData} className="hidden" />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600 hidden sm:inline">{user.userDetails}</span>
          <button onClick={logout} className="border px-3 py-2 rounded hover:bg-slate-50">
            Cerrar sesión
          </button>
        </div>


        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-slate-300">
          {['dashboard', 'transacciones', 'tarjetas'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Selector de rango (Mes / Histórico) */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={rangeMode}
            onChange={(e)=>setRangeMode(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="month">Por mes</option>
            <option value="all">Histórico total</option>
          </select>

          {rangeMode === 'month' ? (
            <>
              <button onClick={gotoPrev} className="border px-3 py-1 rounded hover:bg-slate-50">&lt;</button>
              <input
                type="month"
                value={month}
                onChange={(e)=>setMonth(e.target.value)}
                className="border rounded px-2 py-1"
              />
              <button onClick={gotoNext} className="border px-3 py-1 rounded hover:bg-slate-50">&gt;</button>
              <span className="text-sm text-slate-500">Mostrando: {month}</span>
            </>
          ) : (
            <span className="text-sm text-slate-500">Mostrando: histórico completo</span>
          )}
        </div>

        {/* Estados de carga/errores (para dashboard/transacciones) */}
        {(activeTab !== 'tarjetas') && (
          <>
            {loading && <p className="text-slate-600 mb-4">Cargando transacciones…</p>}
            {error && <p className="text-red-600 mb-4">Error: {String(error)}</p>}
          </>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Total Ingresos</p>
                    <p className="text-2xl font-bold text-green-600">${statistics.totalIngresos.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="text-green-500" size={32} />
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Total Egresos</p>
                    <p className="text-2xl font-bold text-red-600">${statistics.totalEgresos.toLocaleString()}</p>
                  </div>
                  <TrendingDown className="text-red-500" size={32} />
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Balance</p>
                    <p className={`text-2xl font-bold ${statistics.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      ${statistics.balance.toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="text-blue-500" size={32} />
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">Crédito Disponible</p>
                    <p className="text-2xl font-bold text-purple-600">${statistics.creditAvailable.toLocaleString()}</p>
                  </div>
                  <CreditCard className="text-purple-500" size={32} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Egresos por Categoría</h2>
                {statistics.pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statistics.pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statistics.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 text-center py-12">No hay datos de egresos</p>
                )}
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Historial Mensual</h2>
                {statistics.lineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={statistics.lineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                      <Legend />
                      <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} name="Ingresos" />
                      <Line type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={2} name="Egresos" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 text-center py-12">No hay datos históricos</p>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Estado de Tarjetas de Crédito</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {creditCards.map(card => {
                  const usage = (card.balance / card.limit) * 100;
                  return (
                    <div key={card.id} className="border border-slate-200 rounded-lg p-4">
                      <h3 className="font-bold text-lg mb-2">{card.name}</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Límite:</span>
                          <span className="font-semibold">${card.limit.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Utilizado:</span>
                          <span className="font-semibold text-red-600">${card.balance.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all ${
                              usage > 80 ? 'bg-red-500' : usage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${usage}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-600 flex justify-between">
                          <span>Corte: día {card.cutoffDay}</span>
                          <span>Pago: día {card.paymentDay}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transacciones' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Agregar Transacción</h2>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <input
                  type="date"
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  className="border border-slate-300 rounded-lg px-4 py-2"
                />
                <select
                  value={newTransaction.type}
                  onChange={(e) => setNewTransaction({ ...newTransaction, type: e.target.value, category: '' })}
                  className="border border-slate-300 rounded-lg px-4 py-2"
                >
                  <option value="egreso">Egreso</option>
                  <option value="ingreso">Ingreso</option>
                </select>
                <select
                  value={newTransaction.category}
                  onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                  className="border border-slate-300 rounded-lg px-4 py-2"
                >
                  <option value="">Categoría</option>
                  {categories[newTransaction.type].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Monto"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  className="border border-slate-300 rounded-lg px-4 py-2"
                />
                <input
                  type="text"
                  placeholder="Descripción"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  className="border border-slate-300 rounded-lg px-4 py-2"
                />
                <button
                  onClick={addTransaction}
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <PlusCircle size={20} />
                  Agregar
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Historial de Transacciones</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Categoría</th>
                      <th className="px-4 py-3 text-left">Monto</th>
                      <th className="px-4 py-3 text-left">Descripción</th>
                      <th className="px-4 py-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions
                      .slice()
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map(t => (
                        <tr key={t.id} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="px-4 py-3">{t.date}</td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              t.type === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="px-4 py-3">{t.category}</td>
                          <td className={`px-4 py-3 font-semibold ${t.type === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                            ${t.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{t.description}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => deleteTransaction(t.id)} className="text-red-600 hover:text-red-800">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tarjetas' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Agregar Tarjeta de Crédito</h2>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={newCard.name}
                  onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                  className="border border-slate-300 rounded-lg px-4 py-2"
                />
                <input
                  type="number"
                  placeholder="Límite"
                  value={newCard.limit}
                  onChange={(e) => setNewCard({ ...newCard, limit: e.target.value })}
                  className="border border-slate-300 rounded-lg px-4 py-2"
                />
                <input
                  type="number"
                  placeholder="Saldo usado"
                  value={newCard.balance}
                  onChange={(e) => setNewCard({ ...newCard, balance: e.target.value })}
                  className="border border-slate-300 rounded-lg px-4 py-2"
                />
                <input
                  type="number"
                  placeholder="Día de corte"
                  min="1"
                  max="31"
                  value={newCard.cutoffDay}
                  onChange={(e) => setNewCard({ ...newCard, cutoffDay: e.target.value })}
                  className="border border-slate-300 rounded-lg px-4 py-2"
                />
                <input
                  type="number"
                  placeholder="Día de pago"
                  min="1"
                  max="31"
                  value={newCard.paymentDay}
                  onChange={(e) => setNewCard({ ...newCard, paymentDay: e.target.value })}
                  className="border border-slate-300 rounded-lg px-4 py-2"
                />
                <button
                  onClick={() => {
                    if (newCard.name && newCard.limit) {
                      setCreditCards(prev => ([
                        ...prev,
                        {
                          id: Date.now(),
                          name: newCard.name,
                          limit: parseFloat(newCard.limit),
                          balance: parseFloat(newCard.balance) || 0,
                          cutoffDay: parseInt(newCard.cutoffDay),
                          paymentDay: parseInt(newCard.paymentDay)
                        }
                      ]));
                      setNewCard({ name: '', limit: '', balance: '', cutoffDay: '', paymentDay: '' });
                    }
                  }}
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <PlusCircle size={20} />
                  Agregar
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Mis Tarjetas de Crédito</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {creditCards.map(card => {
                  const usage = (card.balance / card.limit) * 100;
                  const available = card.limit - card.balance;
                  return (
                    <div key={card.id} className="border-2 border-slate-200 rounded-xl p-6 bg-gradient-to-br from-slate-700 to-slate-900 text-white relative">
                      <button onClick={() => setCreditCards(prev => prev.filter(c => c.id !== card.id))}
                              className="absolute top-2 right-2 text-red-400 hover:text-red-300">
                        <Trash2 size={18} />
                      </button>
                      <div className="mb-4">
                        <CreditCard size={32} className="mb-2" />
                        <h3 className="text-xl font-bold">{card.name}</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">Límite total:</span>
                          <span className="font-semibold">${card.limit.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">Utilizado:</span>
                          <span className="font-semibold text-red-300">${card.balance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">Disponible:</span>
                          <span className="font-semibold text-green-300">${available.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-slate-600 rounded-full h-2 mt-3">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              usage > 80 ? 'bg-red-400' : usage > 50 ? 'bg-yellow-400' : 'bg-green-400'
                            }`}
                            style={{ width: `${usage}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-400 flex justify-between mt-3 pt-3 border-t border-slate-600">
                          <span>Corte: día {card.cutoffDay}</span>
                          <span>Pago: día {card.paymentDay}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceTracker;
