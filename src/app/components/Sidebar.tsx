import { Link, useLocation } from 'react-router';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  ShoppingBag, 
  Package, 
  Box,
  Tags,
  Users, 
  Building2, 
  Wallet, 
  FileText, 
  ShieldCheck,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import type { AppPermission } from '../types/auth';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.read' as AppPermission },
  { path: '/ventas', label: 'Ventas', icon: ShoppingCart, permission: 'sales.read' as AppPermission },
  { path: '/compras', label: 'Compras', icon: ShoppingBag, permission: 'purchases.read' as AppPermission },
  { path: '/inventario', label: 'Inventario', icon: Package, permission: 'inventory.read' as AppPermission },
  { path: '/productos', label: 'Productos', icon: Box, permission: 'catalog.read' as AppPermission },
  { path: '/categorias', label: 'Categorías', icon: Tags, permission: 'catalog.read' as AppPermission },
  { path: '/clientes', label: 'Clientes', icon: Users, permission: 'clients.read' as AppPermission },
  { path: '/proveedores', label: 'Proveedores', icon: Building2, permission: 'suppliers.read' as AppPermission },
  { path: '/flujo-caja', label: 'Flujo de Caja', icon: Wallet, permission: 'cash.read' as AppPermission },
  { path: '/reportes', label: 'Reportes', icon: FileText, permission: 'reports.read' as AppPermission },
  { path: '/usuarios', label: 'Usuarios', icon: UserCog, permission: 'users.read' as AppPermission },
  { path: '/roles', label: 'Roles', icon: ShieldCheck, permission: 'roles.read' as AppPermission },
  { path: '/configuracion', label: 'Configuración', icon: Settings, permission: 'configuration.manage' as AppPermission },
];

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { hasPermission, user } = useAuth();
  const visibleItems = menuItems.filter((item) => hasPermission(item.permission));

  const sidebarClasses = `fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:flex ${collapsed ? 'md:w-16 w-64' : 'md:w-64 w-64'}`;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}
      <aside className={sidebarClasses}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">ERP Sistema</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Gestión Empresarial</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="md:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            ) : null}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {collapsed ? (
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
        </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
              {user?.name.slice(0, 2).toUpperCase() ?? "US"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name ?? 'Usuario'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email ?? ''}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">{user?.role ?? ''}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
