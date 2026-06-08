Actúa como un diseñador UX/UI senior y arquitecto de software especializado en sistemas ERP modernos.

Crea una plantilla de aplicación web RESPONSIVA (desktop, tablet y móvil) para un sistema de gestión empresarial que incluya:

- Ventas
- Compras
- Inventario
- Flujo de Caja

El diseño debe ser moderno, limpio, profesional y enfocado en productividad (estilo SaaS tipo ERP/CRM como Shopify, Odoo o Stripe).

---

### 🔹 ESTRUCTURA GENERAL:
- Sidebar lateral con navegación:
  Dashboard
  Ventas
  Compras
  Inventario
  Productos
  Clientes
  Proveedores
  Flujo de Caja
  Reportes
  Configuración

- Header superior:
  Buscador global
  Notificaciones
  Perfil de usuario

- Dashboard principal:
  KPIs:
    - Ventas del día
    - Ingresos mensuales
    - Productos más vendidos
    - Stock bajo
    - Balance de caja

---

### 🔹 MÓDULO DE VENTAS:
- Catálogo de productos (imagen, precio, stock disponible)
- Buscador dinámico y filtros por categoría
- Flujo de ventas estructurado:

  1. Crear COTIZACIÓN:
     - Selección de cliente
     - Agregar productos (tabla dinámica)
     - Cantidad, precio, descuentos
     - Cálculo automático de totales e impuestos

  2. Convertir COTIZACIÓN → VENTA

  3. VENTA DIRECTA:
     - Sin necesidad de cotización previa

- Carrito de venta interactivo
- Selección de métodos de pago (efectivo, transferencia, Yape/Plin)
- Generación de comprobante
- Registro automático en flujo de caja

---

### 🔹 MÓDULO DE COMPRAS:
- Catálogo de productos para compra
- Creación de PEDIDOS a proveedores:
  - Selección de proveedor
  - Lista de productos
  - Cantidades y costos

- Registro de compras:
  - Confirmación de pedido
  - Actualización automática del inventario

- Historial de compras
- Registro automático como egreso en flujo de caja

---

### 🔹 MÓDULO DE INVENTARIO:
- Stock en tiempo real
- Alertas de stock mínimo
- Movimientos de inventario:
  - Entradas (compras)
  - Salidas (ventas)

- Kardex por producto
- Edición rápida de stock
- Indicadores visuales (colores para stock crítico)

---

### 🔹 MÓDULO DE FLUJO DE CAJA:
- Registro automático de:
  - Ingresos (ventas)
  - Egresos (compras, gastos)

- Vista tipo libro de caja:
  - Fecha
  - Tipo (ingreso/egreso)
  - Descripción
  - Monto
  - Balance acumulado

- Filtros por fecha
- Gráficos de flujo de dinero
- Resumen diario, semanal y mensual

---

### 🔹 DISEÑO UI/UX:
- Estilo moderno tipo dashboard SaaS
- Uso de:
  - Tarjetas (cards)
  - Tablas limpias
  - Formularios modales
  - Botones claros y jerarquía visual

- Paleta de colores profesional:
  Azul, blanco, gris (con acentos en verde/rojo para estados)

- Iconografía clara e intuitiva
- Microinteracciones y animaciones suaves

---

### 🔹 COMPONENTES CLAVE:
- Tablas con paginación, búsqueda y filtros
- Formularios dinámicos
- Notificaciones tipo toast
- Gráficos (ventas, inventario, flujo de caja)
- Estados UI:
  loading, vacío, error

---

### 🔹 REQUISITOS TÉCNICOS:
- Diseño completamente responsivo
- Componentes reutilizables
- Navegación fluida entre módulos
- Simulación de datos realistas
- Arquitectura clara tipo sistema ERP

---

### 🔹 ENTREGABLE:
- Prototipo completo navegable
- Pantallas detalladas por módulo
- Flujo lógico entre cotización → venta → caja
- Diseño listo para desarrollo

Prioriza claridad, eficiencia operativa y experiencia del usuario en entornos empresariales.