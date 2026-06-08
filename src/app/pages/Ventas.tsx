import { useEffect, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { CheckCircle, Edit, Eye, Lock, Minus, Package, Plus, Search, ShoppingCart, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  confirmSale,
  createQuote,
  createSale,
  deleteSale,
  fetchQuotes,
  fetchProductsForSale,
  fetchClients,
  fetchSaleById,
  fetchSales,
  updateSale,
  confirmQuoteToSale,
} from '../services/sales';
import type { Product } from '../types/catalog';
import type { Client, Sale, Quote, CreateSaleInput } from '../types/sale';

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

const IGV_RATE = 18;
const IGV_FACTOR = 1 + IGV_RATE / 100;
const META_PREFIX = '[[ERP_META:';
const META_SUFFIX = ']]';

type CartItem = { producto: Product; cantidad: number; descuento: number };
type SupportedSalePaymentMethod = 'CASH' | 'YAPE' | 'PLIN' | 'CREDIT';
type CreditMeta = { termDays: number | null; dueDate: string | null };

const SUPPORTED_PAYMENT_METHODS: Array<{ id: SupportedSalePaymentMethod; label: string }> = [
  { id: 'CASH', label: 'Efectivo' },
  { id: 'YAPE', label: 'Yape' },
  { id: 'PLIN', label: 'Plin' },
  { id: 'CREDIT', label: 'Crédito' },
];

function normalizeSupportedPaymentMethod(value: Sale['paymentMethod']): SupportedSalePaymentMethod {
  if (value === 'YAPE' || value === 'PLIN' || value === 'CREDIT') {
    return value;
  }
  return 'CASH';
}

// ─── Local quote helpers (fallback when backend /quotes is unavailable) ───────
type StoredQuote = Quote & { payload: CreateSaleInput; totalValue: number };

function loadLocalQuotes(): StoredQuote[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('localQuotes');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredQuote[];
  } catch {
    return [];
  }
}

