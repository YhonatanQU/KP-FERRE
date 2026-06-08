import { useEffect, useState } from 'react';
import { Edit, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import { createRole, deleteRole, fetchRolePermissions, fetchRoles, updateRole } from '../services/admin';
import type { PermissionEntity, RoleEntity } from '../types/admin';

export function Roles() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleEntity | null>(null);
  const [roles, setRoles] = useState<RoleEntity[]>([]);
  const [permissions, setPermissions] = useState<PermissionEntity[]>([]);
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    isActive: true,
    permissionCodes: [] as string[],
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [rolesData, permissionsData] = await Promise.all([fetchRoles(), fetchRolePermissions()]);
      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar los roles';
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
    setEditingRole(null);
    setForm({
      code: '',
      name: '',
      description: '',
      isActive: true,
      permissionCodes: [],
    });
    setShowModal(true);
  };

  const openEdit = (role: RoleEntity) => {
    setEditingRole(role);
    setForm({
      code: role.code,
      name: role.name,
      description: role.description ?? '',
      isActive: role.isActive,
      permissionCodes: role.permissions.map((permission) => permission.code),
    });
    setShowModal(true);
  };

  const togglePermission = (permissionCode: string) => {
    setForm((prev) => ({
      ...prev,
      permissionCodes: prev.permissionCodes.includes(permissionCode)
        ? prev.permissionCodes.filter((code) => code !== permissionCode)
        : [...prev.permissionCodes, permissionCode],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim() || form.permissionCodes.length === 0) {
      toast.error('Código, nombre y permisos son obligatorios');
      return;
    }

    setIsSaving(true);
    try {
      if (editingRole) {
        await updateRole(editingRole.id, {
          ...(editingRole.isSystem ? {} : { code: form.code.trim().toUpperCase() }),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          isActive: form.isActive,
          permissionCodes: form.permissionCodes,
        });
        toast.success('Rol actualizado');
      } else {
        await createRole({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          isActive: form.isActive,
          permissionCodes: form.permissionCodes,
        });
        toast.success('Rol creado');
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar el rol';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (role: RoleEntity) => {
    const confirmed = window.confirm(`¿Eliminar el rol "${role.name}"?`);
    if (!confirmed) return;
    try {
      await deleteRole(role.id);
      toast.success('Rol eliminado');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el rol';
      toast.error(message);
    }
  };

  const columns = [
    { key: 'name', label: 'Rol', sortable: true },
    { key: 'code', label: 'Código', sortable: true },
    {
      key: 'permissionsCount',
      label: 'Permisos',
      sortable: true,
      render: (value: number) => <span className="font-semibold text-gray-900 dark:text-white">{value}</span>,
    },
    {
      key: 'usersCount',
      label: 'Usuarios',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Estado',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs ${value === 'Activo' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
          {value}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Acciones',
      render: (_value: string, row: any) => (
        <div className="flex gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              openEdit(row.raw);
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
          {!row.raw.isSystem ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                void handleDelete(row.raw);
              }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              <Shield className="w-3 h-3" />
              Sistema
            </span>
          )}
        </div>
      ),
    },
  ];

  const rows = roles.map((role) => ({
    id: role.id,
    name: role.name,
    code: role.code,
    permissionsCount: role.permissions.length,
    usersCount: role.usersCount,
    status: role.isActive ? 'Activo' : 'Inactivo',
    raw: role,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roles</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Control de privilegios, permisos y perfiles operativos</p>
        </div>
      </div>

      {loading && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Cargando roles...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">Error al cargar roles: {error}</div>}

      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar roles por nombre o código..."
        onAdd={openCreate}
        addButtonLabel="Nuevo Rol"
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingRole ? 'Editar Rol' : 'Nuevo Rol'}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Código *</label>
                  <input type="text" disabled={Boolean(editingRole?.isSystem)} value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-60" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nombre *</label>
                  <input type="text" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descripción</label>
                <textarea rows={3} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              </div>

              <div className="flex items-center gap-2">
                <input id="role-active" type="checkbox" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
                <label htmlFor="role-active" className="text-sm text-gray-700 dark:text-gray-300">Rol activo</label>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Permisos del rol</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {permissions.map((permission) => (
                    <label key={permission.code} className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <input
                        type="checkbox"
                        checked={form.permissionCodes.includes(permission.code)}
                        onChange={() => togglePermission(permission.code)}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{permission.name}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{permission.description}</p>
                        <p className="mt-1 font-mono text-[11px] text-blue-600 dark:text-blue-400">{permission.code}</p>
                      </div>
                    </label>
                  ))}
                </div>
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
