import { useEffect, useState } from 'react';
import { Building, Bell, Lock, Database, Users as UsersIcon, CreditCard, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCompanySettings, fetchNotificationSettings, updateCompanySettings, updateNotificationSettings } from '../services/reports';
import type { CompanySettings, NotificationSetting } from '../types/reports';

export function Configuracion() {
  const [loading, setLoading] = useState(true);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [company, setCompany] = useState<CompanySettings>({
    businessName: '',
    ruc: '',
    phone: '',
    email: '',
    address: '',
  });
  const [notifications, setNotifications] = useState<NotificationSetting[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [companyData, notificationData] = await Promise.all([
        fetchCompanySettings(),
        fetchNotificationSettings(),
      ]);
      setCompany(companyData);
      setNotifications(notificationData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar configuración';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const saveCompany = async () => {
    if (!company.businessName.trim() || !company.ruc.trim()) {
      toast.error('Razón social y RUC son obligatorios');
      return;
    }
    setIsSavingCompany(true);
    try {
      const updated = await updateCompanySettings({
        businessName: company.businessName.trim(),
        ruc: company.ruc.trim(),
        phone: company.phone?.trim() || '',
        email: company.email?.trim() || '',
        address: company.address?.trim() || '',
      });
      setCompany(updated);
      toast.success('Información actualizada');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar empresa';
      toast.error(message);
    } finally {
      setIsSavingCompany(false);
    }
  };

  const toggleNotification = async (id: string, enabled: boolean) => {
    const next = notifications.map((n) => (n.id === id ? { ...n, enabled } : n));
    setNotifications(next);
    setIsSavingNotifications(true);
    try {
      await updateNotificationSettings(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar notificaciones';
      toast.error(message);
      await loadData();
    } finally {
      setIsSavingNotifications(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Administra las configuraciones del sistema</p>
      </div>

      {loading && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Cargando configuración...
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Building className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Información de la Empresa</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Datos básicos del negocio</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Razón Social</label>
            <input type="text" value={company.businessName} onChange={(e) => setCompany((prev) => ({ ...prev, businessName: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">RUC</label>
            <input type="text" value={company.ruc} onChange={(e) => setCompany((prev) => ({ ...prev, ruc: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Teléfono</label>
            <input type="tel" value={company.phone ?? ''} onChange={(e) => setCompany((prev) => ({ ...prev, phone: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
            <input type="email" value={company.email ?? ''} onChange={(e) => setCompany((prev) => ({ ...prev, email: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dirección</label>
            <input type="text" value={company.address ?? ''} onChange={(e) => setCompany((prev) => ({ ...prev, address: e.target.value }))} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button disabled={isSavingCompany} onClick={() => void saveCompany()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {isSavingCompany ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notificaciones</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Configura las alertas del sistema</p>
          </div>
        </div>

        <div className="space-y-4">
          {notifications.map((notif) => (
            <div key={notif.id} className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{notif.label}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{notif.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notif.enabled}
                  onChange={(e) => void toggleNotification(notif.id, e.target.checked)}
                  className="sr-only peer"
                  disabled={isSavingNotifications}
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="text-left p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800">
            <UsersIcon className="w-5 h-5 mb-2 text-green-600" />
            <p className="font-semibold text-gray-900 dark:text-white">Usuarios y Permisos</p>
          </button>
          <button className="text-left p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800">
            <CreditCard className="w-5 h-5 mb-2 text-yellow-600" />
            <p className="font-semibold text-gray-900 dark:text-white">Métodos de Pago</p>
          </button>
          <button className="text-left p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Database className="w-5 h-5 mb-2 text-orange-600" />
            <p className="font-semibold text-gray-900 dark:text-white">Backup y Respaldo</p>
          </button>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Versión del Sistema</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">ERP Sistema v2.5.1</p>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Lock className="w-5 h-5" />
            <Globe className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
