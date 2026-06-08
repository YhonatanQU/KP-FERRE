import { useEffect, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { TrendingUp, TrendingDown, AlertTriangle, Edit, History } from 'lucide-react';
import { toast } from 'sonner';
import { createInventoryAdjustment, fetchInventoryMovements, fetchInventoryStock } from '../services/inventory';
import type { InventoryMovement, InventoryStockItem } from '../types/inventory';

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

function mapMovementLabel(movementType: string) {
  if (movementType === 'ENTRADA' || movementType === 'AJUSTE_POSITIVO') return 'Entrada';
  if (movementType === 'SALIDA' || movementType === 'AJUSTE_NEGATIVO') return 'Salida';
  return movementType;
}

export function Inventario() {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMovimientosModal, setShowMovimientosModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState<InventoryStockItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [adjustmentStock, setAdjustmentStock] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');

  const loadStock = async () => {
    const data = await fetchInventoryStock();
    setProducts(data);
  };

  const loadMovements = async (productId?: string) => {
    const data = await fetchInventoryMovements(productId);
    setMovements(data);
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadStock(), loadMovements()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar inventario';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const getStockStatus = (stock: number, minimo: number, maximo: number) => {
    if (stock < minimo) return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Critico' };
    if (stock < minimo * 1.5) return { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Bajo' };
    if (stock > maximo * 0.8) return { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Alto' };
    return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Normal' };
  };

  const rows = products.map((item) => ({
    id: item.id,
    codigo: item.sku,
    nombre: item.name,
    categoria: item.category?.name ?? 'Sin categoria',
    stock: item.stockCurrent,
    minimo: item.stockMin,
    maximo: item.stockMax,
    costo: toNumber(item.costPrice),
    precio: toNumber(item.salePrice),
    ubicacion: item.locationCode ?? '-',
  }));

  const columns = [
    {
      key: 'codigo',
      label: 'Codigo',
      sortable: true,
      width: 'w-28',
      render: (value: string) => (
        <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">{value}</span>
      )
    },
    { key: 'nombre', label: 'Producto', sortable: true },
    { key: 'categoria', label: 'Categoria', sortable: true },
    {
      key: 'stock',
      label: 'Stock Actual',
      sortable: true,
      render: (value: number, row: any) => {
        const status = getStockStatus(value, row.minimo, row.maximo);
        return (
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded ${status.bg} ${status.color} font-semibold`}>
              {value}
            </span>
            {value < row.minimo && <AlertTriangle className="w-4 h-4 text-red-500" />}
          </div>
        );
      }
    },
    {
      key: 'minimo',
      label: 'Stock Min.',
      sortable: true,
      render: (value: number) => <span className="text-gray-600 dark:text-gray-400">{value}</span>
    },
    {
      key: 'ubicacion',
      label: 'Ubicacion',
      render: (value: string) => (
        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-900 dark:text-white">
          {value}
        </span>
      )
    },
    {
      key: 'costo',
      label: 'Costo',
      sortable: true,
      render: (value: number) => <span className="text-gray-900 dark:text-white">S/ {value.toFixed(2)}</span>
    },
    {
      key: 'precio',
      label: 'Precio Venta',
      sortable: true,
      render: (value: number) => <span className="font-semibold text-gray-900 dark:text-white">S/ {value.toFixed(2)}</span>
    },
    {
      key: 'id',
      label: 'Acciones',
      render: (_value: any, row: any) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedProduct(row);
              setAdjustmentStock(String(row.stock));
              setAdjustmentNote('');
              setShowEditModal(true);
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="Ajustar stock"
          >
            <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedProduct(row);
              void loadMovements(row.id);
              setShowMovimientosModal(true);
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="Ver kardex"
          >
            <History className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </button>
        </div>
      )
    },
  ];

  const movimientosRows = movements.map((mov) => ({
    id: mov.id,
    fecha: formatDate(mov.createdAt),
    tipo: mapMovementLabel(mov.movementType),
    producto: mov.product.name,
    cantidad: mov.qty,
    referencia: mov.referenceType + (mov.referenceId ? ` (${mov.referenceId.slice(0, 8)})` : ''),
    responsable: mov.createdBy?.name ?? 'Sistema',
  }));

  const movimientosColumns = [
    { key: 'fecha', label: 'Fecha/Hora', sortable: true },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (value: string) => (
        <span className={`flex items-center gap-1 ${value === 'Entrada' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {value === 'Entrada' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {value}
        </span>
      )
    },
    { key: 'producto', label: 'Producto' },
    { key: 'cantidad', label: 'Cantidad', sortable: true },
    { key: 'referencia', label: 'Referencia' },
    { key: 'responsable', label: 'Responsable' },
  ];

  const stockCritico = rows.filter((item) => item.stock < item.minimo).length;
  const stockBajo = rows.filter((item) => item.stock >= item.minimo && item.stock < item.minimo * 1.5).length;
  const valorInventario = rows.reduce((sum, item) => sum + (item.costo * item.stock), 0);

  const handleSaveAdjustment = async () => {
    if (!selectedProduct) return;

    const current = Number(selectedProduct.stock);
    const target = Number(adjustmentStock);
    if (!Number.isFinite(target) || target < 0) {
      toast.error('Ingresa un stock valido');
      return;
    }

    const delta = target - current;
    if (delta === 0) {
      toast.info('No hay cambios en stock');
      setShowEditModal(false);
      return;
    }

    setIsSaving(true);
    try {
      await createInventoryAdjustment({
        productId: selectedProduct.id,
        movementType: delta > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO',
        qty: Math.abs(delta),
        notes: adjustmentNote || 'Ajuste manual desde UI',
      });
      toast.success('Stock ajustado correctamente');
      setShowEditModal(false);
      await Promise.all([loadStock(), loadMovements(selectedProduct.id)]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo ajustar stock';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventario</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Control de stock en tiempo real</p>
        </div>
        <button
          onClick={() => {
            setSelectedProduct(null);
            void loadMovements();
            setShowMovimientosModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <History className="w-4 h-4" />
          Ver Movimientos
        </button>
      </div>

      {loading && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          Cargando inventario...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Error al cargar inventario: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Productos</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{rows.length}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">En catalogo</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Stock Critico</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stockCritico}</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">Requieren reposicion</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Stock Bajo</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stockBajo}</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Proximos a minimo</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Valor Inventario</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">S/ {valorInventario.toLocaleString()}</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Costo total</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar por codigo, nombre, categoria..."
      />

      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ajustar Stock - {selectedProduct.nombre}</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Stock Actual
                  </label>
                  <input
                    type="number"
                    value={selectedProduct.stock}
                    disabled
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nuevo Stock
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={adjustmentStock}
                    onChange={(e) => setAdjustmentStock(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Observaciones
                </label>
                <textarea
                  rows={3}
                  value={adjustmentNote}
                  onChange={(e) => setAdjustmentNote(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Motivo del ajuste..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              >
                Cancelar
              </button>
              <button
                disabled={isSaving}
                onClick={() => void handleSaveAdjustment()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Guardando...' : 'Guardar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMovimientosModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedProduct ? `Kardex - ${selectedProduct.nombre}` : 'Movimientos de Inventario'}
              </h2>
              <button
                onClick={() => {
                  setShowMovimientosModal(false);
                  setSelectedProduct(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <DataTable
                columns={movimientosColumns}
                data={movimientosRows}
                searchPlaceholder="Buscar movimientos..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
