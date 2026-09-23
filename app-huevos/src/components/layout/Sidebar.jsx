'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/components/providers/AuthProvider';
import { useBrand } from '@/components/providers/BrandProvider';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function Sidebar({ isOpen, onClose }) {
    const t = useTranslations('nav');
    const locale = useLocale();
    const pathname = usePathname();
    const { hasPermission, profile, profileLoading } = useAuth();
    const { companyName, companyLogoUrl } = useBrand();

    const isActive = (path) => {
        const fullPath = `/${locale}/${path}`;
        return pathname === fullPath || pathname.endsWith(`/${path}`);
    };

    const mainMenuItems = [
        { href: `/${locale}/arqueo`, icon: '🧮', label: 'Arqueo', key: 'arqueo', permission: 'arqueo.view' },
        { href: `/${locale}/clientes`, icon: '👥', label: t('clients'), key: 'clientes', permission: 'clients.manage' },
        { href: `/${locale}/cobranzas`, icon: '💳', label: t('collections'), key: 'cobranzas', permissions: ['collections.view', 'collections.create', 'collections.delete'] },
        { href: `/${locale}/compras`, icon: '🛒', label: 'Compras', key: 'compras', permission: 'purchases.manage' },
        { href: `/${locale}/cuentas`, icon: '📒', label: t('accounts'), key: 'cuentas', permission: 'accounts.view' },
        { href: `/${locale}/gastos`, icon: '💸', label: 'Egresos', key: 'gastos', permission: 'expenses.manage' },
        { href: `/${locale}/insights`, icon: '💡', label: t('insights'), key: 'insights', permission: 'dashboard.view' },
        { href: `/${locale}/precios`, icon: '💲', label: t('prices'), key: 'precios', permission: 'prices.manage' },
        { href: `/${locale}/productos`, icon: '📦', label: t('products'), key: 'productos', permission: 'products.manage' },
        { href: `/${locale}/proveedores`, icon: '🏭', label: 'Proveedores', key: 'proveedores', permission: 'suppliers.manage' },
        { href: `/${locale}/recibos`, icon: '🧾', label: 'Recibos', key: 'recibos', permission: 'collections.view' },
        { href: `/${locale}/reparto`, icon: '🚚', label: 'Reparto', key: 'reparto', permission: 'delivery.view' },
        { href: `/${locale}/overview`, icon: '📊', label: t('overview'), key: 'overview', permission: 'dashboard.view' },
        { href: `/${locale}/usuarios`, icon: '👤', label: 'Usuarios', key: 'usuarios', permission: 'users.manage' },
        { href: `/${locale}/auditoria`, icon: '🕵️', label: 'Auditoría', key: 'auditoria', permission: 'users.manage' },
        { href: `/${locale}/ventas`, icon: '🛒', label: t('sales'), key: 'ventas', permissions: ['sales.view', 'sales.create', 'sales.edit', 'sales.delete'] },
        { href: `/${locale}/venta-rapida`, icon: '⚡', label: 'Venta Rápida', key: 'venta-rapida', permissions: ['sales.create'] },
        { href: `/${locale}/zonas`, icon: '🗺️', label: 'Zonas', key: 'zonas', permission: 'zones.manage' },
        { href: `/${locale}/settings`, icon: '⚙️', label: t('settings'), key: 'settings' }
    ];

    const reportItems = [
        { href: `/${locale}/reportes/charts`, icon: '📈', label: t('charts'), key: 'charts', permission: 'reports.view' },
        { href: `/${locale}/reportes/analytics`, icon: '📉', label: t('analytics'), key: 'analytics', permission: 'reports.view' },
        { href: `/${locale}/reportes/estado-resultados`, icon: '📋', label: t('incomeStatement'), key: 'estado-resultados', permission: 'reports.view' },
        { href: `/${locale}/reportes/estado-patrimonial`, icon: '🏛️', label: 'Sit. Patrimonial', key: 'estado-patrimonial', permission: 'reports.view' },
        { href: `/${locale}/reportes/download`, icon: '📥', label: t('downloadCenter'), key: 'download', permission: 'reports.view' }
    ];

    const fiscalItems = [
        { href: `/${locale}/fiscal`, icon: '🧾', label: 'Dashboard Fiscal', key: 'fiscal', permission: 'fiscal.view' },
        { href: `/${locale}/fiscal/libro-iva`, icon: '📚', label: 'Libro IVA', key: 'libro-iva', permission: 'fiscal.view' },
        { href: `/${locale}/fiscal/comprobantes`, icon: '🗃️', label: 'Comprobantes', key: 'comprobantes', permission: 'fiscal.view' },
        { href: `/${locale}/fiscal/configuracion`, icon: '⚙️', label: 'Config. Fiscal', key: 'config-fiscal', permission: 'fiscal.manage' }
    ];

    const systemItems = [
        { href: `/${locale}/backup`, icon: '💾', label: 'Backup', key: 'backup', permission: 'dashboard.view' },
        { href: `/${locale}/ayuda`, icon: '📖', label: 'Manual & Ayuda', key: 'ayuda' }
    ];

    const checkItemPermission = (item) => {
        if (!item.permission && !item.permissions) return true;
        if (item.permission) return hasPermission(item.permission);
        if (item.permissions) return item.permissions.some(p => hasPermission(p));
        return false;
    };

    const filteredMainMenuItems = mainMenuItems.filter(checkItemPermission);
    const filteredReportItems = reportItems.filter(checkItemPermission);
    const filteredFiscalItems = fiscalItems.filter(checkItemPermission);
    const filteredSystemItems = systemItems.filter(checkItemPermission);

    // Skeleton placeholder while profile/permissions are loading
    const renderSkeletonItems = (count = 8) => (
        Array.from({ length: count }).map((_, i) => (
            <div key={`skeleton-${i}`} className="nav-item" style={{ opacity: 0.4, pointerEvents: 'none' }}>
                <span className="nav-item-icon" style={{
                    width: '20px', height: '20px',
                    background: 'var(--bg-hover)', borderRadius: '4px',
                    animation: 'skeleton-pulse 1.5s infinite ease-in-out'
                }}></span>
                <span style={{
                    display: 'inline-block', height: '12px', borderRadius: '4px',
                    background: 'var(--bg-hover)',
                    width: `${60 + Math.random() * 40}%`,
                    animation: 'skeleton-pulse 1.5s infinite ease-in-out',
                    animationDelay: `${i * 0.1}s`
                }}></span>
            </div>
        ))
    );

    // Show skeleton if profile is still loading and no items are available
    const showSkeleton = profileLoading && filteredMainMenuItems.length === 0;

    // Fallback: if profile failed to load completely (profile=null), we might show all items or hide them.
    // However, if profile exists, we MUST only show filtered items, even if it's empty.
    const displayMainItems = showSkeleton ? [] :
        (profile ? filteredMainMenuItems : mainMenuItems);
    const displayReportItems = showSkeleton ? [] :
        (profile ? filteredReportItems : reportItems);
    const displayFiscalItems = showSkeleton ? [] :
        (profile ? filteredFiscalItems : fiscalItems);
    const displaySystemItems = showSkeleton ? [] :
        (profile ? filteredSystemItems : systemItems);

    return (
        <>
            {showSkeleton && (
                <style>{`
                    @keyframes skeleton-pulse {
                        0% { opacity: 0.4; }
                        50% { opacity: 0.8; }
                        100% { opacity: 0.4; }
                    }
                `}</style>
            )}
            {isOpen && (
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 998
                    }}
                    className="sidebar-overlay"
                />
            )}
            <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
                <div className="logo">
                    <div className="logo-icon" style={{ overflow: 'hidden', borderRadius: '8px' }}>
                        {companyLogoUrl ? (
                            <img
                                src={companyLogoUrl}
                                alt="Logo empresa"
                                style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '8px' }}
                            />
                        ) : (
                            '🥚'
                        )}
                    </div>
                    <span>{companyName}</span>
                </div>
                <nav className="nav-section">
                    <div className="nav-section-title">{t('mainMenu')}</div>
                    <div className="nav-items-grid">
                        {showSkeleton ? renderSkeletonItems(10) : (
                            displayMainItems.map((item) => (
                                <Link key={item.key} href={item.href}
                                    className={`nav-item ${isActive(item.key) ? 'active' : ''}`}
                                    onClick={onClose}>
                                    <span className="nav-item-icon">{item.icon}</span>
                                    <span>{item.label}</span>
                                </Link>
                            ))
                        )}
                    </div>
                </nav>
                {!showSkeleton && displayFiscalItems.length > 0 && (
                    <nav className="nav-section">
                        <div className="nav-section-title">Fiscal</div>
                        {displayFiscalItems.map((item) => (
                            <Link key={item.key} href={item.href}
                                className={`nav-item ${isActive(item.key) ? 'active' : ''}`}
                                onClick={onClose}>
                                <span className="nav-item-icon">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>
                )}
                {!showSkeleton && displayReportItems.length > 0 && (
                    <nav className="nav-section">
                        <div className="nav-section-title">{t('reports')}</div>
                        {displayReportItems.map((item) => (
                            <Link key={item.key} href={item.href}
                                className={`nav-item ${isActive(item.key) ? 'active' : ''}`}
                                onClick={onClose}>
                                <span className="nav-item-icon">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>
                )}
                {!showSkeleton && displaySystemItems.length > 0 && (
                    <nav className="nav-section">
                        <div className="nav-section-title">Sistema</div>
                        {displaySystemItems.map((item) => (
                            <Link key={item.key} href={item.href}
                                className={`nav-item ${isActive(item.key) ? 'active' : ''}`}
                                onClick={onClose}>
                                <span className="nav-item-icon">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>
                )}
                <div className="lang-switcher-mobile show-mobile" style={{padding: '0 16px 16px'}}>
                <div style={{fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px'}}>IDIOMA</div>
                <div style={{display: 'flex', gap: '8px'}}>
                    <a href={`/es${pathname.replace(/^\/(es|en)/, '')}`} style={{padding: '6px 16px', borderRadius: '6px', background: locale === 'es' ? 'var(--accent-primary)' : 'transparent', color: 'white', fontWeight: '600', fontSize: '13px', textDecoration: 'none'}}>ES</a>
                    <a href={`/en${pathname.replace(/^\/(es|en)/, '')}`} style={{padding: '6px 16px', borderRadius: '6px', background: locale === 'en' ? 'var(--accent-primary)' : 'transparent', color: 'white', fontWeight: '600', fontSize: '13px', textDecoration: 'none'}}>EN</a>
                </div>
            </div>
            <div className="upgrade-banner">
                    <div className="upgrade-banner-title"><span>⚡</span> Pro version available!</div>
                    <p className="upgrade-banner-text">Check out the new version now!<br />Operations now load faster.</p>
                    <a href="#">Not now &nbsp; Upgrade!</a>
                </div>
            </aside>
        </>
    );
}
