import { useEffect, useState } from 'react';
import { DollarSign, AlertTriangle, Wallet, ShoppingCart } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchDashboardData } from '../services/finance';
import type { DashboardPayload } from '../types/finance';
import { toast } from 'sonner';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardPayload>({
    kpis: {
      ventasDelDia: 0,
      ingresosMensuales: 0,
      productosBajoStock: 0,
      balanceCaja: 0,
    },
    series: [],
    topProducts: [],
    stockBajo: [],
    recentActivity: [],
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await fetchDashboardData();
        setData(payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo cargar dashboard';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Vista general del negocio</p>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Última actualización: {new Date().toLocaleString('es-PE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      {loading && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">Cargando dashboard...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Error: {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Ventas del Día"
          value={`S/ ${data.kpis.ventasDelDia.toLocaleString()}`}
          change="Dato en tiempo real"
          changeType="positive"
          icon={ShoppingCart}
          iconColor="text-blue-600"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
        />
        <KPICard
          title="Ingresos Mensuales"
          value={`S/ ${data.kpis.ingresosMensuales.toLocaleString()}`}
          change="Ventas confirmadas"
          changeType="positive"
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-100 dark:bg-green-900/30"
        />
        <KPICard
          title="Productos Bajo Stock"
          value={String(data.kpis.productosBajoStock)}
          change="Revisar reposición"
          changeType="negative"
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-100 dark:bg-red-900/30"
        />
        <KPICard
          title="Balance de Caja"
          value={`S/ ${data.kpis.balanceCaja.toLocaleString()}`}
          change="Ingreso - egreso"
          changeType="positive"
          icon={Wallet}
          iconColor="text-purple-600"
          iconBg="bg-purple-100 dark:bg-purple-900/30"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ventas vs Compras</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={2} name="Ventas" />
              <Line type="monotone" dataKey="compras" stroke="#8b5cf6" strokeWidth={2} name="Compras" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Productos Más Vendidos</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.topProducts}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="cantidad" fill="#3b82f6" name="Cantidad Vendida" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Distribución de Ventas</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.topProducts}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ nombre, percent }) => `${String(nombre).split(' ')[0]} ${(Number(percent) * 100).toFixed(0)}%`}
                outerRadius={80}
                dataKey="valor"
              >
                {data.topProducts.map((entry, index) => (
                  <Cell key={`cell-${entry.nombre}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Alertas de Stock Bajo</h3>
          <div className="space-y-4">
            {data.stockBajo.length === 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">No hay productos bajo mínimo.</div>
            )}
            {data.stockBajo.map((item) => (
              <div key={item.producto} className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{item.producto}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Mínimo: {item.minimo}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{item.stock}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">en stock</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actividad Reciente</h3>
        <div className="space-y-4">
          {data.recentActivity.map((item, index) => (
            <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${item.color === 'green' ? 'bg-green-500' : item.color === 'blue' ? 'bg-blue-500' : 'bg-red-500'}`} />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{item.tipo}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.descripcion}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {item.monto >= 0 ? '+' : '-'}S/ {Math.abs(item.monto).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">{new Date(item.fecha).toLocaleString('es-PE')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
