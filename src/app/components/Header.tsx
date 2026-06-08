import { Search, Bell, LogOut, Moon, Sun, Package, Users, ShoppingCart, X, Loader2, Menu } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthProvider';
import { fetchProducts } from '../services/catalog';
import { fetchClients } from '../services/crm';
import { fetchSales } from '../services/sales';

interface HeaderProps {
  onSidebarToggle?: () => void;
}
import type { Product } from '../types/catalog';
import type { ClientEntity } from '../types/crm';
import type { Sale } from '../types/sale';

interface SearchResults {
  products: Product[];
  clients: ClientEntity[];
  sales: Sale[];
}

const EMPTY_RESULTS: SearchResults = { products: [], clients: [], sales: [] };

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const total = results.products.length + results.clients.length + results.sales.length;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search when debounced query changes
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY_RESULTS);
      setOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setOpen(true);

    const lower = trimmed.toLowerCase();

    Promise.all([
      fetchProducts({ search: trimmed }).catch(() => [] as Product[]),
      fetchClients({ search: trimmed }).catch(() => [] as ClientEntity[]),
      fetchSales().catch(() => [] as Sale[]),
    ]).then(([products, clients, allSales]) => {
      if (cancelled) return;
      const sales = allSales.filter(
        s =>
          s.number.toLowerCase().includes(lower) ||
          s.client?.name?.toLowerCase().includes(lower),
      ).slice(0, 5);
      setResults({
        products: products.slice(0, 5),
        clients: clients.slice(0, 5),
        sales,
      });
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const handleSelect = useCallback((path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults(EMPTY_RESULTS);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-2xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (debouncedQuery.trim().length >= 2) setOpen(true); }}
          placeholder="Buscar productos, clientes, facturas..."
          className="w-full pl-10 pr-10 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden max-h-[420px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-gray-500 dark:text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Buscando...
            </div>
          ) : total === 0 ? (
            <div className="py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              Sin resultados para &ldquo;{debouncedQuery}&rdquo;
            </div>
          ) : (
            <>
              {results.products.length > 0 && (
                <ResultGroup
                  icon={<Package className="w-3.5 h-3.5" />}
                  label="Productos"
                  viewAllPath="/productos"
                  onViewAll={() => handleSelect('/productos')}
                >
                  {results.products.map(p => (
                    <ResultItem
                      key={p.id}
                      title={p.name}
                      subtitle={`SKU: ${p.sku}${p.category ? ` · ${p.category.name}` : ''}`}
                      onClick={() => handleSelect('/productos')}
                    />
                  ))}
                </ResultGroup>
              )}

              {results.clients.length > 0 && (
                <ResultGroup
                  icon={<Users className="w-3.5 h-3.5" />}
                  label="Clientes"
                  viewAllPath="/clientes"
                  onViewAll={() => handleSelect('/clientes')}
                >
                  {results.clients.map(c => (
                    <ResultItem
                      key={c.id}
                      title={c.name}
                      subtitle={`${c.docType}: ${c.docNumber}${c.email ? ` · ${c.email}` : ''}`}
                      onClick={() => handleSelect('/clientes')}
                    />
                  ))}
                </ResultGroup>
              )}

              {results.sales.length > 0 && (
                <ResultGroup
                  icon={<ShoppingCart className="w-3.5 h-3.5" />}
                  label="Ventas"
                  viewAllPath="/ventas"
                  onViewAll={() => handleSelect('/ventas')}
                >
                  {results.sales.map(s => (
                    <ResultItem
                      key={s.id}
                      title={`Venta ${s.number}`}
                      subtitle={`${s.client?.name ?? ''} · S/ ${Number(s.grandTotal).toFixed(2)} · ${s.status}`}
                      onClick={() => handleSelect('/ventas')}
                    />
                  ))}
                </ResultGroup>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  icon,
  label,
  children,
  onViewAll,
}: {
  icon: React.ReactNode;
  label: string;
  viewAllPath: string;
  onViewAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {icon}
          {label}
        </div>
        <button
          onClick={onViewAll}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Ver todos
        </button>
      </div>
      <div>{children}</div>
      <div className="h-px bg-gray-100 dark:bg-gray-800 mx-3 mt-1" />
    </div>
  );
}

function ResultItem({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{title}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>
    </button>
  );
}

export function Header({ onSidebarToggle }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Sesión cerrada');
    navigate('/login', { replace: true });
  };

  if (!mounted) {
    return (
      <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            onClick={onSidebarToggle}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar productos, clientes, facturas..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              readOnly
            />
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4">
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name ?? 'Usuario'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role ?? ''}</p>
          </div>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative">
            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          type="button"
          onClick={onSidebarToggle}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-3 ml-4">
        <div className="hidden md:block text-right">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name ?? 'Usuario'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role ?? ''}</p>
        </div>

        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          )}
        </button>

        <button
          onClick={() => void handleLogout()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    </header>
  );
}
