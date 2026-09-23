'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { getSales, getCollections, getClients } from '@/lib/api';

export default function ChartsPage() {
    const t = useTranslations('reports');
    
    const [sales, setSales] = useState([]);
    const [collections, setCollections] = useState([]);
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [s, c, cl] = await Promise.all([
                    getSales(),
                    getCollections(),
                    getClients()
                ]);
                setSales(s || []);
                setCollections(c || []);
                setClients(cl || []);
            } catch (err) {
                console.error("Error fetching reports data:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(value);
    };

    // Calculate mother accounts (no parent) and consolidate balances
    const motherClients = clients.filter(c => !c.parent_id);
    const consolidatedDebtors = motherClients.map(mother => {
        const children = clients.filter(c => Number(c.parent_id) === Number(mother.id));
        const childrenBalance = children.reduce((sum, child) => sum + parseFloat(child.balance || 0), 0);
        const totalBalance = parseFloat(mother.balance || 0) + childrenBalance;
        return {
            ...mother,
            displayBalance: totalBalance
        };
    }).filter(c => c.displayBalance > 0);

    // Calculate totals
    const totalSales = sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
    const totalCollections = collections.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
    const totalPending = consolidatedDebtors.reduce((sum, c) => sum + c.displayBalance, 0);

    const activeClientsCount = motherClients.length;

    // Cash Report by Payment Method
    const methodColors = {
        'efectivo': 'var(--accent-success)',
        'transferencia': 'var(--accent-info)',
        'mercado pago': 'var(--accent-warning)',
        'cheque': '#8b5cf6',
        'default': 'var(--text-muted)'
    };
    
    // Default empty state placeholders if no collections exist yet
    let collectionsByMethod = {};
    if (collections.length === 0) {
       collectionsByMethod = { 'Efectivo': 0, 'Transferencia': 0, 'Mercado Pago': 0 };
    } else {
        collectionsByMethod = collections.reduce((acc, c) => {
            const m = c.payment_method || 'Efectivo';
            acc[m] = (acc[m] || 0) + parseFloat(c.amount || 0);
            return acc;
        }, {});
    }

    const cashReportData = Object.entries(collectionsByMethod)
        .map(([method, amount]) => ({
            method,
            amount,
            color: methodColors[method.toLowerCase()] || methodColors['default']
        }))
        .sort((a, b) => b.amount - a.amount);
        
    const totalCash = cashReportData.reduce((sum, item) => sum + item.amount, 0);

    if (isLoading) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando reportes...</div>;
    }

    return (
        <div>
            <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: '600' }}>{t('title')}</h1>

            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon income">💰</div>
                        <span className="stat-label">{t('salesReport')}</span>
                    </div>
                    <div className="stat-value">{formatCurrency(totalSales)}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon orders">💳</div>
                        <span className="stat-label">{t('collectionsReport')}</span>
                    </div>
                    <div className="stat-value">{formatCurrency(totalCollections)}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon expenses">📊</div>
                        <span className="stat-label">{t('debtorsReport')}</span>
                    </div>
                    <div className="stat-value">{formatCurrency(totalPending)}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon views">👥</div>
                        <span className="stat-label">Clientes Activos</span>
                    </div>
                    <div className="stat-value">{activeClientsCount}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">{t('cashReport')}</h3>
                        <div className="tabs">
                            <button className="tab active">{t('daily')}</button>
                            <button className="tab">{t('weekly')}</button>
                            <button className="tab">{t('monthly')}</button>
                        </div>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {cashReportData.map((item, index) => (
                                <div key={index} className="progress-item">
                                    <div className="progress-info" style={{ flex: 1 }}>
                                        <div className="progress-info-header">
                                            <span className="progress-name">{item.method}</span>
                                            <span className="progress-value">{formatCurrency(item.amount)}</span>
                                        </div>
                                        <div className="progress-bar-container">
                                            <div
                                                className="progress-bar-fill"
                                                style={{ width: totalCash > 0 ? `${(item.amount / totalCash) * 100}%` : '0%', background: item.color }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">{t('debtorsReport')}</h3>
                        <button className="btn btn-secondary">{t('exportExcel')}</button>
                    </div>
                    <div className="card-body">
                        {consolidatedDebtors.length === 0 ? (
                             <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                                 No hay clientes deudores en este momento.
                             </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {consolidatedDebtors.sort((a, b) => b.displayBalance - a.displayBalance).map((client, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px 16px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '500' }}>{client.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{client.phone || client.email || 'Sin contacto'}</div>
                                        </div>
                                        <span style={{ fontWeight: '600', color: 'var(--accent-warning)' }}>
                                            {formatCurrency(client.displayBalance)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
