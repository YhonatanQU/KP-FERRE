import { useEffect, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { Plus, CheckCircle, XCircle, Eye, Edit, Trash2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  confirmPurchase,
  createPurchase,
  deletePurchase,
  fetchProductsForPurchase,
  fetchPurchaseById,
  fetchPurchaseList,
  fetchSuppliers,
  updatePurchase,
} from '../services/purchases';
import type { Product } from '../types/catalog';
import type { Purchase, Supplier } from '../types/purchase';

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

const IGV_RATE = 18;
const IGV_FACTOR = 1 + IGV_RATE / 100;
const IGV_META_PREFIX = '[[ERP_META:';
const IGV_META_SUFFIX = ']]';

function normalizeUnitCost(
  unitCost: number,
  isIgvExonerated: boolean,
  isPriceWithIgv: boolean,
): number {
  if (isIgvExonerated) return unitCost;
  if (isPriceWithIgv) return unitCost / IGV_FACTOR;
  return unitCost;
}

function encodePurchaseNotes(
  notes: string,
  isIgvExonerated: boolean,
  isPriceWithIgv: boolean,
): string {
  const meta = `${IGV_META_PREFIX}IGV_EXONERATED=${isIgvExonerated ? 1 : 0};PRICE_WITH_IGV=${isPriceWithIgv ? 1 : 0}${IGV_META_SUFFIX}`;
  return notes.trim() ? `${meta}\n${notes.trim()}` : meta;
}

function parsePurchaseNotes(rawNotes: string | null | undefined) {
  const fallback = {
    notes: rawNotes ?? '',
    isIgvExonerated: null as boolean | null,
    isPriceWithIgv: null as boolean | null,
  };

  if (!rawNotes) return fallback;
  const trimmed = rawNotes.trim();
  if (!trimmed.startsWith(IGV_META_PREFIX)) {
    return fallback;
  }

  const suffixIndex = trimmed.indexOf(IGV_META_SUFFIX);
  if (suffixIndex === -1) {
    return fallback;
  }

  const metaContent = trimmed.slice(IGV_META_PREFIX.length, suffixIndex);
  const entries = metaContent.split(';').map((entry) => entry.trim());
  let isIgvExonerated: boolean | null = null;
  let isPriceWithIgv: boolean | null = null;

  entries.forEach((entry) => {
    const [key, value] = entry.split('=');
    if (key === 'IGV_EXONERATED') {
      isIgvExonerated = value === '1';
    }
    if (key === 'PRICE_WITH_IGV') {
      isPriceWithIgv = value === '1';
    }
  });

  const remaining = trimmed.slice(suffixIndex + IGV_META_SUFFIX.length).trim();
  return {
    notes: remaining,
    isIgvExonerated,
    isPriceWithIgv,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-PE');
}

function formatCurrency(value: number) {
  return value.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function mapStatusLabel(value: Purchase['status']) {
  if (value === 'RECEIVED') return 'Completada';
  if (value === 'ORDERED') return 'Pendiente';
  if (value === 'DRAFT') return 'Borrador';
  return 'Cancelada';
}

export function Compras() {
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState('');
  const [notes, setNotes] = useState('');
  const [isIgvExonerated, setIsIgvExonerated] = useState(false);
  const [isPriceWithIgv, setIsPriceWithIgv] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pedidoItems, setPedidoItems] = useState<Array<{ producto: Product; cantidad: number }>>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  const resetPedidoForm = () => {
    setEditingPurchaseId(null);
    setPedidoItems([]);
    setNotes('');
    setProductSearchTerm('');
    setIsIgvExonerated(false);
    setIsPriceWithIgv(false);
    if (suppliers.length > 0) {
      setSelectedProveedor(suppliers[0].id);
    } else {
      setSelectedProveedor('');
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [purchaseData, supplierData, productData] = await Promise.all([
        fetchPurchaseList(),
        fetchSuppliers(),
        fetchProductsForPurchase(),
      ]);
      setPurchases(purchaseData);
      setSuppliers(supplierData);
      setProducts(productData);
      if (!selectedProveedor && supplierData.length > 0) {
        setSelectedProveedor(supplierData[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar compras';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreateModal = () => {
    resetPedidoForm();
    setShowModal(true);
  };

  const openViewPurchase = async (purchaseId: string) => {
    try {
      const detail = await fetchPurchaseById(purchaseId);
      const parsedNotes = parsePurchaseNotes(detail.notes);
      setViewPurchase({
        ...detail,
        notes: parsedNotes.notes,
      });
      setShowViewModal(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el pedido';
      toast.error(message);
    }
  };

  const openEditPurchase = async (purchaseId: string) => {
    try {
      const detail = await fetchPurchaseById(purchaseId);
      if (detail.status === 'RECEIVED') {
        toast.error('No se puede editar una compra confirmada');
        return;
      }

      const mappedItems = detail.items
        .map((item) => {
          const source = item.product;
          const existingProduct = products.find((product) => product.id === item.productId);
          if (existingProduct) {
            return {
              producto: {
                ...existingProduct,
                costPrice: toNumber(item.unitCost),
              },
              cantidad: item.qty,
            };
          }

          if (!source) {
            return null;
          }

          return {
            producto: {
              id: source.id,
              sku: source.sku,
              name: source.name,
              categoryId: source.categoryId,
              brand: null,
              model: null,
              costPrice: toNumber(item.unitCost),
              salePrice: toNumber(source.salePrice),
              stockCurrent: source.stockCurrent,
              stockMin: source.stockMin,
              stockMax: source.stockMax,
              locationCode: null,
              isActive: source.isActive,
            } as Product,
            cantidad: item.qty,
          };
        })
        .filter((item): item is { producto: Product; cantidad: number } => item !== null);

      const parsedNotes = parsePurchaseNotes(detail.notes);
      const fallbackExonerated = detail.items.length > 0 && detail.items.every((item) => toNumber(item.taxPct) === 0);
      const resolvedExonerated = parsedNotes.isIgvExonerated ?? fallbackExonerated;
      const resolvedPriceWithIgv = parsedNotes.isPriceWithIgv ?? false;

      setEditingPurchaseId(detail.id);
      setSelectedProveedor(detail.supplier.id);
      setNotes(parsedNotes.notes);
      setPedidoItems(mappedItems);
      setIsIgvExonerated(resolvedExonerated);
      setIsPriceWithIgv(resolvedExonerated ? false : resolvedPriceWithIgv);
      setShowModal(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el pedido para edición';
      toast.error(message);
    }
  };

  const handleAddProduct = (producto: Product) => {
    const existing = pedidoItems.find((item) => item.producto.id === producto.id);
    if (existing) {
      setPedidoItems(
        pedidoItems.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item,
        ),
      );
    } else {
      setPedidoItems([...pedidoItems, { producto, cantidad: 1 }]);
    }
    toast.success(`${producto.name} agregado al pedido`);
  };

  const filteredProducts = products.filter((producto) => {
    const q = productSearchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      producto.name.toLowerCase().includes(q) ||
      producto.sku.toLowerCase().includes(q) ||
      (producto.brand ?? '').toLowerCase().includes(q) ||
      (producto.model ?? '').toLowerCase().includes(q)
    );
  });

  const handleRemoveProduct = (productoId: string) => {
    setPedidoItems(pedidoItems.filter((item) => item.producto.id !== productoId));
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const taxTotal = calculateTax();
    return subtotal + taxTotal;
  };

  const calculateSubtotal = () => {
    return pedidoItems.reduce((sum, item) => {
      const unitCostInput = toNumber(item.producto.costPrice);
      const unitCost = normalizeUnitCost(unitCostInput, isIgvExonerated, isPriceWithIgv);
      return sum + unitCost * item.cantidad;
    }, 0);
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    if (isIgvExonerated) return 0;

    if (isPriceWithIgv) {
      const totalWithIgv = pedidoItems.reduce(
        (sum, item) => sum + toNumber(item.producto.costPrice) * item.cantidad,
        0,
      );
      return totalWithIgv - subtotal;
    }

    return subtotal * (IGV_RATE / 100);
  };

  const handleSubmitPedido = async () => {
    if (!selectedProveedor) {
      toast.error('Por favor seleccione un proveedor');
      return;
    }
    if (pedidoItems.length === 0) {
      toast.error('Por favor agregue productos al pedido');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        supplierId: selectedProveedor,
        paymentStatus: 'PENDING',
        paymentMethod: 'TRANSFER',
        notes: encodePurchaseNotes(notes, isIgvExonerated, isPriceWithIgv),
        items: pedidoItems.map((item) => ({
          productId: item.producto.id,
          qty: item.cantidad,
          unitCost: Number(
            normalizeUnitCost(
              toNumber(item.producto.costPrice),
              isIgvExonerated,
              isPriceWithIgv,
            ).toFixed(6),
          ),
          discountPct: 0,
          taxPct: isIgvExonerated ? 0 : IGV_RATE,
        })),
      };

      if (editingPurchaseId) {
        await updatePurchase(editingPurchaseId, payload);
        toast.success('Pedido actualizado');
      } else {
        await createPurchase(payload);
        toast.success('Pedido creado exitosamente');
      }

      setShowModal(false);
      resetPedidoForm();
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar el pedido';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmPurchase = async (purchaseId: string) => {
    try {
      await confirmPurchase(purchaseId);
      toast.success('Compra confirmada y registrada en inventario');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo confirmar compra';
      toast.error(message);
    }
  };

  const handleDeletePurchase = async (purchaseId: string, purchaseNumber: string, statusRaw: string) => {
    if (statusRaw === 'RECEIVED') {
      toast.error('No se puede eliminar una compra confirmada');
      return;
    }

    const confirmed = window.confirm(`¿Eliminar el pedido ${purchaseNumber}?`);
    if (!confirmed) return;

    try {
      await deletePurchase(purchaseId);
      toast.success('Pedido eliminado');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el pedido';
      toast.error(message);
    }
  };

  const handlePrintPurchase = (purchase: Purchase) => {
    const rowsHtml = purchase.items
      .map(
        (item) => `
          <tr>
            <td>${item.product?.name ?? item.productId}</td>
            <td style="text-align:right;">${item.qty}</td>
            <td style="text-align:right;">S/ ${formatCurrency(toNumber(item.unitCost))}</td>
            <td style="text-align:right;">S/ ${formatCurrency(toNumber(item.lineTotal))}</td>
          </tr>
        `,
      )
      .join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Pedido ${purchase.number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { margin: 0 0 4px 0; font-size: 20px; }
            p { margin: 0 0 8px 0; }
            .meta { margin: 16px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f4f4f4; text-align: left; }
            .totals { margin-top: 16px; text-align: right; font-size: 14px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Detalle de Pedido ${purchase.number}</h1>
          <p><strong>Fecha:</strong> ${formatDate(purchase.purchaseDate)}</p>
          <p><strong>Proveedor:</strong> ${purchase.supplier?.name ?? '-'}</p>
          <p><strong>RUC:</strong> ${purchase.supplier?.ruc ?? '-'}</p>
          <p><strong>Estado:</strong> ${mapStatusLabel(purchase.status)}</p>
          <div class="meta">
            <p><strong>Observaciones:</strong> ${purchase.notes ?? '-'}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th style="text-align:right;">Cantidad</th>
                <th style="text-align:right;">Costo Unit.</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="totals">Total Pedido: S/ ${formatCurrency(toNumber(purchase.grandTotal))}</div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      toast.error('No se pudo abrir la ventana de impresión. Verifica el bloqueador de ventanas.');
      return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  const rows = purchases.map((item) => ({
    id: item.id,
    codigo: item.number,
    fecha: formatDate(item.purchaseDate),
    proveedor: item.supplier?.name ?? 'Sin proveedor',
    productos: item.items.length,
    total: `S/ ${toNumber(item.grandTotal).toFixed(2)}`,
    estado: mapStatusLabel(item.status),
    statusRaw: item.status,
  }));

  const columns = [
    { key: 'codigo', label: 'ID', sortable: true, width: 'w-32' },
    { key: 'fecha', label: 'Fecha', sortable: true },
    { key: 'proveedor', label: 'Proveedor', sortable: true },
    { key: 'productos', label: 'Productos', sortable: true },
    { key: 'total', label: 'Total', sortable: true },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: string) => {
        const colors = {
          Completada: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
          Pendiente: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
          Borrador: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
          Cancelada: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs ${colors[value as keyof typeof colors] || 'bg-gray-100 text-gray-700'}`}>
            {value}
          </span>
        );
      }
    },
    {
      key: 'id',
      label: 'Acciones',
      render: (_value: string, row: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void openViewPurchase(row.id);
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="Ver pedido"
          >
            <Eye className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void openEditPurchase(row.id);
            }}
            disabled={row.statusRaw === 'RECEIVED'}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={row.statusRaw === 'RECEIVED' ? 'Pedido confirmado: no editable' : 'Editar pedido'}
          >
            <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleDeletePurchase(row.id, row.codigo, row.statusRaw);
            }}
            disabled={row.statusRaw === 'RECEIVED'}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={row.statusRaw === 'RECEIVED' ? 'Pedido confirmado: no eliminable' : 'Eliminar pedido'}
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
          {row.statusRaw === 'RECEIVED' ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              title="Pedido confirmado: solo lectura"
            >
              <Lock className="w-3 h-3" />
              Bloqueado
            </span>
          ) : null}
          {row.statusRaw === 'ORDERED' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleConfirmPurchase(row.id);
              }}
              className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Confirmar
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const comprasMes = purchases.reduce((sum, item) => sum + toNumber(item.grandTotal), 0);
  const pendientes = purchases.filter((item) => item.status === 'ORDERED').length;
  const completadas = purchases.filter((item) => item.status === 'RECEIVED').length;
  const promedio = purchases.length > 0 ? comprasMes / purchases.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compras</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Gestión de compras y pedidos a proveedores</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Pedido
        </button>
      </div>

      {loading && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          Cargando compras...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Error al cargar compras: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Compras Totales</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">S/ {comprasMes.toLocaleString()}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{purchases.length} ordenes</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Pedidos Pendientes</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendientes}</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Por confirmar</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Completadas</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{completadas}</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Con ingreso a stock</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Promedio por Compra</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">S/ {promedio.toLocaleString()}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Histórico</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar por proveedor, ID..."
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingPurchaseId ? 'Editar Pedido a Proveedor' : 'Nuevo Pedido a Proveedor'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetPedidoForm();
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Proveedor *
                </label>
                <select
                  value={selectedProveedor}
                  onChange={(e) => setSelectedProveedor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {suppliers.length === 0 && <option value="">Sin proveedores</option>}
                  {suppliers.map((prov) => (
                    <option key={prov.id} value={prov.id}>
                      {prov.name} - {prov.ruc}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isIgvExonerated}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsIgvExonerated(checked);
                      if (checked) setIsPriceWithIgv(false);
                    }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Exonerar IGV en este pedido</span>
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isPriceWithIgv}
                    disabled={isIgvExonerated}
                    onChange={(e) => setIsPriceWithIgv(e.target.checked)}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    El precio de compra ya incluye IGV
                  </span>
                </label>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isIgvExonerated
                  ? 'IGV desactivado: se registrará sin impuesto.'
                  : isPriceWithIgv
                    ? 'Precio con IGV: IGV = Total - Subtotal (base imponible).'
                    : 'Precio sin IGV: se aplicará IGV de 18% sobre el costo unitario.'}
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Productos Disponibles</h3>
                  <div className="mb-3">
                    <input
                      type="text"
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      placeholder="Buscar producto por nombre, código, marca..."
                      className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div className="space-y-2">
                    {filteredProducts.map((producto) => (
                      <div
                        key={producto.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{producto.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Costo: S/ {toNumber(producto.costPrice).toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAddProduct(producto)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                        >
                          Agregar
                        </button>
                      </div>
                    ))}
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400">No hay productos que coincidan con la búsqueda</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Detalle del Pedido</h3>
                  {pedidoItems.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-gray-500 dark:text-gray-400">No hay productos en el pedido</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pedidoItems.map((item, index) => (
                        <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-medium text-gray-900 dark:text-white">{item.producto.name}</p>
                            <button
                              onClick={() => handleRemoveProduct(item.producto.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs text-gray-600 dark:text-gray-400">Cantidad</label>
                              <input
                                type="number"
                                min="1"
                                value={item.cantidad}
                                onChange={(e) => {
                                  const newCantidad = parseInt(e.target.value, 10) || 1;
                                  setPedidoItems(
                                    pedidoItems.map((pi, i) =>
                                      i === index ? { ...pi, cantidad: newCantidad } : pi,
                                    ),
                                  );
                                }}
                                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 dark:text-gray-400">
                                Costo Unit. {isPriceWithIgv && !isIgvExonerated ? '(incl. IGV)' : ''}
                              </label>
                              <input
                                type="text"
                                value={`S/ ${toNumber(item.producto.costPrice).toFixed(2)}`}
                                disabled
                                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 dark:text-gray-400">Total Línea</label>
                              <input
                                type="text"
                                value={`S/ ${(() => {
                                  const unitInput = toNumber(item.producto.costPrice);
                                  const unitCost = normalizeUnitCost(unitInput, isIgvExonerated, isPriceWithIgv);
                                  const lineSubtotal = unitCost * item.cantidad;
                                  const lineTax = isIgvExonerated
                                    ? 0
                                    : isPriceWithIgv
                                      ? (unitInput * item.cantidad) - lineSubtotal
                                      : lineSubtotal * (IGV_RATE / 100);
                                  return (lineSubtotal + lineTax).toFixed(2);
                                })()}`}
                                disabled
                                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-semibold"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                          <span className="text-gray-900 dark:text-white">S/ {calculateSubtotal().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">IGV ({isIgvExonerated ? '0' : IGV_RATE}%):</span>
                          <span className={isIgvExonerated ? 'text-gray-900 dark:text-white' : 'text-blue-600 dark:text-blue-400'}>
                            S/ {calculateTax().toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-lg">
                          <span className="text-gray-900 dark:text-white">Total del Pedido:</span>
                          <span className="text-blue-600 dark:text-blue-400">S/ {calculateTotal().toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          * Se registrara como egreso al confirmar la compra pagada.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Observaciones (Opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notas adicionales sobre el pedido..."
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetPedidoForm();
                }}
                className="px-6 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              >
                Cancelar
              </button>
              <button
                disabled={isSaving}
                onClick={() => void handleSubmitPedido()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4" />
                {isSaving ? 'Guardando...' : editingPurchaseId ? 'Guardar cambios' : 'Crear Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && viewPurchase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Detalle de Pedido {viewPurchase.number}</h2>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewPurchase(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Proveedor</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{viewPurchase.supplier.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">RUC: {viewPurchase.supplier.ruc}</p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Estado</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{mapStatusLabel(viewPurchase.status)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total: S/ {toNumber(viewPurchase.grandTotal).toFixed(2)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Producto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Cantidad</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Costo Unit.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {viewPurchase.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{item.product?.name ?? item.productId}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{item.qty}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">S/ {toNumber(item.unitCost).toFixed(2)}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">S/ {toNumber(item.lineTotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {viewPurchase.notes ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Observaciones</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{viewPurchase.notes}</p>
                </div>
              ) : null}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button
                onClick={() => handlePrintPurchase(viewPurchase)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Imprimir / PDF
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewPurchase(null);
                }}
                className="px-6 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
