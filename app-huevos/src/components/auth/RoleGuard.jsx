'use client';

import { useAuth } from '@/components/providers/AuthProvider';

/**
 * RoleGuard
 * Componente que envuelve elementos UI y los renderiza SOLO si el usuario
 * tiene el permiso especificado.
 * 
 * @param {string} permission - El nombre del permiso requerido (ej. 'products.manage')
 * @param {ReactNode} fallback - Qué mostrar si no tiene permiso (por defecto nada)
 */
export default function RoleGuard({ permission, children, fallback = null }) {
    const { hasPermission, profileLoading, profile } = useAuth();

    if (profileLoading) return null;

    if (!profile || !hasPermission(permission)) {
        return fallback;
    }

    return children;
}

/**
 * PageGuard
 * Protege páginas enteras. Si el usuario no tiene permiso, muestra una pantalla
 * elegante de Acceso Restringido en vez de contenido en blanco.
 */
export function PageGuard({ permission, permissions, children }) {
    const { hasPermission, profileLoading, profile } = useAuth();

    if (profileLoading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Cargando verificación de permisos...
            </div>
        );
    }

    const allowed = permissions 
        ? permissions.some(p => hasPermission(p))
        : (permission ? hasPermission(permission) : true);

    if (profile && !allowed) {
        return (
            <div style={{
                maxWidth: '500px', margin: '60px auto', padding: '32px',
                background: 'var(--bg-secondary)', borderRadius: '12px',
                border: '1px solid var(--border-color)', textAlign: 'center'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Acceso Restringido</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    Tu rol actual no posee los permisos suficientes para acceder a esta sección.
                </p>
                <a href="/" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
                    Volver al Panel Principal
                </a>
            </div>
        );
    }

    return children;
}
