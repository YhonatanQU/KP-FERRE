import { useEffect, useState, useRef } from 'react';
import {
  FileText, Download, TrendingUp, Users, Package,
  ChevronDown, Table2, PieChart as PieIcon, BarChart2,
  CreditCard,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { toast } from 'sonner';
import { fetchReportsOverview, fetchDailyReport } from '../services/reports';
import type { ReportsOverview, DailyReport } from '../types/reports';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
const PAYMENT_COLORS: Record<string, string> = {
  Yape: '#6d28d9',
  Plin: '#0ea5e9',
  Efectivo: '#10b981',
  Transferencia: '#f59e0b',
  Tarjeta: '#3b82f6',
  Mixto: '#ec4899',
  Crédito: '#ef4444',
};

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function escapeCell(value: string | number): string {
  const str = String(value);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function buildCSV(rows: (string | number)[][]): string {
  return rows.map(row => row.map(escapeCell).join(',')).join('\r\n');
}

function downloadCSV(filename: string, csv: string) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildSummaryCSV(data: ReportsOverview, daily: DailyReport): string {
  const latest = daily.daily.at(-1) ?? { fecha: '-', ventas: 0, compras: 0 };
  return buildCSV([
    ['Indicador', 'Valor'],
    ['Ventas del Mes (S/)', data.summary.totalSalesMonth],
    ['Compras del Mes (S/)', data.summary.totalPurchasesMonth],
    ['Ventas Diarias (S/)', latest.ventas],
    ['Compras Diarias (S/)', latest.compras],
  ]);
}

function buildSalesByMonthCSV(data: ReportsOverview): string {
  return buildCSV([
    ['Mes', 'Ventas (S/)', 'Meta (S/)'],
    ...data.salesByMonth.map(r => [r.mes, r.ventas, r.meta]),
  ]);
}

function buildSalesByCategoryCSV(data: ReportsOverview): string {
  return buildCSV([
    ['Categoría', 'Valor (S/)'],
    ...data.salesByCategory.map(r => [r.categoria, r.valor]),
  ]);
}

function buildTopClientsCSV(data: ReportsOverview): string {
  return buildCSV([
    ['#', 'Cliente', 'Total Facturado (S/)'],
    ...data.topClients.map((r, i) => [i + 1, r.cliente, r.total]),
  ]);
}

function buildDailyCSV(daily: DailyReport): string {
  return buildCSV([
    ['Fecha', 'Ventas (S/)', 'Compras (S/)'],
    ...daily.daily.map(r => [r.fecha, r.ventas, r.compras]),
  ]);
}

function buildPaymentMethodsCSV(daily: DailyReport): string {
  return buildCSV([
    ['Forma de Pago', 'Total (S/)', 'Cantidad'],
    ...daily.paymentMethods.map(r => [r.metodo, r.total, r.cantidad]),
  ]);
}

function buildAllCSV(data: ReportsOverview, daily: DailyReport): string {
  const sections = [
    ['=== RESUMEN GENERAL ===', ...buildSummaryCSV(data, daily).split('\r\n')],
    ['', '=== VENTAS POR MES ===', ...buildSalesByMonthCSV(data).split('\r\n')],
    ['', '=== VENTAS POR CATEGORÍA ===', ...buildSalesByCategoryCSV(data).split('\r\n')],
    ['', '=== TOP CLIENTES ===', ...buildTopClientsCSV(data).split('\r\n')],
    ['', '=== VENTAS Y COMPRAS DIARIAS (30 DÍAS) ===', ...buildDailyCSV(daily).split('\r\n')],
    ['', '=== FORMAS DE PAGO ===', ...buildPaymentMethodsCSV(daily).split('\r\n')],
  ];
  return sections.flat().join('\r\n');
}

// ─── Export dropdown ──────────────────────────────────────────────────────────

function ExportDropdown({
  data,
  daily,
  disabled,
}: {
  data: ReportsOverview;
  daily: DailyReport;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const options = [
    { label: 'Resumen General', icon: <Table2 className="w-4 h-4" />, file: 'resumen_general.csv', build: () => buildSummaryCSV(data, daily) },
    { label: 'Ventas por Mes', icon: <BarChart2 className="w-4 h-4" />, file: 'ventas_por_mes.csv', build: () => buildSalesByMonthCSV(data) },
    { label: 'Ventas por Categoría', icon: <PieIcon className="w-4 h-4" />, file: 'ventas_por_categoria.csv', build: () => buildSalesByCategoryCSV(data) },
    { label: 'Top Clientes', icon: <Users className="w-4 h-4" />, file: 'top_clientes.csv', build: () => buildTopClientsCSV(data) },
    { label: 'Ventas y Compras Diarias', icon: <TrendingUp className="w-4 h-4" />, file: 'ventas_compras_diarias.csv', build: () => buildDailyCSV(daily) },
    { label: 'Formas de Pago', icon: <CreditCard className="w-4 h-4" />, file: 'formas_de_pago.csv', build: () => buildPaymentMethodsCSV(daily) },
  ];

  const handle = (file: string, build: () => string) => {
    try { downloadCSV(file, build()); toast.success(`Exportado: ${file}`); }
    catch { toast.error('No se pudo exportar'); }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 select-none"
      >
        <Download className="w-4 h-4" />
        Exportar
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-60 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="py-1">
            <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Por sección</p>
            {options.map(opt => (
              <button
                key={opt.file}
                onClick={() => handle(opt.file, opt.build)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <span className="text-gray-400">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 py-1">
            <button
              onClick={() => handle('reporte_completo.csv', () => buildAllCSV(data, daily))}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
            >
              <FileText className="w-4 h-4" />
              Exportar Todo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  title,
  onExport,
  disabled,
  children,
}: {
  title: string;
  onExport: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <button
          disabled={disabled}
          onClick={onExport}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-40"
          title="Exportar CSV"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-gray-700 dark:text-gray-200 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">S/ {p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EMPTY_DAILY: DailyReport = { daily: [], paymentMethods: [] };

export function Reportes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<ReportsOverview>({
    summary: { totalSalesMonth: 0, totalPurchasesMonth: 0, totalProducts: 0, totalClients: 0 },
    salesByMonth: [],
    salesByCategory: [],
    topClients: [],
  });
  const [daily, setDaily] = useState<DailyReport>(EMPTY_DAILY);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [overview, dailyData] = await Promise.all([
          fetchReportsOverview(),
          fetchDailyReport(),
        ]);
        setData(overview);
        setDaily(dailyData);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo cargar reportes';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const totalPayments = daily.paymentMethods.reduce((s, r) => s + r.total, 0) || 1;
  const latestDaily = daily.daily.at(-1) ?? { fecha: '-', ventas: 0, compras: 0 };

  const ex = (file: string, build: () => string) => () => {
    try { downloadCSV(file, build()); toast.success(`Exportado: ${file}`); }
    catch { toast.error('No se pudo exportar'); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Análisis y estadísticas del negocio</p>
        </div>
        <ExportDropdown data={data} daily={daily} disabled={loading} />
      </div>

      {loading && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">Cargando reportes...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Error: {error}</div>}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: 'Ventas del Mes', icon: TrendingUp, description: `S/ ${data.summary.totalSalesMonth.toLocaleString()}`, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
          { title: 'Compras del Mes', icon: FileText, description: `S/ ${data.summary.totalPurchasesMonth.toLocaleString()}`, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
          { title: 'Ventas Diarias', icon: BarChart2, description: `S/ ${latestDaily.ventas.toLocaleString()}`, color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
          { title: 'Compras Diarias', icon: CreditCard, description: `S/ ${latestDaily.compras.toLocaleString()}`, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
        ].map((r) => (
          <div key={r.title} className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
            <div className={`w-12 h-12 rounded-lg ${r.color} flex items-center justify-center mb-3`}>
              <r.icon className="w-6 h-6" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-white mb-1">{r.title}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{r.description}</p>
          </div>
        ))}
      </div>

      {/* Ventas y Compras Diarias */}
      <SectionCard
        title="Ventas y Compras Diarias — últimos 30 días"
        onExport={ex('ventas_compras_diarias.csv', () => buildDailyCSV(daily))}
        disabled={loading}
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={daily.daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="fecha"
              tick={{ fontSize: 11 }}
              interval={4}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `S/${(v as number / 1000).toFixed(0)}k`} />
            <Tooltip content={<CurrencyTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={2} dot={false} name="Ventas" />
            <Line type="monotone" dataKey="compras" stroke="#f59e0b" strokeWidth={2} dot={false} name="Compras" />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Formas de Pago */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico torta */}
        <SectionCard
          title="Formas de Pago — mes actual"
          onExport={ex('formas_de_pago.csv', () => buildPaymentMethodsCSV(daily))}
          disabled={loading}
        >
          {daily.paymentMethods.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">Sin ventas confirmadas este mes.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={daily.paymentMethods}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  dataKey="total"
                  nameKey="metodo"
                  label={({ metodo, percent }) => `${metodo} ${(Number(percent) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {daily.paymentMethods.map((row) => (
                    <Cell
                      key={row.metodo}
                      fill={PAYMENT_COLORS[row.metodo] ?? '#6b7280'}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`S/ ${v.toLocaleString()}`, 'Total']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Tabla detalle */}
        <SectionCard
          title="Detalle por Forma de Pago"
          onExport={ex('formas_de_pago.csv', () => buildPaymentMethodsCSV(daily))}
          disabled={loading}
        >
          {daily.paymentMethods.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center">Sin datos.</p>
          ) : (
            <div className="space-y-3">
              {daily.paymentMethods.map((row) => {
                const pct = (row.total / totalPayments) * 100;
                const color = PAYMENT_COLORS[row.metodo] ?? '#6b7280';
                return (
                  <div key={row.metodo}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.metodo}</span>
                        <span className="text-xs text-gray-400">{row.cantidad} {row.cantidad === 1 ? 'venta' : 'ventas'}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">S/ {row.total.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 ml-2">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Ventas vs Meta mensual + por Categoría */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Ventas vs Meta — por mes"
          onExport={ex('ventas_por_mes.csv', () => buildSalesByMonthCSV(data))}
          disabled={loading}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.salesByMonth}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend />
              <Bar dataKey="ventas" fill="#3b82f6" name="Ventas Reales" radius={[4, 4, 0, 0]} />
              <Bar dataKey="meta" fill="#e5e7eb" name="Meta" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard
          title="Ventas por Categoría"
          onExport={ex('ventas_por_categoria.csv', () => buildSalesByCategoryCSV(data))}
          disabled={loading}
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.salesByCategory}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ categoria, percent }) => `${categoria} ${(Number(percent) * 100).toFixed(0)}%`}
                outerRadius={100}
                dataKey="valor"
              >
                {data.salesByCategory.map((entry, index) => (
                  <Cell key={`cell-${entry.categoria}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`S/ ${v.toLocaleString()}`, 'Total']} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Top Clientes */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top 5 Clientes por Facturación</h3>
          <button
            disabled={loading}
            onClick={ex('top_clientes.csv', () => buildTopClientsCSV(data))}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-40"
            title="Exportar CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {data.topClients.map((cliente, index) => {
            const maxTotal = Math.max(...data.topClients.map(c => c.total), 1);
            const percentage = (cliente.total / maxTotal) * 100;
            return (
              <div key={cliente.cliente} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                      {index + 1}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{cliente.cliente}</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">S/ {cliente.total.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${percentage}%`, backgroundColor: COLORS[index % COLORS.length] }} />
                </div>
              </div>
            );
          })}
          {data.topClients.length === 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">No hay datos de facturación aún.</p>
          )}
        </div>
      </div>
    </div>
  );
}
