'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/components/providers/AuthProvider';
import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'framer-motion';

const NAV_COMMANDS = [
    { id: 'venta-rapida', label: 'Venta Rápida (POS)', icon: '⚡', path: '/venta-rapida', permission: 'sales.create' },
    { id: 'ventas', label: 'Ventas', icon: '🛒', path: '/ventas', permission: 'sales.view' },
    { id: 'cobranzas', label: 'Cobranzas', icon: '💳', path: '/cobranzas', permission: 'collections.view' },
    { id: 'clientes', label: 'Clientes', icon: '👥', path: '/clientes', permission: 'clients.manage' },
    { id: 'productos', label: 'Productos', icon: '📦', path: '/productos', permission: 'products.manage' },
    { id: 'proveedores', label: 'Proveedores', icon: '🏭', path: '/proveedores', permission: 'suppliers.manage' },
    { id: 'gastos', label: 'Egresos', icon: '💸', path: '/gastos', permission: 'expenses.manage' },
    { id: 'compras', label: 'Compras', icon: '🛒', path: '/compras', permission: 'purchases.manage' },
    { id: 'arqueo', label: 'Arqueo de Caja', icon: '🧮', path: '/arqueo', permission: 'arqueo.view' },
    { id: 'reparto', label: 'Reparto', icon: '🚚', path: '/reparto', permission: 'delivery.view' },
    { id: 'zonas', label: 'Zonas', icon: '🗺️', path: '/zonas', permission: 'zones.manage' },
    { id: 'precios', label: 'Lista de Precios', icon: '💲', path: '/precios', permission: 'prices.manage' },
    { id: 'insights', label: 'Insights', icon: '💡', path: '/insights', permission: 'dashboard.view' },
    { id: 'overview', label: 'Overview', icon: '📊', path: '/overview', permission: 'dashboard.view' },
    { id: 'cuentas', label: 'Cuentas Corrientes', icon: '📒', path: '/cuentas', permission: 'accounts.view' },
    { id: 'recibos', label: 'Recibos', icon: '🧾', path: '/recibos', permission: 'collections.view' },
    { id: 'fiscal', label: 'Dashboard Fiscal', icon: '🧾', path: '/fiscal', permission: 'fiscal.view' },
    { id: 'libro-iva', label: 'Libro IVA', icon: '📚', path: '/fiscal/libro-iva', permission: 'fiscal.view' },
    { id: 'charts', label: 'Gráficos', icon: '📈', path: '/reportes/charts', permission: 'reports.view' },
    { id: 'analytics', label: 'Analytics', icon: '📉', path: '/reportes/analytics', permission: 'reports.view' },
    { id: 'usuarios', label: 'Usuarios', icon: '👤', path: '/usuarios', permission: 'users.manage' },
    { id: 'auditoria', label: 'Auditoría', icon: '🕵️', path: '/auditoria', permission: 'users.manage' },
    { id: 'backup', label: 'Backup', icon: '💾', path: '/backup', permission: 'dashboard.view' },
    { id: 'settings', label: 'Configuración', icon: '⚙️', path: '/settings' },
];

const ACTION_COMMANDS = [
    { id: 'new-venta', label: 'Nueva Venta', icon: '➕', path: '/ventas?action=new', permission: 'sales.create' },
    { id: 'new-cobranza', label: 'Nueva Cobranza', icon: '➕', path: '/cobranzas?action=new', permission: 'collections.create' },
    { id: 'new-egreso', label: 'Nuevo Egreso', icon: '➕', path: '/gastos?action=new', permission: 'expenses.manage' },
];

export default function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const router = useRouter();
    const locale = useLocale();
    const { hasPermission } = useAuth();

    const toggle = useCallback(() => setOpen(prev => !prev), []);

    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                toggle();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [toggle]);

    const handleSelect = (path) => {
        const ts = `t=${Date.now()}`;
        const sep = path.includes('?') ? '&' : '?';
        router.push(`/${locale}${path}${sep}${ts}`);
        setOpen(false);
        setSearch('');
    };

    const filterByPermission = (commands) =>
        commands.filter(cmd => !cmd.permission || hasPermission(cmd.permission));

    const visibleActions = filterByPermission(ACTION_COMMANDS);
    const visibleNav = filterByPermission(NAV_COMMANDS);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="cmd-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="cmd-overlay"
                    onClick={() => setOpen(false)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -10 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="cmd-container"
                        onClick={e => e.stopPropagation()}
                    >
                        <Command label="Paleta de comandos" shouldFilter={true}>
                            <div className="cmd-input-wrapper">
                                <span className="cmd-search-icon">🔍</span>
                                <Command.Input
                                    className="cmd-input"
                                    placeholder="Buscar módulo o acción..."
                                    value={search}
                                    onValueChange={setSearch}
                                    autoFocus
                                />
                                <kbd className="cmd-esc-badge">ESC</kbd>
                            </div>

                            <Command.List className="cmd-list">
                                <Command.Empty className="cmd-empty">
                                    Sin resultados para &quot;{search}&quot;
                                </Command.Empty>

                                {visibleActions.length > 0 && (
                                    <Command.Group heading="Acciones rápidas" className="cmd-group">
                                        {visibleActions.map(cmd => (
                                            <Command.Item
                                                key={cmd.id}
                                                value={`${cmd.label} ${cmd.id}`}
                                                onSelect={() => handleSelect(cmd.path)}
                                                className="cmd-item"
                                            >
                                                <span className="cmd-item-icon">{cmd.icon}</span>
                                                <span>{cmd.label}</span>
                                            </Command.Item>
                                        ))}
                                    </Command.Group>
                                )}

                                <Command.Separator className="cmd-separator" />

                                <Command.Group heading="Navegar a" className="cmd-group">
                                    {visibleNav.map(cmd => (
                                        <Command.Item
                                            key={cmd.id}
                                            value={`${cmd.label} ${cmd.id}`}
                                            onSelect={() => handleSelect(cmd.path)}
                                            className="cmd-item"
                                        >
                                            <span className="cmd-item-icon">{cmd.icon}</span>
                                            <span>{cmd.label}</span>
                                        </Command.Item>
                                    ))}
                                </Command.Group>
                            </Command.List>

                            <div className="cmd-footer">
                                <span><kbd>↑↓</kbd> navegar</span>
                                <span><kbd>↵</kbd> seleccionar</span>
                                <span><kbd>Ctrl+K</kbd> abrir/cerrar</span>
                            </div>
                        </Command>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
