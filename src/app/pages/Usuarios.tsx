import { useEffect, useMemo, useRef, useState } from 'react';
import { Edit, Image, Mail, Plus, Search, Shield, Trash2, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { createUser, deleteUser, fetchRoles, fetchUsers, updateUser } from '../services/admin';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import type { RoleEntity, UserEntity } from '../types/admin';

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
    reader.readAsDataURL(file);
  });
}

function buildAvatarDataUrl(name: string, email: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'US';

  const palettes = [
    ['#0f766e', '#2dd4bf'],
    ['#1d4ed8', '#60a5fa'],
    ['#7c3aed', '#c084fc'],
    ['#be123c', '#fb7185'],
    ['#a16207', '#facc15'],
  ];

  const seed = Array.from(email).reduce((acc, char) => acc + char.charCodeAt(0), 0);
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
      <circle cx="80" cy="62" r="26" fill="rgba(255,255,255,0.18)" />
      <rect x="34" y="100" width="92" height="38" rx="19" fill="rgba(255,255,255,0.16)" />
      <text x="80" y="92" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="36" font-weight="700" fill="white">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function Usuarios() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserEntity | null>(null);
  const [users, setUsers] = useState<UserEntity[]>([]);
  const [roles, setRoles] = useState<RoleEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    imageUrl: '',
    roleId: '',
    isActive: true,
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersData, rolesData] = await Promise.all([fetchUsers(), fetchRoles()]);
      setUsers(usersData);
      setRoles(rolesData.filter((role) => role.isActive));
      if (!form.roleId && rolesData.length > 0) {
        setForm((prev) => ({ ...prev, roleId: rolesData[0].id }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar los usuarios';
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
    setEditingUser(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setForm({
      name: '',
      email: '',
      password: '',
      imageUrl: '',
      roleId: roles[0]?.id ?? '',
      isActive: true,
    });
    setShowModal(true);
  };

  const openEdit = (user: UserEntity) => {
    setEditingUser(user);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      imageUrl: user.imageUrl ?? '',
      roleId: user.role?.id ?? roles[0]?.id ?? '',
      isActive: user.isActive,
    });
    setShowModal(true);
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen válido');
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
    if (!form.name.trim() || !form.email.trim() || !form.roleId) {
      toast.error('Nombre, correo y rol son obligatorios');
      return;
    }

    if (!editingUser && form.password.trim().length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsSaving(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          imageUrl: form.imageUrl ? form.imageUrl : null,
          roleId: form.roleId,
          isActive: form.isActive,
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
        });
        toast.success('Usuario actualizado');
      } else {
        await createUser({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password.trim(),
          imageUrl: form.imageUrl || undefined,
          roleId: form.roleId,
          isActive: form.isActive,
        });
        toast.success('Usuario creado');
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar el usuario';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (user: UserEntity) => {
    const confirmed = window.confirm(`¿Eliminar el usuario "${user.name}"?`);
    if (!confirmed) return;
    try {
      await deleteUser(user.id);
      toast.success('Usuario eliminado');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el usuario';
      toast.error(message);
    }
  };

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter === 'ACTIVE' && !user.isActive) return false;
      if (statusFilter === 'INACTIVE' && user.isActive) return false;

      if (!query) return true;
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.role?.name ?? '').toLowerCase().includes(query) ||
        (user.role?.code ?? '').toLowerCase().includes(query)
      );
    });
  }, [users, searchTerm, statusFilter]);

  const activeUsers = users.filter((user) => user.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Administración de accesos, cuentas y perfiles operativos</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </button>
      </div>

      {loading && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Cargando usuarios...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">Error al cargar usuarios: {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total usuarios</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{users.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Activos</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeUsers}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Roles disponibles</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{roles.length}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo o rol..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${statusFilter === 'ALL' ? 'bg-blue-600 text-white' : 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${statusFilter === 'ACTIVE' ? 'bg-green-600 text-white' : 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              Activos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${statusFilter === 'INACTIVE' ? 'bg-gray-700 text-white' : 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              Inactivos
            </button>
          </div>
        </div>

        <div className="p-5">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-14">
              <UserCircle2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No se encontraron usuarios con esos filtros.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredUsers.map((user) => (
                <article
                  key={user.id}
                  className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-slate-50 dark:from-gray-900 dark:to-gray-900/70 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={user.imageUrl || buildAvatarDataUrl(user.name, user.email)}
                        alt={`Foto de ${user.name}`}
                        className="h-16 w-16 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-gray-700 shadow-sm"
                      />
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{user.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${user.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                      {user.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium">{user.role?.name ?? 'Sin rol'}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">({user.role?.code ?? 'N/A'})</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Creado el {formatDate(user.createdAt)}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-800 pt-4">
                    <button
                      onClick={() => openEdit(user)}
                      className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Editar
                    </button>
                    <button
                      onClick={() => void handleDelete(user)}
                      className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm text-red-700 dark:text-red-300 flex items-center gap-2"
                    >
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Foto del usuario</label>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="shrink-0">
                      <ImageWithFallback
                        src={form.imageUrl || buildAvatarDataUrl(form.name || 'Usuario', form.email || 'usuario@erp.local')}
                        alt="Vista previa del usuario"
                        className="h-24 w-24 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-gray-700 shadow-sm"
                      />
                    </div>
                    <div className="flex-1 space-y-3">
                      <label className="block border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center hover:border-blue-600 dark:hover:border-blue-500 transition-colors cursor-pointer">
                        <Image className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">Click para subir foto</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">PNG, JPG o WEBP hasta 2 MB</p>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/jpg"
                          className="hidden"
                          onChange={(event) => void handleImageChange(event)}
                        />
                      </label>
                      {form.imageUrl ? (
                        <button
                          type="button"
                          onClick={clearSelectedImage}
                          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                        >
                          Quitar foto
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nombre completo *</label>
                  <input type="text" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Correo *</label>
                  <input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rol *</label>
                  <select value={form.roleId} onChange={(event) => setForm((prev) => ({ ...prev, roleId: event.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{editingUser ? 'Nueva contraseña' : 'Contraseña *'}</label>
                  <input type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} placeholder={editingUser ? 'Déjala vacía para mantenerla' : 'Mínimo 8 caracteres'} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="user-active" type="checkbox" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
                <label htmlFor="user-active" className="text-sm text-gray-700 dark:text-gray-300">Usuario activo</label>
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
