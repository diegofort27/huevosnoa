'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import StatCard from '@/components/ui/StatCard';
import DataTable from '@/components/ui/DataTable';
import { getDashboardStats } from '@/lib/api';
import { mockZoneData, mockDeviceData } from '@/lib/mockData';

export default function OverviewPage() {
    const t = useTranslations('dashboard');
    const tSales = useTranslations('sales');
    const tCommon = useTranslations('common');
    const locale = useLocale();
    const router = useRouter();
    const { hasPermission, profile, profileLoading } = useAuth();

    // State for real data
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [productPeriod, setProductPeriod] = useState('week'); // 'week' or 'month'

    // Redirect if no permission
    useEffect(() => {
        if (!profileLoading && profile) {
            if (profile.role !== 'admin' && !hasPermission('dashboard.view')) {
                router.replace(`/${locale}/reparto`);
            }
        }
    }, [profile, profileLoading, hasPermission, router, locale]);

    useEffect(() => {
        // Stop loading stats if they will be redirected anyway
        if (!profileLoading && profile && profile.role !== 'admin' && !hasPermission('dashboard.view')) return;
        loadStats();
    }, [profileLoading, profile, hasPermission]);

    const loadStats = async () => {
        setIsLoading(true);
        setError(null);

        // Failsafe: if loading takes more than 15s, show error
        const timeout = setTimeout(() => {
            if (isLoading && !stats) {
                console.warn('Overview: Timeout de 15s alcanzado. Mostrando error de conexión.');
                setError('La carga de datos está tomando demasiado tiempo. Es posible que haya un problema de conexión con Supabase o tu internet.');
                setIsLoading(false);
            }
        }, 15000);

        try {
            console.log('Overview: Iniciando carga de datos...');
            const data = await getDashboardStats();
            console.log('Overview: Datos cargados:', data);
            setStats(data);
            setError(null); // Clear any timeout error if it succeeded late
        } catch (err) {
            console.error('Overview: Error cargando dashboard:', err);
            setError(err.message || 'Error de conexión con el servidor');
        } finally {
            clearTimeout(timeout);
            setIsLoading(false);
        }
    };

    const handleFullReload = () => {
        window.location.reload();
    };

    const handleForceExit = () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = `/${locale}/login`;
    };

    const formatCurrency = (value, currency = 'ARS') => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(value);
    };

    const formatQuantity = (value) => {
        return Number(value).toLocaleString('es-AR', {
            maximumFractionDigits: 4,
            minimumFractionDigits: 0
        });
    };

    const columns = [
        {
            key: 'name',
            label: 'Producto',
            render: (value, row) => (
                <div className="product-row">
                    <div className="product-image">🥚</div>
                    <span className="product-name">{value}</span>
                </div>
            )
        },
        { key: 'quantity', label: tSales('quantity') },
        {
            key: 'total',
            label: tSales('total'),
            render: (value) => formatCurrency(value)
        }
    ];

    if (isLoading) {
        return (
            <div style={{ padding: '80px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div className="spinner" style={{ margin: '0 auto 24px' }}></div>
                <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Cargando Resumen...</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Sincronizando con la base de datos de Supabase</p>
                <button
                    onClick={handleForceExit}
                    style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Si tarda demasiado, haz clic aquí para volver al inicio
                </button>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
                <h3 style={{ color: 'var(--accent-danger)', marginBottom: '10px', fontSize: '24px' }}>Error de Conexión</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 32px', fontSize: '16px', lineHeight: '1.5' }}>
                    {error}
                    <br /><br />
                    <small>Verifica tu conexión a internet o el estado de Supabase.</small>
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={loadStats} className="btn btn-primary" style={{ padding: '12px 24px' }}>
                        REINTENTAR 🔄
                    </button>
                    <button onClick={handleFullReload} className="btn btn-secondary" style={{ padding: '12px 24px', background: 'var(--bg-card)' }}>
                        RECARGA COMPLETA 🌐
                    </button>
                    <button onClick={handleForceExit} className="btn btn-secondary" style={{ padding: '12px 24px' }}>
                        FORZAR SALIDA 🚪
                    </button>
                </div>
            </div>
        );
    }

    // Fallback if stats fail
    const displayStats = stats || {
        today: { amount: 0, quantity: 0 },
        yesterday: { amount: 0, quantity: 0 },
        week: { amount: 0, quantity: 0 },
        month: { amount: 0, quantity: 0 },
        topProductsWeek: [],
        topProductsMonth: [],
        zoneStats: [],
        totalExpenses: 0,
        monthArs: { amount: 0, quantity: 0 },
        monthUsd: { amount: 0, quantity: 0 },
        expensesArs: 0,
        expensesUsd: 0
    };

    const renderBreakdown = (breakdown) => {
        if (!breakdown || breakdown.length === 0) return null;
        return (
            <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                {breakdown.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                        <span>{item.name}</span>
                        <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{formatQuantity(item.quantity)}</span>
                    </div>
                ))}
            </div>
        );
    };



    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '600' }}>
                    {t('title')}
                </h1>
                <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Actualizado: {new Date().toLocaleTimeString()}
                </div>
            </div>

            <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-secondary)' }}>{t('salesByAmount')}</h3>
            <div className="stats-grid" style={{ marginBottom: '32px' }}>
                <StatCard
                    icon="💰"
                    label={t('today')}
                    value={formatCurrency(displayStats.today.amount)}
                    type="income"
                />
                <StatCard
                    icon="🕒"
                    label={t('yesterday')}
                    value={formatCurrency(displayStats.yesterday.amount)}
                    type="views"
                />
                <StatCard
                    icon="📅"
                    label={t('thisWeek')}
                    value={formatCurrency(displayStats.week.amount)}
                    type="orders"
                />
                <StatCard
                    icon="📊"
                    label={t('thisMonth')}
                    value={formatCurrency(displayStats.monthArs.amount, 'ARS')}
                    subValue={displayStats.monthUsd.amount > 0 ? formatCurrency(displayStats.monthUsd.amount, 'USD') : null}
                    type="income"
                />
            </div>

            <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-secondary)' }}>Ganancias y Rentabilidad (ARS)</h3>
            <div className="stats-grid" style={{ marginBottom: '32px' }}>
                <StatCard
                    icon="💲"
                    label="Ganancia Bruta (Mes)"
                    value={formatCurrency(displayStats.monthArs?.profit || 0)}
                    subValue={`Margen: ${displayStats.monthArs?.amount > 0 ? ((displayStats.monthArs.profit / displayStats.monthArs.amount) * 100).toFixed(1) : 0}%`}
                    type="income"
                />
                <StatCard
                    icon="🏦"
                    label="Ganancia Neta (Mes)"
                    value={formatCurrency((displayStats.monthArs?.profit || 0) - (displayStats.expensesArs || 0))}
                    subValue={`Gastos: ${formatCurrency(displayStats.expensesArs || 0)}`}
                    type="orders"
                />
                <StatCard
                    icon="📈"
                    label="Ganancia Bruta (Hoy)"
                    value={formatCurrency(displayStats.today?.profit || 0)}
                    type="views"
                />
                <StatCard
                    icon="📅"
                    label="Ganancia Bruta (Semana)"
                    value={formatCurrency(displayStats.week?.profit || 0)}
                    type="orders"
                />
            </div>

            <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-secondary)' }}>{t('salesByQuantity')}</h3>
            <div className="stats-grid" style={{ marginBottom: '32px' }}>
                <StatCard
                    icon="📦"
                    label={t('today')}
                    value={formatQuantity(displayStats.today.quantity)}
                    type="views"
                >
                    {renderBreakdown(displayStats.today.breakdown)}
                </StatCard>
                <StatCard
                    icon="🕒"
                    label={t('yesterday')}
                    value={formatQuantity(displayStats.yesterday.quantity)}
                    type="orders"
                >
                    {renderBreakdown(displayStats.yesterday.breakdown)}
                </StatCard>
                <StatCard
                    icon="📅"
                    label={t('thisWeek')}
                    value={formatQuantity(displayStats.week.quantity)}
                    type="income"
                >
                    {renderBreakdown(displayStats.week.breakdown)}
                </StatCard>
                <StatCard
                    icon="📊"
                    label={t('thisMonth')}
                    value={formatQuantity(displayStats.month.quantity)}
                    type="views"
                >
                    {renderBreakdown(displayStats.month.breakdown)}
                </StatCard>
            </div>

            <div className="stats-grid" style={{ marginBottom: '32px' }}>
                <StatCard
                    icon="💸"
                    label="Gastos Operativos (Mes)"
                    value={formatCurrency(displayStats.expensesArs, 'ARS')}
                    subValue={`Total Erogaciones: ${formatCurrency(displayStats.outflowsArs, 'ARS')}`}
                    type="expenses"
                />
            </div>

            <div className="charts-row">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">{t('topProductsSales')}</h3>
                        <div className="tabs">
                            <button
                                className={`tab ${productPeriod === 'week' ? 'active' : ''}`}
                                onClick={() => setProductPeriod('week')}
                            >
                                {t('thisWeek')}
                            </button>
                            <button
                                className={`tab ${productPeriod === 'month' ? 'active' : ''}`}
                                onClick={() => setProductPeriod('month')}
                            >
                                {t('thisMonth')}
                            </button>
                        </div>
                    </div>
                    <div className="card-body">
                        {(productPeriod === 'week' ? displayStats.topProductsWeek : displayStats.topProductsMonth).length > 0 ? (
                            <DataTable
                                columns={[
                                    { key: 'name', label: 'Producto' },
                                    { key: 'quantity', label: 'CANT', render: (v) => formatQuantity(v) },
                                    { key: 'total', label: 'TOTAL', render: (v) => formatCurrency(v) }
                                ]}
                                data={productPeriod === 'week' ? displayStats.topProductsWeek : displayStats.topProductsMonth}
                            />
                        ) : (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Sin ventas en este periodo
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Ventas por Zona (Mes)</h3>
                    </div>
                    <div className="card-body">
                        {displayStats.zoneStats.length > 0 ? (
                            <div className="progress-list">
                                {displayStats.zoneStats.map((zone, index) => (
                                    <div key={index} className="progress-item">
                                        <div className="progress-info">
                                            <div className="progress-info-header">
                                                <span className="progress-name" style={{ fontWeight: '600' }}>{zone.name}</span>
                                                <span className="progress-value">{formatCurrency(zone.amount)}</span>
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                {formatQuantity(zone.quantity)} unidades
                                            </div>
                                            <div className="progress-bar-container">
                                                <div
                                                    className="progress-bar-fill"
                                                    style={{
                                                        width: `${Math.min(100, (zone.amount / (displayStats.monthArs.amount + (displayStats.monthUsd.amount * 1000) || 1)) * 100)}%`,
                                                        background: 'var(--accent-primary)'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Sin datos de zona
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
