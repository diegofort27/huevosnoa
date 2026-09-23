'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Lazy load para reducir bundle inicial
const SalesEvolutionChart = dynamic(() => import('@/components/analytics/SalesEvolutionChart'), { ssr: false, loading: () => <TabLoader /> });
const SalesByCategoryTable = dynamic(() => import('@/components/analytics/SalesByCategoryTable'), { ssr: false, loading: () => <TabLoader /> });
const ClientsStatus = dynamic(() => import('@/components/analytics/ClientsStatus'), { ssr: false, loading: () => <TabLoader /> });
const ClientsRetention = dynamic(() => import('@/components/analytics/ClientsRetention'), { ssr: false, loading: () => <TabLoader /> });

function TabLoader() {
    return (
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p>Cargando reporte...</p>
        </div>
    );
}

const TABS = [
    {
        id: 'evolucion',
        label: 'Evolución de Ventas',
        icon: '📈',
        subtitle: 'Tendencia mensual por período, categoría y unidad',
        component: SalesEvolutionChart,
    },
    {
        id: 'categorias',
        label: 'Ventas por Categoría',
        icon: '📦',
        subtitle: 'Detalle de volumen y $ por categoría y unidad de venta',
        component: SalesByCategoryTable,
    },
    {
        id: 'clientes',
        label: 'Clientes Activos / Inactivos',
        icon: '👥',
        subtitle: 'Filtro dinámico por días de inactividad',
        component: ClientsStatus,
    },
    {
        id: 'retencion',
        label: 'Retención y Nuevos',
        icon: '🎯',
        subtitle: 'Clientes nuevos, % retención y mayores caídas',
        component: ClientsRetention,
    },
];

export default function AnalyticsPage() {
    const [activeTab, setActiveTab] = useState('evolucion');

    const current = TABS.find(t => t.id === activeTab);
    const ActiveComponent = current?.component;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    📊 Reportes y Analytics
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Análisis de ventas, clientes y tendencias del negocio
                </p>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '2px solid var(--border-color)', paddingBottom: '0' }}>
                {TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            id={`tab-${tab.id}`}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '10px 18px',
                                border: 'none',
                                borderBottom: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                                background: 'transparent',
                                color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                                fontWeight: isActive ? '700' : '500',
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginBottom: '-2px',
                                borderRadius: '8px 8px 0 0',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Content Header */}
            {current && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                        {current.icon} {current.label}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                        {current.subtitle}
                    </p>
                </div>
            )}

            {/* Active Tab Component */}
            <div key={activeTab}>
                {ActiveComponent && <ActiveComponent />}
            </div>
        </div>
    );
}
