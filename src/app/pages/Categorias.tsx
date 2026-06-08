import { useEffect, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createCategory, deleteCategory, fetchCategories, updateCategory } from '../services/catalog';
import type { Category } from '../types/catalog';

export function Categorias() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    isActive: true,
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCategories({ includeInactive: true });
      setCategories(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar categorías';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreate = () => {
    setEditingCategory(null);
    setForm({ name: '', description: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setForm({
      name: category.name,
      description: category.description ?? '',
      isActive: category.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre de categoría es obligatorio');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          isActive: form.isActive,
        });
        toast.success('Categoría actualizada');
      } else {
        await createCategory(form.name.trim(), form.description.trim() || undefined);
        toast.success('Categoría creada');
      }
      setShowModal(false);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar la categoría';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    const confirmed = window.confirm(`¿Eliminar la categoría "${category.name}"?`);
    if (!confirmed) return;

    try {
      await deleteCategory(category.id);
      toast.success('Categoría eliminada');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar la categoría';
      toast.error(message);
    }
  };

  const columns = [
    { key: 'name', label: 'Nombre', sortable: true },
    {
      key: 'description',
      label: 'Descripción',
      render: (value: string | null) => (
        <span className="text-gray-600 dark:text-gray-400">{value || '-'}</span>
      ),
    },
    {
      key: 'isActive',
      label: 'Estado',
      sortable: true,
      render: (value: boolean) => (
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            value
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          {value ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Acciones',
      render: (_value: string, row: Category) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleDelete(row);
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categorías</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Gestión de categorías de productos</p>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          Cargando categorías...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Error al cargar categorías: {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={categories}
        searchPlaceholder="Buscar categorías..."
        onAdd={openCreate}
        addButtonLabel="Nueva Categoría"
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descripción</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">Categoría activa</label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              >
                Cancelar
              </button>
              <button
                disabled={isSaving}
                onClick={() => void handleSave()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
