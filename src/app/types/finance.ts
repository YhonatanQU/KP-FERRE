export interface CashAccount {
  id: string;
  name: string;
  type: "CASH" | "BANK" | "E_WALLET";
  currency: string;
  openingBalance: number | string;
  isActive: boolean;
}

export interface CashMovement {
  id: string;
  movementType: "INGRESO" | "EGRESO";
  category: "VENTA" | "COMPRA" | "NOMINA" | "SERVICIO" | "OTRO";
  description: string;
  amount: number | string;
  runningBalance: number | string;
  movementDate: string;
  account?: {
    id: string;
    name: string;
    type: string;
  };
}

export interface CashSummary {
  totalIngresos: number | string;
  totalEgresos: number | string;
  balanceNeto: number | string;
  balanceActual: number | string;
}

export interface DashboardPayload {
  kpis: {
    ventasDelDia: number;
    ingresosMensuales: number;
    productosBajoStock: number;
    balanceCaja: number;
  };
  series: Array<{
    mes: string;
    ventas: number;
    compras: number;
  }>;
  topProducts: Array<{
    nombre: string;
    cantidad: number;
    valor: number;
  }>;
  stockBajo: Array<{
    producto: string;
    stock: number;
    minimo: number;
  }>;
  recentActivity: Array<{
    tipo: string;
    descripcion: string;
    monto: number;
    fecha: string;
    responsable: string;
    color: "green" | "red" | "blue";
  }>;
}
