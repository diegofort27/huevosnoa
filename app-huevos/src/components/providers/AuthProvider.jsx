'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(true);
    const [status, setStatus] = useState('VERIFICANDO SESIÓN...');
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const mountedRef = useRef(true);

    // Separated profile fetcher - can be called independently and retried
    const fetchProfile = useCallback(async (userId, attempt = 1) => {
        if (!userId) return null;
        if (attempt === 1) setProfileLoading(true);
        try {
            // Race against a 10s timeout to prevent hanging
            const profilePromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Profile fetch timeout (10s)')), 10000)
            );

            const { data: prof, error: profError } = await Promise.race([profilePromise, timeoutPromise]);

            if (!profError && prof && mountedRef.current) {
                console.log('Auth: Profile loaded OK');
                setProfile(prof);
                setProfileLoading(false);
                return prof;
            } else if (profError) {
                console.error('Error fetching profile:', profError);
            }
        } catch (pErr) {
            console.error(`Exception fetching profile (attempt ${attempt}):`, pErr.message);
        }

        // Retry up to 3 times with increasing delay
        if (attempt < 3 && mountedRef.current) {
            const delay = attempt * 2000; // 2s, 4s
            console.warn(`Auth: Retrying profile in ${delay}ms (attempt ${attempt + 1}/3)`);
            await new Promise(r => setTimeout(r, delay));
            if (mountedRef.current) return fetchProfile(userId, attempt + 1);
        }

        if (mountedRef.current) {
            console.error('Auth: All profile fetch attempts failed');
            setProfileLoading(false);
        }
        return null;
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        const stopLoading = () => {
            if (mountedRef.current) setLoading(false);
        };

        // Failsafe: Force stop session loading after 5 seconds
        const backupTimeout = setTimeout(() => {
            console.warn('Auth: Failsafe triggered after 5s');
            stopLoading();
        }, 5000);

        const checkSession = async () => {
            try {
                setStatus('RECUPERANDO SESIÓN...');
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('Session error detected:', sessionError);
                    if (sessionError.message?.includes('Refresh Token') || sessionError.status === 400) {
                        console.warn('Invalid session, clearing auth...');
                        await supabase.auth.signOut();
                    }
                    throw sessionError;
                }

                if (mountedRef.current) {
                    const u = session?.user ?? null;
                    setUser(u);
                    // Stop session loading immediately - don't wait for profile
                    stopLoading();

                    if (u) {
                        setStatus('CARGANDO PERFIL...');
                        // Fetch profile in background
                        fetchProfile(u.id);
                    } else {
                        setProfileLoading(false);
                    }
                }
            } catch (err) {
                console.error('Auth initialization error:', err);
                stopLoading();
                if (mountedRef.current) setProfileLoading(false);
            }
        };

        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (mountedRef.current) {
                console.log('Auth: AuthStateChanged', event);
                const u = session?.user ?? null;
                setUser(u);

                if (u) {
                    fetchProfile(u.id);
                } else {
                    setProfile(null);
                    setProfileLoading(false);
                }

                if (event === 'SIGNED_IN' && pathname && pathname.includes('/login')) {
                    // Redirect is handled by the login page or protection useEffect
                }
            }
        });

        return () => {
            mountedRef.current = false;
            clearTimeout(backupTimeout);
            subscription.unsubscribe();
        };
    }, []);

    // Validation logic for approved/disabled status (Desactivado a petición del usuario para permitir acceso)
    useEffect(() => {
        if (user && profile && !profileLoading) {
            if (profile.is_disabled) {
                console.warn('Auth: Cuenta deshabilitada. (Redirección desactivada temporalmente)');
                // supabase.auth.signOut().then(() => {
                //     window.location.href = `/${locale}/login?error=disabled`;
                // });
            } else if (!profile.is_approved) {
                console.warn('Auth: Cuenta pendiente de aprobación. (Redirección desactivada temporalmente)');
                // supabase.auth.signOut().then(() => {
                //     window.location.href = `/${locale}/login?error=pending`;
                // });
            }
        }
    }, [user, profile, profileLoading, locale]);

    // Protection logic
    useEffect(() => {
        if (!loading && !user && pathname && !pathname.includes('/login')) {
            console.log('Auth: No user, redirecting to login');
            router.push(`/${locale}/login`);
        }
    }, [user, loading, pathname, locale]);

    const signOut = async () => {
        try {
            console.log('Auth: Logging out...');
            await supabase.auth.signOut();
            window.location.href = `/${locale}/login`;
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = `/${locale}/login`;
        }
    };

    const hasPermission = (permission) => {
        if (!profile) return false;
        
        // 1. Verificamos si es Admin (tiene acceso a todo)
        const currentRole = (profile.role || profile.roles?.name || '').toLowerCase();
        if (currentRole === 'admin' || currentRole === 'administrador') return true;

        // 2. Definición de perfiles estándar (Fallback inmediato hasta que se migre la DB)
        const standardPermissions = {
            vendedor: ['view_dashboard', 'view_sales', 'create_sales', 'view_products', 'view_clients'],
            administrativo: ['view_dashboard', 'view_sales', 'view_analytics', 'view_collections', 'view_products', 'manage_products', 'view_clients'],
            cobrador: ['view_dashboard', 'view_collections', 'create_collections', 'view_clients']
        };

        // Si el rol tiene el permiso asignado por defecto, lo permitimos
        if (standardPermissions[currentRole]?.includes(permission)) {
            return true;
        }

        // 3. Verificamos permisos personalizados en el perfil (si existen)
        // (Esto soportará la migración SQL cuando se conecte al objeto profile)
        return profile.permissions?.[permission] === true || profile.custom_permissions?.includes(permission);
    };

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                width: '100vw',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0f172a',
                color: 'white',
                flexDirection: 'column',
                gap: '20px',
                fontFamily: 'sans-serif'
            }}>
                <div style={{
                    fontSize: '64px',
                    animation: 'pulse 1.5s infinite ease-in-out'
                }}>🥚</div>
                <div style={{ fontSize: '18px', letterSpacing: '1px', fontWeight: '500' }}>{status}</div>
                <button
                    onClick={() => setLoading(false)}
                    style={{
                        marginTop: '20px',
                        background: 'transparent',
                        border: '1px solid #ffffff44',
                        color: '#ffffff88',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    Omitir espera
                </button>
                <style>{`
                    @keyframes pulse {
                        0% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.1); opacity: 0.7; }
                        100% { transform: scale(1); opacity: 1; }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, profile, loading, profileLoading, signOut, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
