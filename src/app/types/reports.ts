export interface DailyReportItem {
  fecha: string;
  ventas: number;
  compras: number;
}

export interface PaymentMethodItem {
  metodo: string;
  total: number;
  cantidad: number;
}

export interface DailyReport {
  daily: DailyReportItem[];
  paymentMethods: PaymentMethodItem[];
}

export interface ReportsOverview {
  summary: {
    totalSalesMonth: number;
    totalPurchasesMonth: number;
    totalProducts: number;
    totalClients: number;
  };
  salesByMonth: Array<{
    mes: string;
    ventas: number;
    meta: number;
  }>;
  salesByCategory: Array<{
    categoria: string;
    valor: number;
  }>;
  topClients: Array<{
    cliente: string;
    total: number;
  }>;
}

export interface CompanySettings {
  businessName: string;
  ruc: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}
