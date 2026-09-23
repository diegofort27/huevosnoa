# Especificación de Requerimientos del Sistema (SRS)

## 1. Introducción

### 1.1 Propósito del documento
Este documento tiene como objetivo definir de manera clara y detallada los **requerimientos funcionales y no funcionales** para el desarrollo de una **aplicación de gestión para una distribuidora de huevos**, que permita administrar ventas, cobranzas, cuentas corrientes, stock, reportes y listas de precios especiales.

El documento servirá como referencia para desarrolladores, diseñadores, testers y el propietario del sistema.

### 1.2 Alcance del sistema
La aplicación permitirá:
- Registrar y administrar **ventas de huevos**.
- Gestionar **cobranzas parciales y totales** con múltiples medios de pago.
- Llevar **cuentas corrientes de clientes**.
- Controlar **stock**.
- Generar **reportes de caja, ventas, cobranzas y deudores**.
- Manejar **listas de precios especiales** asignables por cliente.

El sistema utilizará **Supabase** como:
- Base de datos (PostgreSQL).
- Sistema de autenticación y gestión de usuarios.

### 1.3 Definiciones y abreviaturas
- **CC**: Cuenta Corriente.
- **Cliente**: Persona o empresa que compra productos.
- **Venta**: Operación de salida de mercadería.
- **Cobranza**: Pago total o parcial de una venta.
- **Caja**: Registro de ingresos y egresos monetarios.

---

## 2. Descripción general

### 2.1 Tipo de aplicación
- Aplicación web responsive.
- Compatible con PC, tablet y smartphone.

### 2.2 Usuarios del sistema
- **Administrador**: Acceso total al sistema.
- **Vendedor**: Carga de ventas y cobranzas.
- **Administrativo**: Gestión de cuentas corrientes y reportes.

### 2.3 Supuestos y dependencias
- Conexión permanente a internet.
- Supabase disponible como backend.
- Navegadores modernos (Chrome, Edge, Firefox).

---

## 3. Requerimientos funcionales

### 3.1 Gestión de usuarios y autenticación
- El sistema debe permitir autenticación mediante **Supabase Auth**.
- Gestión de roles y permisos por usuario.
- Inicio y cierre de sesión.

---

### 3.2 Gestión de clientes
- Alta, baja y modificación de clientes.
- Datos mínimos del cliente:
  - Razón social / Nombre.
  - Dirección.
  - Teléfono.
  - Email.
  - Condición de venta (contado / cuenta corriente).
  - Lista de precios asignada.

---

### 3.3 Gestión de listas de precios
- Creación de múltiples listas de precios.
- Precios por producto y por presentación (ej: bandeja x30).
- Asignación de una lista de precios a uno o varios clientes.
- Posibilidad de modificar precios sin afectar ventas históricas.

---

### 3.4 Gestión de productos y stock
- Alta de productos (ej: huevos bandeja x30).
- Campos mínimos:
  - Código.
  - Descripción.
  - Unidad de venta.
  - Stock actual.
  - Stock mínimo.
- Actualización automática de stock al registrar una venta.
- Alerta visual de stock bajo.

---

### 3.5 Gestión de ventas
- Registro de ventas con los siguientes datos:
  - Cliente.
  - Fecha.
  - Productos vendidos.
  - Cantidades.
  - Precio unitario.
  - Total de la venta.
  - Tipo de venta (contado / cuenta corriente).
- Asociación automática de la venta a la cuenta corriente del cliente.
- Emisión de comprobante interno (no fiscal).

---

### 3.6 Gestión de cobranzas
- Registro de cobranzas parciales y totales.
- Asociación de cobranza a una o varias ventas.
- Medios de pago configurables:
  - Efectivo.
  - Transferencia bancaria.
  - Mercado Pago.
  - Cheque.
  - Otros.
- Registro de fecha, monto y observaciones.
- Actualización automática del saldo del cliente.

---

### 3.7 Cuentas corrientes de clientes
- Visualización de la cuenta corriente por cliente.
- Detalle cronológico de:
  - Ventas.
  - Pagos.
  - Notas de ajuste (si se implementan).
- Cálculo automático de saldo.
- Visualización de saldo total adeudado.

---

### 3.8 Reportes de caja
- Reporte diario, semanal y mensual.
- Total de ingresos por:
  - Medio de pago.
  - Usuario.
- Filtros por fecha.
- Exportación a Excel / PDF (opcional).

---

### 3.9 Reportes de ventas y cobranzas
- Reporte de ventas por:
  - Cliente.
  - Producto.
  - Fecha.
  - Usuario.
- Reporte de cobranzas por:
  - Medio de pago.
  - Cliente.
  - Fecha.

---

### 3.10 Reporte de deudores
- Listado de clientes con saldo pendiente.
- Filtros disponibles:
  - Días de mora.
  - Monto adeudado.
  - Antigüedad de la deuda.
- Ordenamiento ascendente y descendente.
- Visualización rápida del total adeudado.

---

## 4. Requerimientos no funcionales

### 4.1 Seguridad
- Autenticación segura mediante Supabase.
- Control de acceso por roles.
- Registro de acciones críticas (auditoría básica).

### 4.2 Rendimiento
- Respuesta de consultas menores a 2 segundos.
- Optimización de consultas SQL.

### 4.3 Usabilidad
- Interfaz simple e intuitiva.
- Diseño orientado a usuarios no técnicos.
- Flujo de carga rápido para ventas y cobranzas.

### 4.4 Escalabilidad
- Soporte para crecimiento de clientes y transacciones.
- Estructura preparada para futuras funcionalidades.

### 4.5 Mantenibilidad
- Código modular.
- Documentación técnica.
- Uso de buenas prácticas de desarrollo.

---

## 5. Requerimientos técnicos

### 5.1 Backend
- Supabase:
  - PostgreSQL.
  - Auth.
  - Policies (Row Level Security).

### 5.2 Frontend
- Framework web moderno (ej: React / Vue / Next.js).
- Diseño responsive.

### 5.3 Base de datos (entidades principales)
- Usuarios.
- Clientes.
- Productos.
- Listas de precios.
- Ventas.
- Detalle de ventas.
- Cobranzas.
- Medios de pago.
- Movimientos de cuenta corriente.
- Movimientos de stock.

---

## 6. Posibles mejoras futuras
- Integración con facturación electrónica.
- Aplicación móvil nativa.
- Notificaciones de vencimientos.
- Integración con contabilidad.

---

## 7. Aprobación
Este documento deberá ser revisado y aprobado por el solicitante antes de iniciar el desarrollo.

