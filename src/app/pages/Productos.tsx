import { DataTable } from '../components/DataTable';
import { Edit, Trash2, Image } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  createCategory,
  createProduct,
  fetchCategories,
  fetchProducts,
  updateProduct,
} from '../services/catalog';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import type { Category, Product } from '../types/catalog';

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
    reader.readAsDataURL(file);
  });
}

export function Productos() {
  const [showModal, setShowModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedStockView, setSelectedStockView] = useState<'ALL' | 'LOW_STOCK' | 'AVAILABLE'>('ALL');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const emptyForm = {
    sku: '',
    categoryId: '',
    name: '',
    imageUrl: '',
    brand: '',
    model: '',
    costPrice: '',
    salePrice: '',
    stockCurrent: '0',
    stockMin: '0',
    stockMax: '0',
    locationCode: '',
  };
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [productsData, categoriesData] = await Promise.all([
        fetchProducts({
          ...(selectedCategoryId !== 'ALL' ? { categoryId: selectedCategoryId } : {}),
          ...(selectedStatus === 'ACTIVE' ? { isActive: true } : {}),
          ...(selectedStatus === 'INACTIVE' ? { isActive: false } : {}),
          ...(selectedStockView !== 'ALL'
            ? { stockStatus: selectedStockView }
            : {}),
        }),
        fetchCategories(),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      if (!form.categoryId && categoriesData.length > 0) {
        setForm((prev) => ({ ...prev, categoryId: categoriesData[0].id }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar productos';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [selectedCategoryId, selectedStatus, selectedStockView]);

  const filteredProducts = products;

  const rows = filteredProducts.map((product) => {
    const costo = toNumber(product.costPrice);
    const precio = toNumber(product.salePrice);
    const margen = costo > 0 ? ((precio - costo) / costo) * 100 : 0;

    return {
      id: product.id,
      imageUrl: product.imageUrl ?? '',
      codigo: product.sku,
      nombre: product.name,
      categoria: product.category?.name ?? 'Sin categoría',
      marca: product.brand ?? '-',
      precio,
      costo,
      margen,
      estado: product.isActive ? 'Activo' : 'Inactivo',
    };
  });

  const totalMargen = rows.reduce((acc, row) => acc + row.margen, 0);
  const margenPromedio = rows.length > 0 ? totalMargen / rows.length : 0;
  const categoriasUnicas = new Set(rows.map((row) => row.categoria)).size;
  const valorCatalogo = rows.reduce((acc, row) => acc + row.precio, 0);
  const lowStockCount = filteredProducts.filter((product) => product.stockCurrent <= product.stockMin).length;
  const hasActiveFilters =
    selectedCategoryId !== 'ALL' || selectedStatus !== 'ALL' || selectedStockView !== 'ALL';

  const categorySummary = categories.map((category) => ({
    id: category.id,
    name: category.name,
    count: products.filter((product) => product.categoryId === category.id).length,
  }));

  const openCreateModal = () => {
    setEditingProductId(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setForm({
      ...emptyForm,
      categoryId: categories[0]?.id ?? '',
    });
    setShowModal(true);
  };

  const openEditModal = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      toast.error('No se encontró el producto seleccionado');
      return;
    }

    setEditingProductId(product.id);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setForm({
      sku: product.sku ?? '',
      categoryId: product.categoryId ?? categories[0]?.id ?? '',
      name: product.name ?? '',
      imageUrl: product.imageUrl ?? '',
      brand: product.brand ?? '',
      model: product.model ?? '',
      costPrice: String(toNumber(product.costPrice)),
      salePrice: String(toNumber(product.salePrice)),
      stockCurrent: String(Math.max(0, Math.floor(toNumber(product.stockCurrent)))),
      stockMin: String(Math.max(0, Math.floor(toNumber(product.stockMin)))),
      stockMax: String(Math.max(0, Math.floor(toNumber(product.stockMax)))),
      locationCode: product.locationCode ?? '',
    });
    setShowModal(true);
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen válido');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error('La imagen no debe superar 2 MB');
      event.target.value = '';
      return;
    }

    try {
      const imageUrl = await readFileAsDataUrl(file);
      if (!imageUrl) {
        throw new Error('No se pudo convertir la imagen');
      }
      setForm((prev) => ({ ...prev, imageUrl }));
      toast.success('Imagen adjuntada');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo adjuntar la imagen';
      toast.error(message);
    }
  };

  const clearSelectedImage = () => {
    setForm((prev) => ({ ...prev, imageUrl: '' }));
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleSaveProduct = async () => {
    if (!form.sku.trim() || !form.name.trim() || !form.categoryId) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        categoryId: form.categoryId,
        imageUrl: form.imageUrl || undefined,
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        costPrice: toNumber(form.costPrice),
        salePrice: toNumber(form.salePrice),
        stockCurrent: Math.max(0, Math.floor(toNumber(form.stockCurrent))),
        stockMin: Math.max(0, Math.floor(toNumber(form.stockMin))),
        stockMax: Math.max(0, Math.floor(toNumber(form.stockMax))),
        locationCode: form.locationCode.trim() || undefined,
        isActive: true,
      };

      if (editingProductId) {
        await updateProduct(editingProductId, payload);
        toast.success('Producto actualizado');
      } else {
        await createProduct(payload);
        toast.success('Producto creado');
      }

      setShowModal(false);
      setEditingProductId(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      setForm({
        ...emptyForm,
        categoryId: categories[0]?.id ?? '',
      });
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar el producto';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('Ingresa el nombre de la categoría');
      return;
    }

    setIsCreatingCategory(true);
    try {
      const category = await createCategory(name);
      setCategories((prev) => [category, ...prev]);
      setForm((prev) => ({ ...prev, categoryId: category.id }));
      setNewCategoryName('');
      toast.success('Categoría creada');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear la categoría';
      toast.error(message);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const columns = [
    {
      key: 'imageUrl',
      label: 'Foto',
      render: (value: string) => (
        <div className="flex items-center">
          {value ? (
            <img src={value} alt="Producto" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-400">No foto</div>
          )}
        </div>
      ),
    },
    { 
      key: 'codigo', 
      label: 'Código', 
      sortable: true,
      render: (value: string) => (
        <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">{value}</span>
      )
    },
    { key: 'nombre', label: 'Producto', sortable: true },
    { key: 'categoria', label: 'Categoría', sortable: true },
    { key: 'marca', label: 'Marca', sortable: true },
    { 
      key: 'precio', 
      label: 'Precio Venta', 
      sortable: true,
      render: (value: number) => (
        <span className="font-semibold text-gray-900 dark:text-white">S/ {value.toFixed(2)}</span>
      )
    },
    { 
      key: 'costo', 
      label: 'Costo', 
      sortable: true,
      render: (value: number) => (
        <span className="text-gray-600 dark:text-gray-400">S/ {value.toFixed(2)}</span>
      )
    },
    { 
      key: 'margen', 
      label: 'Margen %', 
      sortable: true,
      render: (value: number) => (
        <span className={`font-semibold ${value > 40 ? 'text-green-600 dark:text-green-400' : value > 25 ? 'text-blue-600 dark:text-blue-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
          {value.toFixed(1)}%
        </span>
      )
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          value === 'Activo' 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
        }`}>
          {value}
        </span>
      )
    },
    {
      key: 'id',
      label: 'Acciones',
      render: (value: string) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(value);
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.error('Producto eliminado');
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )
    },
  ];

  const filterToolbar = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">Filtro principal</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Explora el catálogo priorizando categorías.</p>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {rows.length} producto{rows.length === 1 ? '' : 's'} visible{rows.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('ALL')}
            className={`shrink-0 rounded-full px-4 py-2 text-sm transition-colors ${
              selectedCategoryId === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Todas ({products.length})
          </button>
          {categorySummary.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategoryId(category.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm transition-colors ${
                selectedCategoryId === category.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {category.name} ({category.count})
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:max-w-2xl">
          <select
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="ALL">Todos los estados</option>
            <option value="ACTIVE">Solo activos</option>
            <option value="INACTIVE">Solo inactivos</option>
          </select>

          <select
            value={selectedStockView}
            onChange={(event) => setSelectedStockView(event.target.value as 'ALL' | 'LOW_STOCK' | 'AVAILABLE')}
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="ALL">Todo el inventario</option>
            <option value="LOW_STOCK">Bajo stock o al mínimo</option>
            <option value="AVAILABLE">Con stock saludable</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            Bajo stock: {lowStockCount}
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryId('ALL');
                setSelectedStatus('ALL');
                setSelectedStockView('ALL');
              }}
              className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Productos</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Catálogo de productos y servicios</p>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          Cargando productos...
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Productos</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{rows.length}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">En catálogo</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Categorías</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{categoriasUnicas}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Activas</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Margen Promedio</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{margenPromedio.toFixed(1)}%</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Rentabilidad</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Valor Catálogo</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">S/ {valorCatalogo.toLocaleString()}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Precio promedio</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Error al cargar datos: {error}
        </div>
      )}

      <DataTable 
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar por código, nombre, marca..."
        onAdd={openCreateModal}
        addButtonLabel="Nuevo Producto"
        toolbarContent={filterToolbar}
        showUtilityButtons={false}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingProductId ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Código *</label>
                  <input type="text" value={form.sku} onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))} placeholder="PROD-XXX" className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categoría registrada *</label>
                  <select value={form.categoryId} onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    {categories.length === 0 && <option value="">Sin categorías registradas</option>}
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nueva categoría"
                      className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={isCreatingCategory}
                      onClick={() => void handleCreateCategory()}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isCreatingCategory ? 'Creando...' : '+ Categoría'}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nombre del Producto *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nombre completo" className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Marca</label>
                  <input type="text" value={form.brand} onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))} placeholder="Marca" className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modelo</label>
                  <input type="text" value={form.model} onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))} placeholder="Modelo" className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Costo *</label>
                  <input type="number" value={form.costPrice} onChange={(e) => setForm((prev) => ({ ...prev, costPrice: e.target.value }))} step="0.01" placeholder="0.00" className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Precio Venta *</label>
                  <input type="number" value={form.salePrice} onChange={(e) => setForm((prev) => ({ ...prev, salePrice: e.target.value }))} step="0.01" placeholder="0.00" className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Margen %</label>
                  <input type="text" disabled value={toNumber(form.costPrice) > 0 ? (((toNumber(form.salePrice) - toNumber(form.costPrice)) / toNumber(form.costPrice)) * 100).toFixed(1) : '0.0'} placeholder="0.0%" className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stock</label>
                  <input type="number" value={form.stockCurrent} onChange={(e) => setForm((prev) => ({ ...prev, stockCurrent: e.target.value }))} min={0} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stock Mín.</label>
                  <input type="number" value={form.stockMin} onChange={(e) => setForm((prev) => ({ ...prev, stockMin: e.target.value }))} min={0} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stock Máx.</label>
                  <input type="number" value={form.stockMax} onChange={(e) => setForm((prev) => ({ ...prev, stockMax: e.target.value }))} min={0} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ubicación</label>
                  <input type="text" value={form.locationCode} onChange={(e) => setForm((prev) => ({ ...prev, locationCode: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descripción</label>
                <textarea rows={3} placeholder="Descripción del producto..." className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Imagen del Producto</label>
                <label className="block border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center hover:border-blue-600 dark:hover:border-blue-500 transition-colors cursor-pointer">
                  {form.imageUrl ? (
                    <div className="space-y-3">
                      <ImageWithFallback
                        src={form.imageUrl}
                        alt="Vista previa del producto"
                        className="mx-auto h-40 w-full max-w-xs rounded-lg object-cover"
                      />
                      <p className="text-sm text-gray-600 dark:text-gray-400">Haz click para reemplazar la imagen</p>
                    </div>
                  ) : (
                    <div>
                      <Image className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">Click para subir imagen</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">PNG, JPG o WEBP hasta 2 MB</p>
                    </div>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    className="hidden"
                    onChange={(event) => void handleImageChange(event)}
                  />
                </label>
                {form.imageUrl ? (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={clearSelectedImage}
                      className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                    >
                      Quitar imagen
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 p-6 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  if (imageInputRef.current) {
                    imageInputRef.current.value = '';
                  }
                }}
                className="px-6 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              >
                Cancelar
              </button>
              <button disabled={isSaving || categories.length === 0} onClick={() => void handleSaveProduct()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {isSaving ? 'Guardando...' : editingProductId ? 'Guardar cambios' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
