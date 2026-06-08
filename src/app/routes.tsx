import { createBrowserRouter } from "react-router";
import { ProtectedApp } from "./auth/ProtectedApp";
import { Dashboard } from "./pages/Dashboard";
import { Ventas } from "./pages/Ventas";
import { Compras } from "./pages/Compras";
import { Inventario } from "./pages/Inventario";
import { Productos } from "./pages/Productos";
import { Clientes } from "./pages/Clientes";
import { Proveedores } from "./pages/Proveedores";
import { FlujoCaja } from "./pages/FlujoCaja";
import { Reportes } from "./pages/Reportes";
import { Configuracion } from "./pages/Configuracion";
import { Categorias } from "./pages/Categorias";
import { Login } from "./pages/Login";
import { Usuarios } from "./pages/Usuarios";
import { Roles } from "./pages/Roles";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    Component: ProtectedApp,
    children: [
      { index: true, Component: Dashboard },
      { path: "ventas", Component: Ventas },
      { path: "compras", Component: Compras },
      { path: "inventario", Component: Inventario },
      { path: "productos", Component: Productos },
      { path: "categorias", Component: Categorias },
      { path: "clientes", Component: Clientes },
      { path: "proveedores", Component: Proveedores },
      { path: "flujo-caja", Component: FlujoCaja },
      { path: "reportes", Component: Reportes },
      { path: "usuarios", Component: Usuarios },
      { path: "roles", Component: Roles },
      { path: "configuracion", Component: Configuracion },
    ],
  },
]);
