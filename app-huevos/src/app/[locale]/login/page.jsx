'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [debugEmail, setDebugEmail] = useState('');
    const router = useRouter();
    const locale = useLocale();

    // Strict cleaning: only alphanumeric
    const getEmail = (user) => {
        // Si ya parece un email, usarlo tal cual; si no, transformarlo
        if (user.includes('@')) return user.toLowerCase().trim();
        const cleanUser = user.toLowerCase().replace(/[^a-z0-9]/g, '');
        return `${cleanUser}@example.com`;
    };

    const [statusM, setStatusM] = useState(''); // Estado para mensajes de depuración visible
    const [retryCount, setRetryCount] = useState(0);
    const [existingUsers, setExistingUsers] = useState([]);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]); // [NEW] Logs for debugging
    const [showDebug, setShowDebug] = useState(false); // [NEW] Toggle debug view

    // [NEW] Helper to add logs
    const addLog = (msg) => {
        const time = new Date().toLocaleTimeString();
        setDebugLogs(prev => [`[${time}] ${msg}`, ...prev]);
        console.log(`[LoginDebug] ${msg}`);
    };

    // [NEW] Global Error Boundary for this component
    useEffect(() => {
        const handleError = (event) => {
            const errorMsg = event.error?.message || event.message || 'Unknown error';
            addLog(`❌ Global Error: ${errorMsg}`);
            setStatusM(`CRITICAL ERROR: ${errorMsg}`);
            setLoading(false);
            setShowDebug(true); // Auto-show logs on error
        };

        const handleRejection = (event) => {
            const errorMsg = event.reason?.message || 'Unhandled Promise Rejection';
            addLog(`❌ Unhandled Rejection: ${errorMsg}`);
            setStatusM(`PROMISE ERROR: ${errorMsg}`);
            setLoading(false);
            setShowDebug(true); // Auto-show logs on error
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        // Check for URL errors (from AuthProvider redirect)
        const params = new URLSearchParams(window.location.search);
        const urlError = params.get('error');
        if (urlError === 'pending') {
            setError('Tu cuenta está pendiente de aprobación por un administrador.');
        } else if (urlError === 'disabled') {
            setError('Tu cuenta ha sido deshabilitada. Contacta a un administrador.');
        }

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    // Load existing users in development mode
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    setExistingUsers(data);
                }
            } catch (err) {
                console.error('Error loading users:', err);
            }
        };

        if (process.env.NODE_ENV === 'development') {
            loadUsers();
        }
    }, []);

    const performLogin = async (email, password, isRetry = false) => {
        const stepPrefix = isRetry ? '(Retry) ' : '';
        addLog(`${stepPrefix}Starting Client-Side Login for: ${email}`);
        setStatusM(isRetry ? 'Reintentando login (Intento 2)...' : 'Iniciando sesión...');

        try {
            if (!supabase) throw new Error('Cliente Supabase no inicializado');

            addLog(`${stepPrefix}Calling supabase.auth.signInWithPassword...`);
            setStatusM(`${isRetry ? 'R2' : '2'}. Autenticando con Supabase...`);

            const startTime = Date.now();

            // Direct Client-Side Auth
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);

            if (error) {
                addLog(`${stepPrefix}❌ Supabase Auth Error (${duration}s): ${error.message}`);
                throw error;
            }

            addLog(`${stepPrefix}✅ Auth successful! Session: ${data.session?.user?.email}`);
            setStatusM(`4. Login exitoso. Redirigiendo...`);

            // Force session persistence just in case
            if (data.session) {
                await supabase.auth.setSession(data.session);
            }

            addLog(`${stepPrefix}Redirecting to /${locale}/overview in 500ms...`);
            
            // Give a moment for AuthProvider to catch up
            setTimeout(() => {
                try {
                    window.location.href = `/${locale}/overview`;
                } catch (routeErr) {
                    addLog(`${stepPrefix}❌ Routing error: ${routeErr.message}`);
                    setError(`Error de redirección: ${routeErr.message}`);
                    setLoading(false);
                }
            }, 500);

            return true;
        } catch (error) {
            addLog(`${stepPrefix}❌ Login failed: ${error.message}`);
            console.error('Login attempt failed:', error);

            // Retry logic for network/timeouts
            if (!isRetry && (error.message.includes('Timeout') || error.message.includes('fetch') || error.message.includes('Network'))) {
                addLog(`${stepPrefix}Initiating retry in 2s...`);
                setStatusM('Error de conexión. Reintentando en 2 segundos...');
                await new Promise(r => setTimeout(r, 2000));
                return await performLogin(email, password, true);
            }
            throw error;
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setDebugLogs([]); // Clear previous logs
        setShowDebug(false);

        const email = getEmail(username);
        setDebugEmail(email);
        addLog(`User clicked login. Raw: "${username}", Processed: "${email}"`);

        try {
            await performLogin(email, password);
        } catch (error) {
            let userMsg = error.message;
            if (error.message.includes('Invalid login') || error.message.includes('Credenciales')) {
                userMsg = 'Usuario o contraseña incorrectos';
            }
            if (error.message.includes('Email not confirmed')) userMsg = 'Email no confirmado en Supabase';
            if (error.message.includes('Failed to fetch') || error.message.includes('Timeout') || error.message.includes('Network')) {
                userMsg = 'Error de conexión con el servidor (Posiblemente inactivo o sin internet).';
            }

            addLog(`❌ HandleLogin Error caught: ${error.message} -> Display: ${userMsg}`);
            setError(userMsg);
            setStatusM(`Falló: ${userMsg}`);
            setLoading(false);
            setShowDebug(true); // Show logs on error
        }
    };

    const handleSignUp = async () => {
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres (Requisito de seguridad). Intenta "HUEVOS" o "HUEVO1".');
            return;
        }

        setLoading(true);
        setStatusM('Intentando registro...');
        const email = getEmail(username);
        setDebugEmail(email);

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password
            });
            if (error) throw error;
            toast.success('Usuario registrado. Ingresando...');
            setStatusM('Registro exitoso. Logueando...');

            const { error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (!loginError) {
                setStatusM('Redirigiendo...');
                router.push(`/${locale}/overview`);
            } else {
                if (loginError.message.includes('Email not confirmed')) {
                    toast.success('Registro exitoso, pero Supabase requiere confirmación de Email. Por favor desactiva "Confirm Email" en el dashboard de Supabase.');
                } else {
                    router.push(`/${locale}/overview`);
                }
            }

        } catch (error) {
            setError(error.message);
            setStatusM(`Error Registro: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const createQuickTestUser = async () => {
        const testUsername = 'TEST';
        const testPassword = 'test123';
        const email = getEmail(testUsername);

        setLoading(true);
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password: testPassword
            });

            if (error) {
                if (error.message.includes('already registered')) {
                    toast.warning(`Usuario TEST ya existe. Prueba iniciar sesión con:\nUsuario: TEST\nContraseña: test123`);
                    setUsername('TEST');
                    setPassword('test123');
                } else {
                    throw error;
                }
            } else {
                toast.success(`✅ Usuario de prueba creado:\nUsuario: TEST\nContraseña: test123\n\nAhora puedes iniciar sesión con estas credenciales.`);
                setUsername('TEST');
                setPassword('test123');
            }
        } catch (error) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-secondary)',
            padding: '20px'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🥚</div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Horizon Admin
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Inicia sesión con tu Usuario
                    </p>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label className="form-label">Usuario</label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder="Ej: MAESTRO"
                            autoCapitalize="none"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                style={{ paddingRight: '40px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                {showPassword ? '👁️' : '👁️‍🗨️'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            padding: '12px',
                            borderRadius: '8px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            fontSize: '14px',
                            marginBottom: '20px'
                        }}>
                            <strong>Error:</strong> {error}
                            <div style={{ marginTop: '8px', fontSize: '11px', opacity: 0.9 }}>
                                <div>Intento con: <strong>{getEmail(username)}</strong></div>
                                <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                                    Si el error persiste, intenta "Reiniciar Sesión" abajo.
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', marginBottom: '16px' }}
                        disabled={loading}
                    >
                        {loading ? 'INGRESANDO...' : 'INGRESAR'}
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'center' }}>
                        <button
                            type="button"
                            onClick={async () => {
                                setLoading(true);
                                addLog('Forcing session reset...');
                                try {
                                    await supabase.auth.signOut();
                                    localStorage.clear();
                                    sessionStorage.clear();
                                    // Clear cookies (simple approach)
                                    document.cookie.split(";").forEach((c) => {
                                        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                                    });
                                    addLog('Cache and Session cleared. Reloading...');
                                } catch (e) {
                                    addLog(`Reset error: ${e.message}`);
                                }
                                setTimeout(() => {
                                    window.location.href = `/${locale}/login`;
                                }, 500);
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-accent)',
                                cursor: 'pointer',
                                fontSize: '12px',
                                textDecoration: 'underline'
                            }}
                        >
                            Reiniciar Sesión
                        </button>

                        <button
                            type="button"
                            onClick={() => router.push(`/${locale}/register`)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '600'
                            }}
                        >
                            🏢 ¿Quieres registrar una nueva empresa? Haz clic aquí
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowHelpModal(true)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '12px',
                                textDecoration: 'underline'
                            }}
                        >
                            ¿Olvidaste tu contraseña?
                        </button>

                        <div style={{ marginTop: '5px', fontSize: '9px', color: '#9ca3af' }}>
                            UP: {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'YES' : 'NO'} | KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'YES' : 'NO'} | v1.0.5
                        </div>
                    </div>
                </form>

                {/* Development Helper - Show existing users */}
                {process.env.NODE_ENV === 'development' && existingUsers.length > 0 && (
                    <div style={{
                        marginTop: '24px',
                        padding: '16px',
                        background: '#f3f4f6',
                        borderRadius: '8px',
                        border: '1px dashed #9ca3af'
                    }}>
                        <h3 style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#374151',
                            marginBottom: '12px',
                            textAlign: 'center'
                        }}>
                            🔧 Usuarios Registrados (Dev Mode)
                        </h3>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            {existingUsers.map((user, idx) => {
                                // Extract username from email
                                const username = user.email ? user.email.replace('@example.com', '').toUpperCase() : 'N/A';

                                return (
                                    <div key={user.id || idx} style={{
                                        padding: '8px',
                                        background: 'white',
                                        borderRadius: '4px',
                                        marginBottom: '8px',
                                        border: '1px solid #e5e7eb'
                                    }}>
                                        <div style={{ marginBottom: '4px' }}>
                                            <strong>Usuario:</strong> {username}
                                        </div>
                                        <div style={{ marginBottom: '4px', fontSize: '10px', color: '#9ca3af' }}>
                                            Email: {user.email || 'No registrado'}
                                        </div>
                                        {user.full_name && (
                                            <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                                                Nombre: {user.full_name}
                                            </div>
                                        )}
                                        <div style={{ marginTop: '6px', fontSize: '9px', color: '#dc2626', fontStyle: 'italic' }}>
                                            ℹ️ Usa este usuario arriba para ingresar
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{
                            marginTop: '12px',
                            fontSize: '10px',
                            color: '#6b7280',
                            textAlign: 'center',
                            fontStyle: 'italic'
                        }}>
                            Si olvidaste la contraseña, usa "Registrar Usuario" para crear uno nuevo
                        </div>
                    </div>
                )}

                {/* Help Modal */}
                {showHelpModal && (
                    <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
                        <div className="modal" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">💡 Ayuda de Login</h3>
                                <button className="modal-close" onClick={() => setShowHelpModal(false)}>✕</button>
                            </div>
                            <div className="modal-body">
                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
                                        Si olvidaste tu contraseña:
                                    </h4>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                        <p style={{ marginBottom: '12px' }}>
                                            <strong>Opción 1: Crear Usuario de Prueba</strong><br />
                                            La manera más rápida - Haz clic en el botón abajo para crear un usuario TEST con contraseña conocida.
                                        </p>
                                        <button
                                            className="btn btn-primary"
                                            style={{ width: '100%', marginBottom: '16px' }}
                                            onClick={() => {
                                                setShowHelpModal(false);
                                                createQuickTestUser();
                                            }}
                                        >
                                            🚀 Crear Usuario de Prueba (TEST/test123)
                                        </button>

                                        <p style={{ marginBottom: '12px' }}>
                                            <strong>Opción 2: Resetear vía Supabase Dashboard</strong><br />
                                            1. Ve a <a href="https://supabase.com/dashboard" target="_blank" style={{ color: 'var(--text-accent)' }}>Supabase Dashboard</a><br />
                                            2. Authentication → Users<br />
                                            3. Busca tu usuario y haz clic en los 3 puntos (...)<br />
                                            4. Selecciona "Reset Password"<br />
                                            5. Ingresa la nueva contraseña
                                        </p>

                                        <p style={{ marginBottom: '12px' }}>
                                            <strong>Opción 3: Registrar Nuevo Usuario</strong><br />
                                            Usa el botón "Registrar Usuario" en la pantalla de login con un nombre diferente.
                                        </p>
                                    </div>
                                </div>

                                <div style={{
                                    background: 'var(--bg-tertiary)',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    color: 'var(--text-secondary)'
                                }}>
                                    <strong>💡 Tip:</strong> Los usuarios listados abajo fueron encontrados en la base de datos, pero necesitas recordar la contraseña con la que fueron creados.
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowHelpModal(false)}>
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Debug Logs Section */}
                <div style={{
                    position: 'fixed',
                    bottom: '10px',
                    right: '10px',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    pointerEvents: 'none' // Click through container
                }}>
                    {showDebug && (
                        <div style={{
                            width: '350px',
                            maxHeight: '400px',
                            background: 'rgba(0,0,0,0.9)',
                            color: '#00ff00',
                            padding: '10px',
                            borderRadius: '8px',
                            overflowY: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '10px',
                            marginBottom: '10px',
                            pointerEvents: 'auto', // Enable scroll/click
                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                            border: '1px solid #333'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', borderBottom: '1px solid #333', paddingBottom: '3px' }}>
                                <strong>🖥️ DEBUG LOGS</strong>
                                <button onClick={() => setShowDebug(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
                            </div>
                            {debugLogs.map((log, i) => (
                                <div key={i} style={{ marginBottom: '2px', borderBottom: '1px solid #111' }}>{log}</div>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        style={{
                            background: '#333',
                            color: 'white',
                            border: '1px solid #555',
                            borderRadius: '20px',
                            padding: '5px 10px',
                            fontSize: '10px',
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            opacity: 0.7
                        }}
                    >
                        {showDebug ? 'Ocultar Debug' : '🐞 Debug'}
                    </button>
                </div>
            </div>
        </div>
    );
}
