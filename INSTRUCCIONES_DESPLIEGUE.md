# App Huevos — Guia de Despliegue en Nueva Instancia

## Archivos generados

| Archivo | Descripcion |
|---------|-------------|
| `schema_completo.sql` | Schema completo: tablas, funciones, triggers y RLS |
| `seed_completo.sql` | Datos base para que la app funcione sin errores |
| `app-huevos/.env.example` | Variables de entorno necesarias |

---

## 1. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) y crear un nuevo proyecto.
2. Guardar la **contrasena de la DB** en un lugar seguro.
3. En **Project Settings > API** copiar:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon/public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Ejecutar el Schema (SQL Editor)

1. Ir a **SQL Editor** en el Dashboard de Supabase.
2. Pegar y ejecutar el contenido de `schema_completo.sql`.
3. Verificar que no haya errores (las instrucciones estan ordenadas por dependencias).

> **Nota sobre pg_cron**: El bloque del cron job esta comentado por defecto.
> Si el proyecto es Supabase Pro/Team, habilitar `pg_cron` en Extensions y
> descomentar la linea del schedule.

---

## 3. Ejecutar el Seed Data (SQL Editor)

1. Pegar y ejecutar el contenido de `seed_completo.sql`.
2. Cambiar el email y contrasena del usuario maestro ANTES de ejecutar:
   ```sql
   -- Modificar estas lineas en seed_completo.sql:
   email    = 'TU_EMAIL@REAL.com'
   password = 'TuContrasenaSegura123!'
   ```

---

## 4. Crear Storage Bucket para imágenes de productos

1. Ir a **Storage** en el Dashboard de Supabase.
2. Crear un bucket nuevo:
   - **Nombre**: `products`
   - **Público**: `true`
   - **Allowed MIME types**: `image/*`

---

## 5. Configurar variables de entorno en Vercel

1. En el Dashboard de Vercel, ir al proyecto > **Settings > Environment Variables**.
2. Agregar las tres variables del `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL              = https://XXXXXXXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY         = eyJ...
SUPABASE_SERVICE_ROLE_KEY             = eyJ...

# Control de Licencia y Modulos Remotos
NEXT_PUBLIC_LICENSE_KEY               = LIC-CLIENTE-1234
NEXT_PUBLIC_MASTER_LICENSE_SERVER_URL = https://licencias.tudominio.com
```

3. Para desarrollo local, copiar `.env.example` a `.env.local` y completarlo:
   ```bash
   cp app-huevos/.env.example app-huevos/.env.local
   # Editar .env.local con los valores reales
   ```

---

## 6. Ubicacion del cliente Supabase en Next.js

El proyecto tiene dos archivos cliente de Supabase:

| Archivo | Uso |
|---------|-----|
| `src/lib/supabase.js` | **Principal** — Incluye custom fetch con manejo de errores de red. Usado por `api.js`. |
| `src/lib/supabaseClient.js` | Secundario/legacy |

Todas las llamadas a la DB pasan por `src/lib/api.js` que importa desde `src/lib/supabase.js`.

**No hay necesidad de modificar ningun archivo de codigo** al cambiar de instancia.
Solo actualizar `.env.local` (desarrollo) o las variables en Vercel (produccion).

---

## 7. Primer login

- Email: `admin@miempresa.com` (o el que configuraste en el seed)
- Contrasena: `CambiarEsta123!` (o la que configuraste)
- Cambiar la contrasena desde la pestaña **Usuarios** o desde Supabase Auth.

---

## 8. Configuracion post-despliegue

Desde el panel de la app (una vez logueado):

1. **Settings > Configuracion de Empresa**: Ingresar CUIT, razon social, domicilio fiscal.
2. **Zonas**: Crear las zonas de reparto.
3. **Productos**: Cargar el catalogo de productos.
4. **Precios**: Configurar las listas de precios y asignar a clientes.
5. **Fiscal > Configuracion ARCA** (opcional): Ingresar credenciales para factura electronica.

---

## Tablas creadas por el schema

### Operaciones
`profiles`, `usuarios`, `zones`, `products`, `price_lists`, `price_list_items`,
`clients`, `sales`, `sale_items`, `collections`, `client_adjustments`,
`providers`, `expenses`, `purchases`, `purchase_items`, `provider_adjustments`,
`transfers`, `arqueo_categories`, `scheduled_price_changes`, `audit_logs`

### Modulo Fiscal (ARCA/AFIP)
`condicion_fiscal`, `alicuotas_iva`, `tipo_comprobante`, `regimenes_retencion`,
`iibb_jurisdicciones`, `empresa_config`, `comprobantes`, `comprobante_items`,
`retenciones_percepciones`, `periodos_fiscales`, `auditoria_comprobantes`,
`arca_configuracion`, `arca_puntos_venta`, `arca_ws_log`

### Funciones DB
- `apply_scheduled_prices()` — Aplica cambios de precios programados
- `calcular_liquidacion_iva(anio, mes)` — Calcula la liquidacion de IVA del periodo
- `handle_new_user()` — Trigger: crea profile automaticamente al registrar usuario
