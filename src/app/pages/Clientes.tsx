import { useEffect, useMemo, useRef, useState } from 'react';
import { Edit, Image, Mail, MapPin, Phone, Plus, Search, Trash2, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { createClient, deleteClient, fetchClients, updateClient } from '../services/crm';
import type { ClientEntity } from '../types/crm';

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
    reader.readAsDataURL(file);
  });
}

function buildAvatarDataUrl(name: string, docNumber: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CL';

  const palettes = [
    ['#0f766e', '#34d399'],
    ['#1d4ed8', '#60a5fa'],
    ['#be123c', '#fb7185'],
    ['#a16207', '#facc15'],
    ['#4338ca', '#818cf8'],
  ];

  const seed = Array.from(`${name}${docNumber}`).reduce((acc, char) => acc + char.charCodeAt(0), 0);
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
      <circle cx="80" cy="56" r="24" fill="rgba(255,255,255,0.16)" />
      <rect x="28" y="96" width="104" height="40" rx="20" fill="rgba(255,255,255,0.16)" />
      <text x="80" y="90" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="white">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function Clientes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientEntity | null>(null);
  const [clients, setClients] = useState<ClientEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    name: '',
    docType: 'DNI' as 'DNI' | 'RUC' | 'OTHER',
    docNumber: '',
    imageUrl: '',
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
      const data = await fetchClients({ includeInactive: true });
      setClients(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar clientes';
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
    setEditingClient(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setForm({
      name: '',
      docType: 'DNI',
      docNumber: '',
      imageUrl: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      region: '',
      isActive: true,
    });
    setShowModal(true);
  };

  const openEdit = (client: ClientEntity) => {
    setEditingClient(client);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setForm({
      name: client.name,
      docType: client.docType,
      docNumber: client.docNumber,
      imageUrl: client.imageUrl ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      address: client.address ?? '',
      city: client.city ?? '',
      region: client.region ?? '',
      isActive: client.isActive,
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
    if (!form.name.trim() || !form.docNumber.trim()) {
      toast.error('Nombre y documento son obligatorios');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        docType: form.docType,
        docNumber: form.docNumber.trim(),
        imageUrl: form.imageUrl ? form.imageUrl : null,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        region: form.region.trim() || undefined,
        isActive: form.isActive,
      };

      if (editingClient) {
        await updateClient(editingClient.id, payload);
        toast.success('Cliente actualizado');
      } else {
        await createClient(payload);
        toast.success('Cliente creado');
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar cliente';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (client: ClientEntity) => {
    const confirmed = window.confirm(`¿Eliminar cliente "${client.name}"?`);
    if (!confirmed) return;
    try {
      await deleteClient(client.id);
      toast.success('Cliente eliminado');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar cliente';
      toast.error(message);
    }
  };

  const filteredClients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return clients.filter((client) => {
      if (statusFilter === 'ACTIVE' && !client.isActive) return false;
      if (statusFilter === 'INACTIVE' && client.isActive) return false;

      if (!query) return true;
      return (
        client.name.toLowerCase().includes(query) ||
        client.docNumber.toLowerCase().includes(query) ||
        (client.email ?? '').toLowerCase().includes(query) ||
        (client.phone ?? '').toLowerCase().includes(query) ||
        (client.city ?? '').toLowerCase().includes(query)
      );
    });
  }, [clients, searchTerm, statusFilter]);

  const activeCount = clients.filter((client) => client.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Gestión de clientes y contactos con perfil visual</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </button>
      </div>

      {loading && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Cargando clientes...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">Error al cargar clientes: {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total clientes</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{clients.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Activos</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Inactivos</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{clients.length - activeCount}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, documento, email o ciudad..."
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
          {filteredClients.length === 0 ? (
            <div className="text-center py-14">
              <UserCircle2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No se encontraron clientes con esos filtros.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredClients.map((client) => (
                <article key={client.id} className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-slate-50 dark:from-gray-900 dark:to-gray-900/70 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <img src={client.imageUrl || buildAvatarDataUrl(client.name, client.docNumber)} alt={`Foto de ${client.name}`} className="h-16 w-16 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-gray-700 shadow-sm" />
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{client.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{client.docType}: {client.docNumber}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${client.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>{client.isActive ? 'Activo' : 'Inactivo'}</span>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="truncate">{client.email || 'Sin correo registrado'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{client.phone || 'Sin telefono'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="truncate">{client.city || client.region ? `${client.city || ''}${client.city && client.region ? ', ' : ''}${client.region || ''}` : 'Sin ubicacion'}</span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-800 pt-4">
                    <button onClick={() => openEdit(client)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Editar
                    </button>
                    <button onClick={() => void handleDelete(client)} className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Foto del cliente</label>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="shrink-0">
                      <ImageWithFallback src={form.imageUrl || buildAvatarDataUrl(form.name || 'Cliente', form.docNumber || '00000000')} alt="Vista previa del cliente" className="h-24 w-24 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-gray-700 shadow-sm" />
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nombre *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo Documento *</label>
                  <select value={form.docType} onChange={(e) => setForm((prev) => ({ ...prev, docType: e.target.value as 'DNI' | 'RUC' | 'OTHER' }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    <option value="DNI">DNI</option>
                    <option value="RUC">RUC</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nro Documento *</label>
                  <input type="text" value={form.docNumber} onChange={(e) => setForm((prev) => ({ ...prev, docNumber: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
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
                <input id="clientActive" type="checkbox" checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                <label htmlFor="clientActive" className="text-sm text-gray-700 dark:text-gray-300">Cliente activo</label>
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
