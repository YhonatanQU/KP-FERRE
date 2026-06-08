import { useEffect, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { TrendingUp, TrendingDown, Plus, Calendar } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { createManualCashMovement, fetchCashAccounts, fetchCashMovements, fetchCashSummary } from '../services/finance';
import type { CashAccount, CashMovement } from '../types/finance';

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FlujoCaja() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState<'INGRESO' | 'EGRESO'>('INGRESO');
  const [filtroTipo, setFiltroTipo] = useState<'Todos' | 'INGRESO' | 'EGRESO'>('Todos');
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [summary, setSummary] = useState({
    totalIngresos: 0,
    totalEgresos: 0,
    balanceNeto: 0,
    balanceActual: 0,
  });
  const [form, setForm] = useState({
    accountId: '',
    category: 'OTRO' as 'VENTA' | 'COMPRA' | 'NOMINA' | 'SERVICIO' | 'OTRO',
    amount: '',
    description: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [accountsData, summaryData] = await Promise.all([
        fetchCashAccounts(),
        fetchCashSummary(),
      ]);
      const type = filtroTipo === 'Todos' ? undefined : filtroTipo;
      const movementsData = await fetchCashMovements({ type });

      setAccounts(accountsData);
      setMovements(movementsData);
      setSummary({
        totalIngresos: toNumber(summaryData.totalIngresos),
        totalEgresos: toNumber(summaryData.totalEgresos),
        balanceNeto: toNumber(summaryData.balanceNeto),
        balanceActual: toNumber(summaryData.balanceActual),
      });
      if (!form.accountId && accountsData.length > 0) {
        setForm((prev) => ({ ...prev, accountId: accountsData[0].id }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar flujo de caja';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [filtroTipo]);

  const rows = movements.map((item) => ({
    id: item.id,
    fecha: formatDate(item.movementDate),
    tipo: item.movementType === 'INGRESO' ? 'Ingreso' : 'Egreso',
    descripcion: item.description,
    categoria: item.category,
    metodo: item.account?.name ?? '-',
    monto: item.movementType === 'INGRESO' ? toNumber(item.amount) : -toNumber(item.amount),
    balance: toNumber(item.runningBalance),
  }));

  const dailyMap = new Map<string, { ingresos: number; egresos: number; neto: number }>();
  rows.forEach((row) => {
    const day = row.fecha.split(',')[0] ?? row.fecha;
    const current = dailyMap.get(day) ?? { ingresos: 0, egresos: 0, neto: 0 };
    if (row.monto >= 0) current.ingresos += row.monto;
    else current.egresos += Math.abs(row.monto);
    current.neto = current.ingresos - current.egresos;
    dailyMap.set(day, current);
  });
  const flujoDiarioData = Array.from(dailyMap.entries()).slice(0, 7).map(([dia, values]) => ({
    dia,
    ingresos: values.ingresos,
    egresos: values.egresos,
    neto: values.neto,
  })).reverse();

  const columns = [
    { key: 'fecha', label: 'Fecha/Hora', sortable: true },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (value: string) => (
        <span className={`flex items-center gap-1 ${value === 'Ingreso' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {value === 'Ingreso' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {value}
        </span>
      )
    },
    { key: 'descripcion', label: 'Descripción' },
    {
      key: 'categoria',
      label: 'Categoría',
      render: (value: string) => (
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-900 dark:text-white">
          {value}
        </span>
      )
    },
    { key: 'metodo', label: 'Cuenta' },
    {
      key: 'monto',
      label: 'Monto',
      sortable: true,
      render: (value: number) => (
        <span className={`font-semibold ${value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {value > 0 ? '+' : ''}S/ {value.toFixed(2)}
        </span>
      )
    },
    {
      key: 'balance',
      label: 'Balance',
      sortable: true,
      render: (value: number) => (
        <span className="font-bold text-blue-600 dark:text-blue-400">
          S/ {value.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
        </span>
      )
    },
  ];

  const handleCreateMovement = async () => {
    if (!form.accountId || !form.description.trim() || toNumber(form.amount) <= 0) {
      toast.error('Completa cuenta, descripción y monto');
      return;
    }

    setIsSaving(true);
    try {
      await createManualCashMovement({
        accountId: form.accountId,
        movementType: tipoMovimiento,
        category: form.category,
        description: form.description.trim(),
        amount: toNumber(form.amount),
      });
      toast.success('Movimiento registrado');
      setShowModal(false);
      setForm((prev) => ({ ...prev, amount: '', description: '' }));
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo registrar movimiento';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Flujo de Caja</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Control de ingresos y egresos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Registrar Movimiento
        </button>
      </div>

      {loading && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">Cargando flujo de caja...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Error: {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Ingresos</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">S/ {summary.totalIngresos.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Egresos</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">S/ {summary.totalEgresos.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Balance Neto</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">S/ {summary.balanceNeto.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Balance Actual</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">S/ {summary.balanceActual.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Flujo Diario</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={flujoDiarioData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="dia" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} name="Ingresos" />
              <Line type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={2} name="Egresos" />
              <Line type="monotone" dataKey="neto" stroke="#3b82f6" strokeWidth={2} name="Neto" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Comparativa</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={flujoDiarioData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="dia" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" />
              <Bar dataKey="egresos" fill="#ef4444" name="Egresos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros:</span>
          </div>
          <div className="flex gap-2">
            {(['Todos', 'INGRESO', 'EGRESO'] as const).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFiltroTipo(tipo)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  filtroTipo === tipo
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {tipo === 'Todos' ? 'Todos' : tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DataTable columns={columns} data={rows} searchPlaceholder="Buscar movimientos..." />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Registrar Movimiento de Caja</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setTipoMovimiento('INGRESO')} className={`p-4 border-2 rounded-lg ${tipoMovimiento === 'INGRESO' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'}`}>Ingreso</button>
                  <button onClick={() => setTipoMovimiento('EGRESO')} className={`p-4 border-2 rounded-lg ${tipoMovimiento === 'EGRESO' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700'}`}>Egreso</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cuenta *</label>
                  <select value={form.accountId} onChange={(e) => setForm((prev) => ({ ...prev, accountId: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    {accounts.map((acc) => (<option key={acc.id} value={acc.id}>{acc.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categoría *</label>
                  <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as 'VENTA' | 'COMPRA' | 'NOMINA' | 'SERVICIO' | 'OTRO' }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    <option value="VENTA">VENTA</option>
                    <option value="COMPRA">COMPRA</option>
                    <option value="NOMINA">NOMINA</option>
                    <option value="SERVICIO">SERVICIO</option>
                    <option value="OTRO">OTRO</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Monto *</label>
                <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descripción *</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-6 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">Cancelar</button>
              <button disabled={isSaving} onClick={() => void handleCreateMovement()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">{isSaving ? 'Guardando...' : 'Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
