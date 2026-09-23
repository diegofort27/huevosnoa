# Guía de Despliegue - App Huevos

Sigue estos pasos para desplegar el proyecto desde cero en tus propias cuentas de Supabase y Vercel.

## 1. Preparar Supabase (Base de Datos y Autenticación)

1. Crea una cuenta en [Supabase](https://supabase.com/) y crea un nuevo proyecto.
2. Ve a **SQL Editor** en el panel izquierdo de Supabase.
3. Abre el archivo `schema.sql` incluido en este repositorio. Copia todo su contenido y pégalo en el SQL Editor de Supabase. Ejecútalo (Run) para crear todas las tablas, relaciones y funciones.
   > **Nota:** El archivo `schema.sql` proporcionado es un esquema base reconstruido. Si el proyecto original tiene configuraciones más complejas, se recomienda obtener un volcado (`pg_dump`) directamente de la base de datos original.
4. Abre el archivo `seed.sql`. Copia su contenido y ejecútalo en el SQL Editor. Esto creará el usuario administrador por defecto (`maestro@example.com` con contraseña `temporal123`).

### Configurar Autenticación
1. En Supabase, ve a **Authentication -> Providers** y asegúrate de que **Email** esté habilitado.
2. Ve a **Authentication -> URL Configuration** y asegúrate de configurar las URLs de redirección necesarias (por ejemplo, el dominio que te asigne Vercel más adelante).
3. Ve a **Authentication -> Providers -> Email** y (opcionalmente para empezar) desactiva la opción **Confirm email** para que los usuarios puedan entrar sin validar el correo durante la etapa de pruebas.

## 2. Preparar el Proyecto Localmente

1. Clona o descarga este código en tu computadora.
2. Abre la terminal en la carpeta del proyecto (`app-huevos`).
3. Renombra el archivo `.env.example` a `.env.local` (o `.env`).
4. Ve a tu proyecto de Supabase, entra a **Project Settings -> API** y copia:
   - **Project URL**: Pégalo en la variable `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API Keys (anon, public)**: Pégalo en la variable `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Project API Keys (service_role)**: Pégalo en la variable `SUPABASE_SERVICE_ROLE_KEY` (si aplica).

## 3. Despliegue en Vercel

1. Crea una cuenta en [Vercel](https://vercel.com/) y vincula tu cuenta de GitHub, GitLab o Bitbucket.
2. Sube el código de este proyecto a un repositorio en tu cuenta de GitHub/GitLab.
3. En Vercel, haz clic en **Add New -> Project** e importa tu repositorio.
4. En la sección de **Environment Variables** (Variables de entorno) de la configuración de despliegue en Vercel, agrega las mismas variables que configuraste en tu archivo `.env`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Haz clic en **Deploy**. Vercel construirá y desplegará automáticamente la aplicación.

## 4. Primer Acceso

1. Una vez desplegado, Vercel te dará una URL (ej. `tu-app.vercel.app`).
2. Entra a esa URL y ve a la página de login.
3. Inicia sesión con el usuario maestro que creaste con el archivo `seed.sql`:
   - **Usuario/Email:** `maestro@example.com` (o `MAESTRO`)
   - **Contraseña:** `temporal123`
4. ¡Listo! Ya tienes la plataforma operativa. Te sugerimos cambiar la contraseña del administrador desde Supabase por seguridad.
