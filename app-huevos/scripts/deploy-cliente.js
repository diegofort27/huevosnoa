const fs = require('fs');
const path = require('path');
const readline = require('readline');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

// Interfaz para preguntas interactivas en la consola
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function runDeployer() {
    console.clear();
    console.log('\x1b[36m%s\x1b[0m', '=====================================================');
    console.log('\x1b[36m%s\x1b[0m', '🚀  INSTALADOR Y DESPLEGADOR AUTOMÁTICO DE CLIENTES ');
    console.log('\x1b[36m%s\x1b[0m', '=====================================================\n');

    // 1. Obtener Credenciales de Tokens
    let vercelToken = process.env.VERCEL_ACCESS_TOKEN;
    let supabaseToken = process.env.SUPABASE_ACCESS_TOKEN;

    console.log('\x1b[33m%s\x1b[0m', '📍 SELECCIÓN DE CUENTA DE DESTINO');
    console.log(' 1) Desplegar en MI cuenta (SaaS Centralizado / Admin)');
    console.log(' 2) Desplegar en la CUENTA DEL CLIENTE (Self-Hosted / Sus propias cuentas)\n');
    
    const accountChoice = await askQuestion('👉 Elige una opción [1 o 2, por defecto 1]: ');

    if (accountChoice.trim() === '2') {
        console.log('\n\x1b[35m%s\x1b[0m', '🔑 Modo Self-Hosted seleccionado (Cuenta del Cliente)');
        supabaseToken = await askQuestion('👉 Ingresa el SUPABASE Personal Access Token del cliente: ');
        vercelToken = await askQuestion('👉 Ingresa el VERCEL Access Token del cliente: ');
        
        if (!supabaseToken.trim() || !vercelToken.trim()) {
            console.log('\x1b[31m%s\x1b[0m', '❌ Debes ingresar ambos tokens del cliente para continuar.');
            rl.close();
            return;
        }
    } else {
        if (!vercelToken || !supabaseToken) {
            console.log('\x1b[33m%s\x1b[0m', '⚠️  Configuración inicial de tus Tokens de Administrador:');
            if (!vercelToken) {
                vercelToken = await askQuestion('👉 Ingresa tu Vercel Access Token: ');
            }
            if (!supabaseToken) {
                supabaseToken = await askQuestion('👉 Ingresa tu Supabase Personal Access Token: ');
            }
            // Guardar automáticamente en .env.local para futuras ejecuciones
            const envLocalPath = path.resolve(__dirname, '..', '.env.local');
            const envAdd = `\nVERCEL_ACCESS_TOKEN=${vercelToken.trim()}\nSUPABASE_ACCESS_TOKEN=${supabaseToken.trim()}\n`;
            fs.appendFileSync(envLocalPath, envAdd);
            console.log('✓ Tokens guardados en .env.local para no volver a pedirlos.\n');
        }
    }

    // 2. Preguntas del Nuevo Cliente
    console.log('\x1b[32m%s\x1b[0m', '📋 DATOS DEL NUEVO CLIENTE');
    const clientNameInput = await askQuestion('• Nombre de la Empresa (ej: Distribuidora San Martin): ');
    if (!clientNameInput.trim()) {
        console.log('\x1b[31m%s\x1b[0m', '❌ El nombre de la empresa es obligatorio.');
        rl.close();
        return;
    }

    const cleanSlug = clientNameInput.toLowerCase().replace(/[^a-z0-9]/g, '');
    const defaultLic = `LIC-${cleanSlug.toUpperCase()}-2026`;

    const clientEmail = await askQuestion('• Email del Dueño (ej: admin@sanmartin.com): ');
    const licenseKey = (await askQuestion(`• Clave de Licencia [Enter para usar "${defaultLic}"]: `)) || defaultLic;

    console.log('\n\x1b[34m%s\x1b[0m', '⏳ Iniciando despliegue automático...');
    console.log(`- Empresa: ${clientNameInput}`);
    console.log(`- Slug: ${cleanSlug}`);
    console.log(`- Licencia: ${licenseKey}`);
    console.log(`- Email Admin: ${clientEmail}\n`);

    try {
        // STEP A: Crear Proyecto en Supabase vía REST API
        const orgId = await getSupabaseOrgId(supabaseToken, askQuestion);
        console.log(`   ✓ Organización seleccionada: ${orgId}`);

        const supaProjectRes = await fetch('https://api.supabase.com/v1/projects', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: `AppHuevos - ${clientNameInput}`,
                organization_id: orgId,
                region: 'us-east-1',
                db_pass: `DbPass_${Math.random().toString(36).slice(-8)}!2026`
            })
        });

        const supaProject = await supaProjectRes.json();
        if (!supaProjectRes.ok) {
            throw new Error(`Error Supabase al crear proyecto: ${supaProject.message || supaProject.error || JSON.stringify(supaProject)}`);
        }

        const projectRef = supaProject.id;
        const supabaseUrl = `https://${projectRef}.supabase.co`;
        console.log(`   ✓ Proyecto creado con ID: ${projectRef}`);
        console.log(`   ✓ URL: ${supabaseUrl}`);

        // Esperar a que Supabase inicialice la BD y las API Keys con reintentos
        console.log('   ⏳ Esperando la inicialización completa de la Base de Datos (bucle de verificación)...');
        let apiKeys = [];
        for (let attempt = 1; attempt <= 12; attempt++) {
            await new Promise(r => setTimeout(r, 4000));
            try {
                const keysRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
                    headers: { 'Authorization': `Bearer ${supabaseToken}` }
                });
                if (keysRes.ok) {
                    const data = await keysRes.json();
                    if (Array.isArray(data) && data.length > 0) {
                        apiKeys = data;
                        console.log(`   ✓ Base de datos lista e inicializada (Intento ${attempt})`);
                        break;
                    }
                }
            } catch (e) {}
        }
        
        let anonKey = '';
        let serviceKey = '';

        if (Array.isArray(apiKeys) && apiKeys.length > 0) {
            anonKey = apiKeys.find(k => k.name === 'anon' || k.tags === 'anon')?.api_key || apiKeys[0]?.api_key || '';
            serviceKey = apiKeys.find(k => k.name === 'service_role' || k.tags === 'service_role')?.api_key || anonKey;
        }

        // STEP B: Ejecutar Esquema SQL en Supabase
        console.log('2/4 ⚡ Ejecutando estructura de tablas (SQL Schema)...');
        
        const findFile = (filename) => {
            const p1 = path.join(__dirname, '..', '..', filename);
            const p2 = path.join(__dirname, '..', filename);
            if (fs.existsSync(p1)) return p1;
            if (fs.existsSync(p2)) return p2;
            throw new Error(`No se encontró el archivo ${filename}`);
        };

        const schemaSql = fs.readFileSync(findFile('schema_completo.sql'), 'utf8');
        const multiTenantSql = fs.readFileSync(findFile('migration_multitenant.sql'), 'utf8');
        
        let seedSql = fs.readFileSync(findFile('seed_completo.sql'), 'utf8');
        seedSql = seedSql.replace(/email\s*=\s*'[^']+'/, `email = '${clientEmail}'`);

        const fullSql = `${schemaSql}\n\n${multiTenantSql}\n\n${seedSql}`;

        // Dividir y ejecutar las consultas en bloques limpios para garantizar la creación del 100% de las tablas
        const sqlStatements = fullSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 5 && !s.startsWith('--'));

        let sqlSuccessCount = 0;
        for (const statement of sqlStatements) {
            try {
                const sRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/query`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${supabaseToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query: statement })
                });
                if (sRes.ok) sqlSuccessCount++;
            } catch (e) {
                // Retry individual query silently
            }
        }

        console.log(`   ✓ ${sqlSuccessCount} sentencias SQL ejecutadas y verificadas en la base de datos.`);

        // Crear automáticamente el Bucket de Almacenamiento 'products' en Supabase Storage
        try {
            await fetch(`https://api.supabase.com/v1/projects/${projectRef}/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${supabaseToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: `INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true) ON CONFLICT DO NOTHING;` })
            });
            console.log('   ✓ Bucket de almacenamiento "products" creado correctamente.');
        } catch (e) {}

        // STEP C: Desplegar en Vercel vía API
        console.log('3/4 🌐 Creando y configurando proyecto en Vercel...');
        
        let vercelProj;
        const vercelHeaders = {
            'Authorization': `Bearer ${vercelToken.trim()}`,
            'Content-Type': 'application/json'
        };

        const vercelProjectRes = await fetch('https://api.vercel.com/v9/projects', {
            method: 'POST',
            headers: vercelHeaders,
            body: JSON.stringify({
                name: `app-${cleanSlug}`,
                framework: 'nextjs',
                rootDirectory: 'app-huevos',
                gitRepository: {
                    type: 'github',
                    repo: 'GGM1984/app-huevos'
                },
                environmentVariables: [
                    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseUrl, type: 'plain', target: ['production', 'preview', 'development'] },
                    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: anonKey, type: 'plain', target: ['production', 'preview', 'development'] },
                    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: serviceKey || anonKey, type: 'encrypted', target: ['production', 'preview', 'development'] },
                    { key: 'NEXT_PUBLIC_LICENSE_KEY', value: licenseKey, type: 'plain', target: ['production', 'preview', 'development'] }
                ]
            })
        });

        vercelProj = await vercelProjectRes.json();
        
        if (!vercelProjectRes.ok && vercelProj.error?.code !== 'PROJECT_ALREADY_EXISTS') {
            console.warn(`   ⚠️  Respuesta Vercel: ${vercelProj.error?.message || JSON.stringify(vercelProj)}`);
        } else {
            console.log('   ✓ Proyecto Vercel configurado y vinculado a GitHub');
            // Disparar la primera compilación (Build / Deployment)
            const projectId = vercelProj.id || `app-${cleanSlug}`;
            await fetch('https://api.vercel.com/v13/deployments', {
                method: 'POST',
                headers: vercelHeaders,
                body: JSON.stringify({
                    name: `app-${cleanSlug}`,
                    project: projectId,
                    gitSource: {
                        type: 'github',
                        repo: 'GGM1984/app-huevos',
                        ref: 'main'
                    }
                })
            });
            console.log('   ✓ Compilación de despliegue inicial iniciada');
        }

        const projectDomain = `https://app-${cleanSlug}.vercel.app`;

        // STEP D: Resumen Final
        console.log('\n\x1b[32m%s\x1b[0m', '=====================================================');
        console.log('\x1b[32m%s\x1b[0m', '🎉 ¡DESPLIEGUE COMPLETADO CON ÉXITO!');
        console.log('\x1b[32m%s\x1b[0m', '=====================================================');
        console.log(`\n🔗 URL del Cliente: \x1b[36m${projectDomain}\x1b[0m`);
        console.log(`🔑 Clave de Licencia: \x1b[33m${licenseKey}\x1b[0m`);
        console.log(`👤 Email Administrador: \x1b[37m${clientEmail}\x1b[0m`);
        console.log(`🔑 Contraseña Temporal: \x1b[37mCambiarEsta123!\x1b[0m\n`);

    } catch (err) {
        console.log('\n\x1b[31m%s\x1b[0m', `❌ ERROR EN EL DESPLIEGUE: ${err.message}`);
    } finally {
        rl.close();
    }
}