function saveLocalQuotes(quotes: StoredQuote[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('localQuotes', JSON.stringify(quotes));
}

function generateLocalQuoteNumber(existing: StoredQuote[]) {
  const today = new Date();
  const prefix = `C${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const seq = existing
    .map(q => q.number)
    .filter(n => n.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)) || 0);
  const next = (seq.length > 0 ? Math.max(...seq) + 1 : 1).toString().padStart(3, '0');
  return `${prefix}${next}`;
}

function mergeQuotes(remote: Quote[], locals: StoredQuote[]): Quote[] {
  const map = new Map<string, Quote>();
  [...locals, ...remote].forEach((q) => {
    map.set(q.id, q);
  });
  return Array.from(map.values());
}

function mapStatusLabel(value: Sale['status']) {
  if (value === 'CONFIRMED') return 'Completada';
  if (value === 'DRAFT') return 'Pendiente';
  return 'Cancelada';
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

function normalizeUnitPrice(unitPrice: number, exonerated: boolean, includesIgv: boolean) {
  if (exonerated) return unitPrice;
  if (includesIgv) return unitPrice / IGV_FACTOR;
  return unitPrice;
}

function encodeNotes(notes: string, exonerated: boolean, includesIgv: boolean, credit: CreditMeta) {
  const meta = `${META_PREFIX}IGV_EXONERATED=${exonerated ? 1 : 0};PRICE_WITH_IGV=${includesIgv ? 1 : 0};CREDIT_TERM=${credit.termDays ?? ''};CREDIT_DUE=${credit.dueDate ?? ''}${META_SUFFIX}`;
  return notes.trim() ? `${meta}\n${notes.trim()}` : meta;
}

function parseNotes(rawNotes: string | null | undefined) {
  const fallback = { notes: rawNotes ?? '', exonerated: null as boolean | null, includesIgv: null as boolean | null, credit: { termDays: null, dueDate: null } as CreditMeta };
  if (!rawNotes) return fallback;
  const trimmed = rawNotes.trim();
  if (!trimmed.startsWith(META_PREFIX)) return fallback;
  const suffixIndex = trimmed.indexOf(META_SUFFIX);
  if (suffixIndex === -1) return fallback;
  const meta = trimmed.slice(META_PREFIX.length, suffixIndex);
  const entries = meta.split(';').map((entry) => entry.trim());
  let exonerated: boolean | null = null;
  let includesIgv: boolean | null = null;
  let termDays: number | null = null;
  let dueDate: string | null = null;
  entries.forEach((entry) => {
    const [key, value] = entry.split('=');
    if (key === 'IGV_EXONERATED') exonerated = value === '1';
    if (key === 'PRICE_WITH_IGV') includesIgv = value === '1';
    if (key === 'CREDIT_TERM') termDays = value ? Number(value) || null : null;
    if (key === 'CREDIT_DUE') dueDate = value || null;
  });
  return {
    notes: trimmed.slice(suffixIndex + META_SUFFIX.length).trim(),
    exonerated,
    includesIgv,
    credit: { termDays, dueDate },
  };
}

export function Ventas() {
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [localQuotes, setLocalQuotes] = useState<StoredQuote[]>(loadLocalQuotes());
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [viewCreditMeta, setViewCreditMeta] = useState<CreditMeta>({ termDays: null, dueDate: null });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<SupportedSalePaymentMethod>('CASH');
  const [selectedClient, setSelectedClient] = useState('');
  const [saleMode, setSaleMode] = useState<'SALE' | 'QUOTE'>('SALE');
  const [saleNotes, setSaleNotes] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isIgvExonerated, setIsIgvExonerated] = useState(false);
  const [isPriceWithIgv, setIsPriceWithIgv] = useState(false);
  const [creditTermDays, setCreditTermDays] = useState(30);
  const [creditDueDate, setCreditDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10);
  });


  const resetForm = () => {
    setEditingSaleId(null);
    setSaleNotes('');
    setCartItems([]);
    setProductSearchTerm('');
    setSelectedClient(clients[0]?.id ?? '');
    setSelectedPaymentMethod('CASH');
    setSaleMode('SALE');
    setIsIgvExonerated(false);
    setIsPriceWithIgv(false);
    setCreditTermDays(30);
    const d = new Date(); d.setDate(d.getDate() + 30); setCreditDueDate(d.toISOString().slice(0, 10));
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [salesRes, productsRes, clientsRes, quotesRes] = await Promise.allSettled([
        fetchSales(),
        fetchProductsForSale(),
        fetchClients(),
        fetchQuotes(),
      ]);

      if (salesRes.status === 'rejected') throw salesRes.reason;
      setSales(salesRes.value);

      if (productsRes.status === 'fulfilled') setProducts(productsRes.value);
      if (clientsRes.status === 'fulfilled') {
        setClients(clientsRes.value);
        if (clientsRes.value.length > 0) setSelectedClient(clientsRes.value[0].id);
      }
      if (quotesRes.status === 'fulfilled') {
        setQuotes(mergeQuotes(quotesRes.value, localQuotes));
      } else {
        setQuotes(localQuotes);
      }

      // merge local quotes fallback already handled
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar ventas';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredProducts = products.filter((product) => {
    const q = productSearchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      product.name.toLowerCase().includes(q) ||
      product.sku.toLowerCase().includes(q) ||
      (product.brand ?? '').toLowerCase().includes(q) ||
      (product.model ?? '').toLowerCase().includes(q)
    );
  });

  const subtotal = cartItems.reduce((sum, item) => {
    const gross = toNumber(item.producto.salePrice) * item.cantidad * (1 - item.descuento / 100);
    if (isIgvExonerated) return sum + gross;
    if (isPriceWithIgv) return sum + gross / IGV_FACTOR;
    return sum + gross;
  }, 0);

  const tax = isIgvExonerated
    ? 0
    : isPriceWithIgv
      ? cartItems.reduce((sum, item) => sum + toNumber(item.producto.salePrice) * item.cantidad * (1 - item.descuento / 100), 0) - subtotal
      : subtotal * (IGV_RATE / 100);

  const total = subtotal + tax;

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleConvertQuote = async (quoteId: string) => {
    try {
      const localQuote = localQuotes.find((q) => q.id === quoteId);
      if (localQuote) {
        await createSale(localQuote.payload);
        const remaining = localQuotes.filter((q) => q.id !== quoteId);
        saveLocalQuotes(remaining);
        setLocalQuotes(remaining);
        setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
        toast.success(`Cotización ${localQuote.number} convertida a venta`);
      } else {
        await confirmQuoteToSale(quoteId);
        toast.success('Cotización convertida a venta');
      }
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo convertir la cotización';
      toast.error(message);
    }
  };

  const handleAddProduct = (producto: Product) => {
    const stockAvailable = toNumber(producto.stockCurrent);
    if (stockAvailable <= 0) {
      toast.error('Este producto no tiene stock disponible');
      return;
    }

    setCartItems((prev) => {
      const existing = prev.find((item) => item.producto.id === producto.id);
      if (existing) {
        return prev.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: Math.min(item.cantidad + 1, stockAvailable) }
            : item,
        );
      }
      return [...prev, { producto, cantidad: 1, descuento: 0 }];
    });
    toast.success(`${producto.name} agregado al carrito`);
  };

  const handleRemoveProduct = (productoId: string) => {
    setCartItems((prev) => prev.filter((item) => item.producto.id !== productoId));
  };

  const openViewSale = async (saleId: string) => {
    try {
      const detail = await fetchSaleById(saleId);
      const parsed = parseNotes(detail.notes);
      setViewSale({ ...detail, notes: parsed.notes });
      setViewCreditMeta(parsed.credit);
      setShowViewModal(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar la venta';
      toast.error(message);
    }
  };

  const openEditSale = async (saleId: string) => {
    try {
      const detail = await fetchSaleById(saleId);
      if (detail.status === 'CONFIRMED') {
        toast.error('No se puede editar una venta confirmada');
        return;
      }

      const parsed = parseNotes(detail.notes);
      const fallbackExonerated = detail.items.length > 0 && detail.items.every((item) => toNumber(item.taxPct) === 0);
      const resolvedExonerated = parsed.exonerated ?? fallbackExonerated;
      const resolvedIncludesIgv = parsed.includesIgv ?? false;

      const mappedItems = detail.items
        .map((item) => {
          const source = item.product;
          const existing = products.find((p) => p.id === item.productId);
          const basePrice = toNumber(item.unitPrice);
          const displayPrice = !resolvedExonerated && resolvedIncludesIgv ? basePrice * IGV_FACTOR : basePrice;

          const candidate = existing ?? (source ? {
            id: source.id,
            sku: source.sku,
            name: source.name,
            categoryId: source.categoryId,
            brand: null,
            model: null,
            costPrice: toNumber(source.costPrice),
            salePrice: toNumber(source.salePrice),
            stockCurrent: source.stockCurrent,
            stockMin: source.stockMin,
            stockMax: source.stockMax,
            locationCode: null,
            isActive: source.isActive,
          } as Product : null);

          if (!candidate) return null;
          return {
            producto: { ...candidate, salePrice: displayPrice },
            cantidad: item.qty,
            descuento: toNumber(item.discountPct),
          };
        })
        .filter((item): item is CartItem => item !== null);

      setEditingSaleId(detail.id);
      setSaleMode('SALE');
      setSelectedClient(detail.client?.id ?? clients[0]?.id ?? '');
      setSelectedPaymentMethod(normalizeSupportedPaymentMethod(detail.paymentMethod));
      setSaleNotes(parsed.notes);
      setIsIgvExonerated(resolvedExonerated);
      setIsPriceWithIgv(resolvedExonerated ? false : resolvedIncludesIgv);
      if (parsed.credit.termDays) setCreditTermDays(parsed.credit.termDays);
      if (parsed.credit.dueDate) setCreditDueDate(parsed.credit.dueDate);
      setCartItems(mappedItems);
      setShowModal(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar la venta para edición';
      toast.error(message);
    }
  };

  const submitSale = async () => {
    const resolvedClientId = selectedClient || clients[0]?.id;
    if (!resolvedClientId) {
      toast.error('No hay clientes disponibles para registrar la venta');
      return;
    }
    if (cartItems.length === 0) {
      toast.error('Por favor agregue productos a la venta');
      return;
    }

    setIsSaving(true);
    try {
      const creditMeta: CreditMeta = selectedPaymentMethod === 'CREDIT'
        ? { termDays: creditTermDays, dueDate: creditDueDate }
        : { termDays: null, dueDate: null };

      const payload = {
        clientId: resolvedClientId,
        paymentStatus: selectedPaymentMethod === 'CREDIT' ? 'PENDING' as const : 'PAID' as const,
        paymentMethod: selectedPaymentMethod,
        notes: encodeNotes(saleNotes, isIgvExonerated, isPriceWithIgv, creditMeta),
        items: cartItems.map((item) => ({
          productId: item.producto.id,
          qty: item.cantidad,
          unitPrice: Number(
            normalizeUnitPrice(
              toNumber(item.producto.salePrice),
              isIgvExonerated,
              isPriceWithIgv,
            ).toFixed(6),
          ),
          discountPct: item.descuento,
          taxPct: isIgvExonerated ? 0 : IGV_RATE,
        })),
      };

      if (editingSaleId) {
        await updateSale(editingSaleId, payload);
        toast.success('Venta actualizada');
      } else {
        if (saleMode === 'QUOTE') {
          const locals = loadLocalQuotes();
          const buildLocal = (): StoredQuote => ({
            id: `local-${crypto.randomUUID()}`,
            number: generateLocalQuoteNumber(locals),
            status: 'DRAFT',
            client: clients.find(c => c.id === resolvedClientId) ?? null,
            notes: payload.notes,
            createdAt: new Date().toISOString(),
            items: [],
            grandTotal: total,
            payload,
            totalValue: total,
          });

          try {
            const quote = await createQuote(payload);
            const stored = { ...buildLocal(), id: quote.id, number: quote.number ?? buildLocal().number };
            const updatedLocals = [stored, ...locals];
            saveLocalQuotes(updatedLocals);
            setLocalQuotes(updatedLocals);
            setQuotes((prev) => mergeQuotes(prev, updatedLocals));
            toast.success(`Cotización creada: ${stored.number}`);
          } catch (err) {
            const localQuote = buildLocal();
            const updated = [localQuote, ...locals];
            saveLocalQuotes(updated);
            setLocalQuotes(updated);
            setQuotes((prev) => mergeQuotes(prev, updated));
            toast.success(`Cotización local creada: ${localQuote.number}`);
          }
        } else {
          await createSale(payload);
          toast.success('Venta creada correctamente');
        }
      }

      setShowModal(false);
      resetForm();
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar la venta';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmSale = async (saleId: string) => {
    try {
      await confirmSale(saleId);
      toast.success('Venta confirmada y registrada en inventario/caja');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo confirmar venta';
      toast.error(message);
    }
  };

  const handleDeleteSale = async (saleId: string, saleNumber: string, status: string) => {
    if (status === 'CONFIRMED') {
      toast.error('No se puede eliminar una venta confirmada');
      return;
    }
    const confirmed = window.confirm(`¿Eliminar la venta ${saleNumber}?`);
    if (!confirmed) return;
    try {
      await deleteSale(saleId);
      toast.success('Venta eliminada');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar la venta';
      toast.error(message);
    }
  };

  const handlePrintSale = (sale: Sale) => {
    const rowsHtml = sale.items
      .map(
        (item) => `
          <tr>
            <td>${item.product?.name ?? item.productId}</td>
            <td style="text-align:right;">${item.qty}</td>
            <td style="text-align:right;">S/ ${formatCurrency(toNumber(item.unitPrice))}</td>
            <td style="text-align:right;">S/ ${formatCurrency(toNumber(item.lineTotal))}</td>
          </tr>
        `,
      )
      .join('');

    const creditMeta = parseNotes(sale.notes ?? '').credit;

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Venta ${sale.number}</title>
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
          <h1>Detalle de Venta ${sale.number}</h1>
          <p><strong>Fecha:</strong> ${formatDate(sale.saleDate)}</p>
          <p><strong>Estado:</strong> ${mapStatusLabel(sale.status)}</p>
          ${sale.paymentMethod === 'CREDIT'
            ? `<p><strong>Crédito:</strong> Vence ${creditMeta.dueDate ? formatDate(creditMeta.dueDate) : '-'} · Saldo S/ ${sale.paymentStatus === 'PAID' ? '0.00' : toNumber(sale.grandTotal).toFixed(2)}</p>`
            : ''
          }
          <div class="meta">
            <p><strong>Observaciones:</strong> ${sale.notes ?? '-'}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th style="text-align:right;">Cantidad</th>
                <th style="text-align:right;">Precio Unit.</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="totals">Total Venta: S/ ${formatCurrency(toNumber(sale.grandTotal))}</div>
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

  const rows = sales.map((sale) => ({
    id: sale.id,
    codigo: sale.number,
    fecha: formatDate(sale.saleDate),
    tipo: 'Venta Directa',
    total: `S/ ${toNumber(sale.grandTotal).toFixed(2)}`,
    saldo: sale.paymentMethod === 'CREDIT' && sale.paymentStatus !== 'PAID'
      ? `S/ ${toNumber(sale.grandTotal).toFixed(2)}`
      : 'S/ 0.00',
    estado: mapStatusLabel(sale.status),
    items: sale.items.length,
    statusRaw: sale.status,
  }));

  const quoteRows = quotes.map((quote) => ({
    id: quote.id,
    codigo: quote.number || `C-${quote.id.slice(-4)}`,
    fecha: quote.createdAt ? formatDate(quote.createdAt) : '-',
    cliente: quote.client?.name ?? '—',
    total: `S/ ${toNumber((quote as StoredQuote).totalValue ?? quote.grandTotal ?? 0).toFixed(2)}`,
    estado: quote.status === 'APPROVED' ? 'Aprobada' : 'Borrador',
  }));

  const columns = [
    { key: 'codigo', label: 'ID', sortable: true, width: 'w-32' },
    { key: 'fecha', label: 'Fecha', sortable: true },
    { key: 'tipo', label: 'Tipo', sortable: true },
    { key: 'saldo', label: 'Saldo Pend.', sortable: true },
    { key: 'total', label: 'Total', sortable: true },
    { key: 'items', label: 'Items', sortable: true },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: string) => {
        const colors = {
          Completada: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
          Pendiente: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
          Cancelada: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
        };
        return <span className={`px-2 py-1 rounded-full text-xs ${colors[value as keyof typeof colors] || 'bg-gray-100 text-gray-700'}`}>{value}</span>;
      },
    },
    {
      key: 'id',
      label: 'Acciones',
      render: (_value: string, row: any) => (
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); void openViewSale(row.id); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="Ver venta">
            <Eye className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); void openEditSale(row.id); }}
            disabled={row.statusRaw === 'CONFIRMED'}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={row.statusRaw === 'CONFIRMED' ? 'Venta confirmada: no editable' : 'Editar venta'}
          >
            <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); void handleDeleteSale(row.id, row.codigo, row.statusRaw); }}
            disabled={row.statusRaw === 'CONFIRMED'}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={row.statusRaw === 'CONFIRMED' ? 'Venta confirmada: no eliminable' : 'Eliminar venta'}
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
          {row.statusRaw === 'CONFIRMED' ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"><Lock className="w-3 h-3" />Bloqueado</span> : null}
          {row.statusRaw === 'DRAFT' ? (
            <button onClick={(e) => { e.stopPropagation(); void handleConfirmSale(row.id); }} className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
              Confirmar
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const quoteColumns = [
    { key: 'codigo', label: 'ID', sortable: true, width: 'w-32' },
    { key: 'fecha', label: 'Fecha', sortable: true },
    { key: 'cliente', label: 'Cliente', sortable: true },
    { key: 'total', label: 'Total', sortable: true },
    { key: 'estado', label: 'Estado', sortable: true },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_: unknown, row: typeof quoteRows[number]) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); void handleConvertQuote(row.id); }}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Pasar a venta
          </button>
        </div>
      ),
    },
  ];

  const totalVentas = sales.reduce((sum, item) => sum + toNumber(item.grandTotal), 0);
  const pendientes = sales.filter((item) => item.status === 'DRAFT').length;
  const confirmadas = sales.filter((item) => item.status === 'CONFIRMED').length;
  const ticketPromedio = sales.length > 0 ? totalVentas / sales.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ventas</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Gestión de ventas directas</p>
        </div>
        <button onClick={openCreateModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nueva Venta
        </button>
      </div>

      {loading && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Cargando ventas...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">Error al cargar ventas: {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800"><p className="text-sm text-gray-600 dark:text-gray-400">Total Ventas</p><p className="text-2xl font-bold text-gray-900 dark:text-white">S/ {totalVentas.toLocaleString()}</p><p className="text-xs text-green-600 dark:text-green-400 mt-1">{sales.length} operaciones</p></div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800"><p className="text-sm text-gray-600 dark:text-gray-400">Pendientes</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{pendientes}</p><p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Por confirmar</p></div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800"><p className="text-sm text-gray-600 dark:text-gray-400">Confirmadas</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{confirmadas}</p><p className="text-xs text-green-600 dark:text-green-400 mt-1">Con salida de stock</p></div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800"><p className="text-sm text-gray-600 dark:text-gray-400">Ticket Promedio</p><p className="text-2xl font-bold text-gray-900 dark:text-white">S/ {ticketPromedio.toLocaleString()}</p><p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Histórico</p></div>
      </div>

      <DataTable columns={columns} data={rows} searchPlaceholder="Buscar por ID..." />

      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cotizaciones</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">{quotes.length} cotizaciones</span>
        </div>
        <DataTable columns={quoteColumns} data={quoteRows} searchPlaceholder="Buscar cotización..." />
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden">

            {/* ── Header ── */}
            <div className="px-5 py-3.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0 gap-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white whitespace-nowrap">
                {editingSaleId ? 'Editar Venta' : 'Nueva Venta'}
              </h2>

              {/* Mode toggle */}
              {!editingSaleId ? (
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
                  <button
                    onClick={() => setSaleMode('SALE')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${saleMode === 'SALE' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                  >
                    Venta Directa
                  </button>
                  <button
                    onClick={() => setSaleMode('QUOTE')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${saleMode === 'QUOTE' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                  >
                    Cotización
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">Modificando venta existente</span>
              )}

              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* ── Body: 2 panels ── */}
            <div className="flex flex-1 min-h-0">

              {/* LEFT — Catalog */}
              <div className="flex flex-col w-[55%] border-r border-gray-200 dark:border-gray-800 min-h-0">
                {/* Search bar */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      placeholder="Buscar por nombre, SKU, marca..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">{filteredProducts.length} productos disponibles</p>
                </div>

                {/* Product grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600 gap-2">
                      <Package className="w-12 h-12 opacity-40" />
                      <p className="text-sm">Sin productos que coincidan</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      {filteredProducts.map((producto) => {
                        const inCart = cartItems.find(ci => ci.producto.id === producto.id);
                        const outOfStock = toNumber(producto.stockCurrent) <= 0;
                        const lowStock = !outOfStock && producto.stockCurrent <= producto.stockMin;
                        return (
                          <button
                            key={producto.id}
                            onClick={() => !outOfStock && handleAddProduct(producto)}
                            disabled={outOfStock}
                            className={`text-left p-3 rounded-xl border-2 transition-all ${
                              inCart
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : outOfStock
                                ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50'
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-gray-800 hover:shadow-sm cursor-pointer'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight line-clamp-2 flex-1">{producto.name}</p>
                              {inCart && (
                                <span className="shrink-0 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold leading-none">
                                  {inCart.cantidad}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mb-2">{producto.sku}</p>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                S/ {toNumber(producto.salePrice).toFixed(2)}
                              </span>
                              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                                outOfStock
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                  : lowStock
                                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              }`}>
                                {outOfStock ? 'Sin stock' : `${producto.stockCurrent} uds`}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT — Order panel */}
              <div className="flex flex-col w-[45%] min-h-0">


                {/* Cart items */}
                <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                  {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600 gap-2">
                      <ShoppingCart className="w-14 h-14" />
                      <p className="text-sm font-medium">Carrito vacío</p>
                      <p className="text-xs">Haz clic en un producto para agregarlo</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cartItems.map((item, index) => (
                        <div key={item.producto.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight flex-1">{item.producto.name}</p>
                            <button
                              onClick={() => handleRemoveProduct(item.producto.id)}
                              className="shrink-0 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Stepper */}
                            <div className="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                              <button
                                onClick={() => {
                                  const qty = Math.max(item.cantidad - 1, 1);
                                  setCartItems(cartItems.map((ci, i) => i === index ? { ...ci, cantidad: qty } : ci));
                                }}
                                className="w-7 h-7 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={toNumber(item.producto.stockCurrent)}
                                value={item.cantidad}
                                onChange={(e) => {
                                  const qty = Math.max(
                                    1,
                                    Math.min(parseInt(e.target.value, 10) || 0, toNumber(item.producto.stockCurrent)),
                                  );
                                  setCartItems(cartItems.map((ci, i) => i === index ? { ...ci, cantidad: qty } : ci));
                                }}
                                className="w-12 text-center text-sm font-bold text-gray-900 dark:text-white bg-transparent outline-none"
                              />
                              <button
                                onClick={() => {
                                  const qty = Math.min(item.cantidad + 1, item.producto.stockCurrent);
                                  setCartItems(cartItems.map((ci, i) => i === index ? { ...ci, cantidad: qty } : ci));
                                }}
                                className="w-7 h-7 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            {/* Unit price */}
                            <span className="text-xs text-gray-400">S/ {toNumber(item.producto.salePrice).toFixed(2)} c/u</span>
                            {/* Discount */}
                            <div className="flex items-center gap-1 ml-auto">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.descuento}
                                onChange={(e) => {
                                  const d = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 100);
                                  setCartItems(cartItems.map((ci, i) => i === index ? { ...ci, descuento: d } : ci));
                                }}
                                className="w-14 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-400">%dto</span>
                            </div>
                            {/* Line total */}
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              S/ {(toNumber(item.producto.salePrice) * item.cantidad * (1 - item.descuento / 100)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom sticky: totals + payment + confirm */}
                <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 space-y-3 shrink-0 bg-white dark:bg-gray-900">

                  {/* IGV options */}
                  <div className="flex items-center gap-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isIgvExonerated}
                        onChange={(e) => { const v = e.target.checked; setIsIgvExonerated(v); if (v) setIsPriceWithIgv(false); }}
                        className="rounded"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Exonerar IGV</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isPriceWithIgv}
                        disabled={isIgvExonerated}
                        onChange={(e) => setIsPriceWithIgv(e.target.checked)}
                        className="rounded disabled:opacity-40"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Precio incluye IGV</span>
                    </label>
                  </div>

                  {/* Totals */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 space-y-1.5">
                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>Subtotal</span><span>S/ {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">IGV ({isIgvExonerated ? '0' : IGV_RATE}%)</span>
                      <span className={isIgvExonerated ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'}>S/ {tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-gray-200 dark:border-gray-700 pt-2 mt-1">
                      <span className="text-gray-900 dark:text-white">Total</span>
                      <span className="text-lg text-blue-600 dark:text-blue-400">S/ {total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment method */}
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Forma de pago</p>
                    <div className="grid grid-cols-4 gap-2">
                      {SUPPORTED_PAYMENT_METHODS.map((m) => {
                        const active = selectedPaymentMethod === m.id;
                        const styles = {
                          CASH:   active ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
                          YAPE:   active ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
                          PLIN:   active ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
                          CREDIT: active ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
                        } as const;
                        const emoji = { CASH: '💵', YAPE: '🟣', PLIN: '🔵', CREDIT: '📋' } as const;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelectedPaymentMethod(m.id)}
                            className={`py-2 rounded-xl border-2 text-xs font-semibold transition-all hover:opacity-90 ${styles[m.id]}`}
                          >
                            <div className="text-base leading-none mb-0.5">{emoji[m.id]}</div>
                            <div>{m.label}</div>
                          </button>
                        );
                      })}
                    </div>
                    {selectedPaymentMethod === 'CREDIT' && (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Plazo (días)</span>
                          <input
                            type="number"
                            min={1}
                            max={180}
                            value={creditTermDays}
                            onChange={(e) => {
                              const days = Math.min(Math.max(parseInt(e.target.value, 10) || 1, 1), 180);
                              setCreditTermDays(days);
                              const d = new Date(); d.setDate(d.getDate() + days); setCreditDueDate(d.toISOString().slice(0, 10));
                            }}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Vencimiento</span>
                          <input
                            type="date"
                            value={creditDueDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCreditDueDate(val);
                              const today = new Date();
                              const due = new Date(val);
                              const diff = Math.max(1, Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                              setCreditTermDays(diff);
                            }}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                      </div>
                    )}
                    {selectedPaymentMethod === 'CREDIT' && (
                      <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">Pago diferido — no genera ingreso en caja hasta la cobranza.</p>
                    )}
                  </div>

                  {/* Notes */}
                  <textarea
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                    rows={2}
                    placeholder="Observaciones (opcional)..."
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowModal(false); resetForm(); }}
                      className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={isSaving || cartItems.length === 0}
                      onClick={() => void submitSale()}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isSaving ? 'Guardando...' : editingSaleId ? 'Guardar Cambios' : saleMode === 'QUOTE' ? 'Crear Cotización' : 'Crear Venta'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showViewModal && viewSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Detalle de Venta {viewSale.number}</h2>
              <button onClick={() => { setShowViewModal(false); setViewSale(null); }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"><XCircle className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"><p className="text-xs text-gray-500 dark:text-gray-400">Estado</p><p className="font-semibold text-gray-900 dark:text-white">{mapStatusLabel(viewSale.status)}</p><p className="text-sm text-gray-600 dark:text-gray-400">Total: S/ {toNumber(viewSale.grandTotal).toFixed(2)}</p></div>
                {viewSale.paymentMethod === 'CREDIT' && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/60 dark:bg-amber-900/10">
                    <p className="text-xs text-amber-700 dark:text-amber-300">Crédito</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">Vence: {viewCreditMeta.dueDate ? formatDate(viewCreditMeta.dueDate) : '—'}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">Saldo: S/ {viewSale.paymentStatus === 'PAID' ? '0.00' : toNumber(viewSale.grandTotal).toFixed(2)}</p>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Producto</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Cantidad</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Precio Unit.</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Total</th></tr></thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {viewSale.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{item.product?.name ?? item.productId}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{item.qty}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">S/ {toNumber(item.unitPrice).toFixed(2)}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">S/ {toNumber(item.lineTotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {viewSale.notes ? <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"><p className="text-xs text-gray-500 dark:text-gray-400">Observaciones</p><p className="text-sm text-gray-900 dark:text-gray-100">{viewSale.notes}</p></div> : null}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button
                onClick={() => handlePrintSale(viewSale)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Imprimir / PDF
              </button>
              <button onClick={() => { setShowViewModal(false); setViewSale(null); }} className="px-6 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
