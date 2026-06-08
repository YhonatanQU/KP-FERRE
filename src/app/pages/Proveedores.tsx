import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Edit, Image, Mail, MapPin, Phone, Plus, Search, Trash2, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { createSupplier, deleteSupplier, fetchSuppliers, updateSupplier } from '../services/crm';
import type { SupplierEntity } from '../types/crm';

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
    reader.readAsDataURL(file);
  });
}

function buildAvatarDataUrl(name: string, ruc: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'PR';

  const palettes = [
    ['#155e75', '#22d3ee'],
    ['#1d4ed8', '#93c5fd'],
    ['#7c2d12', '#fb923c'],
    ['#166534', '#4ade80'],
    ['#7e22ce', '#d8b4fe'],
  ];

  const seed = Array.from(`${name}${ruc}`).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const [start, end] = palettes[seed % palettes.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${start}" />
          <stop offset="100%" stop-color="${end}" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="36" fill="url(#g)" />
      <rect x="34" y="34" width="92" height="92" rx="26" fill="rgba(255,255,255,0.14)" />
      <text x="80" y="93" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="white">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function Proveedores() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierEntity | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    name: '',
    ruc: '',
    imageUrl: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    region: '',
    isActive: true,
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSuppliers({ includeInactive: true });
      setSuppliers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar proveedores';
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
    setEditingSupplier(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setForm({
      name: '',
      ruc: '',
      imageUrl: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      region: '',
      isActive: true,
    });
    setShowModal(true);
  };

  const openEdit = (supplier: SupplierEntity) => {
    setEditingSupplier(supplier);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setForm({
      name: supplier.name,
      ruc: supplier.ruc,
      imageUrl: supplier.imageUrl ?? '',
      contactName: supplier.contactName ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
      city: supplier.city ?? '',
      region: supplier.region ?? '',
      isActive: supplier.isActive,
    });
    setShowModal(true);
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen valido');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error('La foto no debe superar 2 MB');
      event.target.value = '';
      return;
    }

    try {
      const imageUrl = await readFileAsDataUrl(file);
      setForm((prev) => ({ ...prev, imageUrl }));
      toast.success('Foto adjuntada');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo adjuntar la foto';
      toast.error(message);
    }
  };

  const clearSelectedImage = () => {
    setForm((prev) => ({ ...prev, imageUrl: '' }));
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.ruc.trim()) {
      toast.error('Razon social y RUC son obligatorios');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        ruc: form.ruc.trim(),
        imageUrl: form.imageUrl ? form.imageUrl : null,
        contactName: form.contactName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        region: form.region.trim() || undefined,
        isActive: form.isActive,
      };

      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, payload);
        toast.success('Proveedor actualizado');
      } else {
        await createSupplier(payload);
        toast.success('Proveedor creado');
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar proveedor';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (supplier: SupplierEntity) => {
    const confirmed = window.confirm(`¿Eliminar proveedor "${supplier.name}"?`);
    if (!confirmed) return;
    try {
      await deleteSupplier(supplier.id);
      toast.success('Proveedor eliminado');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar proveedor';
      toast.error(message);
    }
  };

  const filteredSuppliers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      if (statusFilter === 'ACTIVE' && !supplier.isActive) return false;
      if (statusFilter === 'INACTIVE' && supplier.isActive) return false;

      if (!query) return true;
      return (
        supplier.name.toLowerCase().includes(query) ||
        supplier.ruc.toLowerCase().includes(query) ||
        (supplier.email ?? '').toLowerCase().includes(query) ||
        (supplier.contactName ?? '').toLowerCase().includes(query) ||
        (supplier.city ?? '').toLowerCase().includes(query)
      );
    });
  }, [suppliers, searchTerm, statusFilter]);

  const activeCount = suppliers.filter((supplier) => supplier.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proveedores</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Gestión de proveedores con perfil visual y contacto comercial</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Proveedor
        </button>
      </div>

      {loading && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Cargando proveedores...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">Error al cargar proveedores: {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total proveedores</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{suppliers.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Activos</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Inactivos</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{suppliers.length - activeCount}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por razon social, RUC, contacto o ciudad..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStatusFilter('ALL')} className={`px-4 py-2 rounded-lg text-sm transition-colors ${statusFilter === 'ALL' ? 'bg-blue-600 text-white' : 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Todos</button>
            <button type="button" onClick={() => setStatusFilter('ACTIVE')} className={`px-4 py-2 rounded-lg text-sm transition-colors ${statusFilter === 'ACTIVE' ? 'bg-green-600 text-white' : 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Activos</button>
            <button type="button" onClick={() => setStatusFilter('INACTIVE')} className={`px-4 py-2 rounded-lg text-sm transition-colors ${statusFilter === 'INACTIVE' ? 'bg-gray-700 text-white' : 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Inactivos</button>
          </div>
        </div>

        <div className="p-5">
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-14">
              <UserCircle2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No se encontraron proveedores con esos filtros.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredSuppliers.map((supplier) => (
                <article key={supplier.id} className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-slate-50 dark:from-gray-900 dark:to-gray-900/70 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <img src={supplier.imageUrl || buildAvatarDataUrl(supplier.name, supplier.ruc)} alt={`Foto de ${supplier.name}`} className="h-16 w-16 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-gray-700 shadow-sm" />
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{supplier.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">RUC: {supplier.ruc}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${supplier.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>{supplier.isActive ? 'Activo' : 'Inactivo'}</span>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="truncate">{supplier.contactName || 'Sin contacto asignado'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="truncate">{supplier.email || 'Sin correo registrado'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Phone className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>{supplier.phone || 'Sin telefono'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="truncate">{supplier.city || supplier.region ? `${supplier.city || ''}${supplier.city && supplier.region ? ', ' : ''}${supplier.region || ''}` : 'Sin ubicacion'}</span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-800 pt-4">
                    <button onClick={() => openEdit(supplier)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Editar
                    </button>
                    <button onClick={() => void handleDelete(supplier)} className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Foto del proveedor</label>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="shrink-0">
                      <ImageWithFallback src={form.imageUrl || buildAvatarDataUrl(form.name || 'Proveedor', form.ruc || '00000000000')} alt="Vista previa del proveedor" className="h-24 w-24 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-gray-700 shadow-sm" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <label className="block border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center hover:border-blue-600 dark:hover:border-blue-500 transition-colors cursor-pointer">
                        <Image className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">Click para subir foto</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">PNG, JPG o WEBP hasta 2 MB</p>
                        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/jpg" className="hidden" onChange={(event) => void handleImageChange(event)} />
                      </label>
                      {form.imageUrl ? (
                        <button type="button" onClick={clearSelectedImage} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">
                          Quitar foto
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Razon Social *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">RUC *</label>
                  <input type="text" value={form.ruc} onChange={(e) => setForm((prev) => ({ ...prev, ruc: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contacto</label>
                  <input type="text" value={form.contactName} onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Telefono</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Direccion</label>
                <input type="text" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ciudad</label>
                  <input type="text" value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Region</label>
                  <input type="text" value={form.region} onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="supplierActive" type="checkbox" checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                <label htmlFor="supplierActive" className="text-sm text-gray-700 dark:text-gray-300">Proveedor activo</label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-6 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">Cancelar</button>
              <button disabled={isSaving} onClick={() => void handleSave()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">{isSaving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