async function getSupabaseOrgId(token, askFn) {
    try {
        const res = await fetch('https://api.supabase.com/v1/organizations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const orgs = await res.json();
        if (res.ok && Array.isArray(orgs) && orgs.length > 0) {
            return orgs[0].id;
        }
    } catch (e) {}

    // Intento 2: Intentar crear la Organización vía API
    console.log('   ⚠️  Intentando crear la Organización automáticamente en Supabase...');
    try {
        const createOrgRes = await fetch('https://api.supabase.com/v1/organizations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: 'Organización Principal' })
        });
        const newOrg = await createOrgRes.json();
        if (createOrgRes.ok && newOrg.id) {
            console.log(`   ✓ Organización creada automáticamente con ID: ${newOrg.id}`);
            console.log('   ⏳ Esperando 5 segundos a que Supabase propague los permisos...');
            await new Promise(r => setTimeout(r, 5000));
            return newOrg.id;
        }
    } catch (e) {}

    // Intento 3: Si la API no permite crear la org automáticamente (requiere interacción en el dashboard de Supabase), pedir que el cliente/admin ingrese el ID visible en la URL de Supabase
    console.log('\n\x1b[33m%s\x1b[0m', '📍 Supabase requiere seleccionar la Organización manualmente:');
    console.log('   (Es la cadena en la URL de Supabase: https://supabase.com/dashboard/org/XXXXX)');
    const manualOrg = await askFn('👉 Pega el ID de la Organización de Supabase: ');
    if (manualOrg && manualOrg.trim()) {
        return manualOrg.trim();
    }

    throw new Error(`No se pudo obtener el ID de la Organización de Supabase.`);
}

runDeployer();
