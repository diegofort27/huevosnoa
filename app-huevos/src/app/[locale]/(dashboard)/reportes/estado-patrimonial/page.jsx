'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { getArqueoStats } from '@/lib/api';
import { PageGuard } from '@/components/auth/RoleGuard';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function EstadoPatrimonialPage() {
    const locale = useLocale();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [data, setData] = useState({
        activos: {
            cajaBancos: 0,
            cuentasPorCobrar: 0,
            inventario: 0,
            total: 0
        },
        pasivos: {
            cuentasPorPagar: 0,
            total: 0
        },
        patrimonioNeto: 0,
        disponibilidadesBreakdown: {
            efectivo: 0,
            inversiones: 0,
            bancos: 0,
            dolares: 0
        },
        details: {
            cajaBancos: [],
            cuentasPorCobrar: [],
            inventario: [],
            cuentasPorPagar: []
        }
    });

    useEffect(() => {
        fetchPatrimonialData();
    }, []);

    const fetchPatrimonialData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch USD exchange rate (dolar blue)
            let dolarRate = 1405;
            try {
                const res = await fetch('https://dolarapi.com/v1/dolares/blue');
                if (res.ok) {
                    const dData = await res.json();
                    if (dData.venta) dolarRate = parseFloat(dData.venta);
                }
            } catch (e) {
                console.error('Error fetching dolar rate:', e);
            }

            // 1. Caja y Bancos (Disponibilidades)
            const arqueoStats = await getArqueoStats();
            let totalCajaBancos = 0;
            const cajaBancosList = [];
            const breakdown = {
                efectivo: 0,
                inversiones: 0,
                bancos: 0,
                dolares: 0,
                dolaresUsd: 0,
                dolarRate: dolarRate
            };

            if (arqueoStats && arqueoStats.userStats) {
                arqueoStats.userStats.forEach(user => {
                    user.categoryBalances.forEach(cat => {
                        if (cat.balance !== 0) {
                            const catName = cat.categoryName.toLowerCase();
                            const isDolar = catName.includes('dólar') || catName.includes('dolar');
                            
                            const amountInArs = isDolar ? cat.balance * dolarRate : cat.balance;
                            totalCajaBancos += amountInArs;

                            if (isDolar) {
                                breakdown.dolares += amountInArs;
                                breakdown.dolaresUsd += cat.balance;
                                cajaBancosList.push({
                                    description: `${cat.categoryName} (${user.name}) - USD ${cat.balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })} @ $${dolarRate}`,
                                    amount: amountInArs
                                });
                            } else {
                                cajaBancosList.push({
                                    description: `${cat.categoryName} (${user.name})`,
                                    amount: cat.balance
                                });

                                if (catName.includes('inversión') || catName.includes('inversion')) {
                                    breakdown.inversiones += cat.balance;
                                } else if (catName.includes('banco') || catName.includes('transferencia')) {
                                    breakdown.bancos += cat.balance;
                                } else {
                                    breakdown.efectivo += cat.balance;
                                }
                            }
                        }
                    });
                });
            }

            // 2. Inventario (Bienes de Cambio)
            const { data: productsData, error: productsError } = await supabase
                .from('products')
                .select('code, description, current_stock, cost')
                .gt('current_stock', 0);
            
            if (productsError) throw productsError;
            
            let totalInventario = 0;
            const inventarioList = (productsData || []).map(p => {
                const value = (parseFloat(p.current_stock) || 0) * (parseFloat(p.cost) || 0);
                totalInventario += value;
                return {
                    description: `${p.description} (Stock: ${p.current_stock})`,
                    amount: value
                };
            }).filter(item => item.amount > 0).sort((a, b) => b.amount - a.amount);

            // 3. Cuentas por Cobrar (Clientes)
            const { data: clientsData, error: clientsError } = await supabase
                .from('clients')
                .select('name, balance')
                .gt('balance', 0);
                
            if (clientsError) throw clientsError;

            let totalCuentasPorCobrar = 0;
            const cuentasPorCobrarList = (clientsData || []).map(c => {
                const bal = parseFloat(c.balance) || 0;
                totalCuentasPorCobrar += bal;
                return {
                    description: c.name,
                    amount: bal
                };
            }).sort((a, b) => b.amount - a.amount);

            // 4. Cuentas por Pagar (Proveedores)
            const { data: providersData, error: providersError } = await supabase
                .from('providers')
                .select('name, balance');
            
            let totalCuentasPorPagar = 0;
            let cuentasPorPagarList = [];

            if (!providersError && providersData) {
                cuentasPorPagarList = providersData.filter(p => p.balance > 0).map(p => {
                    const bal = parseFloat(p.balance) || 0;
                    totalCuentasPorPagar += bal;
                    return {
                        description: p.name,
                        amount: bal
                    };
                }).sort((a, b) => b.amount - a.amount);
            }

            // Consolidate totals
            const totalActivos = totalCajaBancos + totalCuentasPorCobrar + totalInventario;
            const totalPasivos = totalCuentasPorPagar;
            const patrimonioNeto = totalActivos - totalPasivos;

            setData({
                activos: {
                    cajaBancos: totalCajaBancos,
                    cuentasPorCobrar: totalCuentasPorCobrar,
                    inventario: totalInventario,
                    total: totalActivos
                },
                pasivos: {
                    cuentasPorPagar: totalCuentasPorPagar,
                    total: totalPasivos
                },
                patrimonioNeto,
                disponibilidadesBreakdown: breakdown,
                details: {
                    cajaBancos: cajaBancosList,
                    cuentasPorCobrar: cuentasPorCobrarList,
                    inventario: inventarioList,
                    cuentasPorPagar: cuentasPorPagarList
                }
            });

        } catch (err) {
            console.error('Error fetching patrimonial data:', err);
            setError(locale === 'es' ? 'Error al cargar los datos patrimoniales.' : 'Error loading patrimonial data.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2
        }).format(value || 0);
    };

    const handleExportPDF = () => {
        const rows = [
            ...data.details.cajaBancos.map(item => ({ category: 'Activo - Caja y Bancos', item: item.description, amount: formatCurrency(item.amount) })),
            ...data.details.cuentasPorCobrar.map(item => ({ category: 'Activo - Cuentas por Cobrar', item: item.description, amount: formatCurrency(item.amount) })),
            ...data.details.inventario.map(item => ({ category: 'Activo - Inventario', item: item.description, amount: formatCurrency(item.amount) })),
            ...data.details.cuentasPorPagar.map(item => ({ category: 'Pasivo - Cuentas por Pagar', item: item.description, amount: formatCurrency(item.amount) }))
        ];

        exportToPDF({
            title: 'Estado de Situación Patrimonial',
            subtitle: `Patrimonio Neto Total: ${formatCurrency(data.patrimonioNeto)}`,
            columns: [
                { header: 'Rubro / Categoría', dataKey: 'category' },
                { header: 'Detalle / Descripción', dataKey: 'item' },
                { header: 'Monto ($)', dataKey: 'amount', align: 'right' }
            ],
            data: rows,
            filename: `estado_patrimonial_${new Date().toISOString().split('T')[0]}.pdf`,
            totals: {
                category: 'PATRIMONIO NETO',
                item: 'TOTAL NETO',
                amount: formatCurrency(data.patrimonioNeto)
            }
        });
    };

    const handleExportExcel = () => {
        const rows = [
            ...data.details.cajaBancos.map(item => ({ category: 'Activo - Caja y Bancos', item: item.description, amount: item.amount })),
            ...data.details.cuentasPorCobrar.map(item => ({ category: 'Activo - Cuentas por Cobrar', item: item.description, amount: item.amount })),
            ...data.details.inventario.map(item => ({ category: 'Activo - Inventario', item: item.description, amount: item.amount })),
            ...data.details.cuentasPorPagar.map(item => ({ category: 'Pasivo - Cuentas por Pagar', item: item.description, amount: item.amount }))
        ];

        exportToExcel({
            title: 'Estado de Situación Patrimonial',
            columns: [
                { header: 'Categoría', dataKey: 'category', width: 25 },
                { header: 'Descripción', dataKey: 'item', width: 40 },
                { header: 'Monto ($)', dataKey: 'amount', width: 18 }
            ],
            data: rows,
            filename: `estado_patrimonial_${new Date().toISOString().split('T')[0]}.xlsx`,
            totals: {
                category: 'PATRIMONIO NETO',
                item: 'TOTAL NETO',
                amount: data.patrimonioNeto
            }
        });
    };

    // Collapsible Section Component
    const CollapsibleSection = ({ title, totalAmount, summaryPills = [], items = [], defaultExpanded = false }) => {
        const [isExpanded, setIsExpanded] = useState(defaultExpanded);

        return (
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                padding: '20px',
                marginBottom: '20px'
            }}>
                {/* Header Row */}
                <div 
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        userSelect: 'none'
                    }}
                >
                    <div>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                            {title}
                        </h3>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-primary)', marginTop: '4px' }}>
                            {formatCurrency(totalAmount)}
                        </div>
                    </div>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                        {isExpanded ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Ocultar <ChevronUp size={16} />
                            </span>
                        ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Ver Detalle <ChevronDown size={16} />
                            </span>
                        )}
                    </button>
                </div>

                {/* Sub-Category Summary Pills */}
                {summaryPills.length > 0 && (
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        marginTop: '14px',
                        paddingTop: '12px',
                        borderTop: '1px dashed var(--border-color)'
                    }}>
                        {summaryPills.map((pill, idx) => (
                            <div key={idx} style={{
                                background: 'var(--bg-tertiary)',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span style={{ color: 'var(--text-muted)' }}>{pill.label}:</span>
                                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(pill.amount)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Expanded Detailed Table */}
                {isExpanded && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                        {items.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '14px', margin: 0 }}>No hay registros.</p>
                        ) : (
                            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '10px 14px', fontWeight: '600' }}>Concepto</th>
                                            <th style={{ padding: '10px 14px', fontWeight: '600', textAlign: 'right' }}>Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={idx} style={{ 
                                                borderBottom: idx === items.length - 1 ? 'none' : '1px solid var(--border-color)',
                                                backgroundColor: idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-card)'
                                            }}>
                                                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                                                    {item.description}
                                                </td>
                                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>
                                                    {formatCurrency(item.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <PageGuard permission="reports.view">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {locale === 'es' ? 'Estado de Situación Patrimonial' : 'Balance Sheet'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        {locale === 'es' ? 'Resumen simplificado de Activos, Pasivos y Patrimonio Neto' : 'Simplified summary of Assets, Liabilities and Equity'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={handleExportPDF} 
                        className="btn btn-secondary"
                        disabled={isLoading}
                    >
                        📄 Exportar PDF
                    </button>
                    <button 
                        onClick={handleExportExcel} 
                        className="btn btn-secondary"
                        disabled={isLoading}
                    >
                        📊 Exportar Excel
                    </button>
                    <button 
                        onClick={fetchPatrimonialData} 
                        className="btn btn-primary"
                        disabled={isLoading}
                    >
                        🔄 {locale === 'es' ? 'Actualizar' : 'Refresh'}
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <h3>{locale === 'es' ? 'Calculando Patrimonio...' : 'Calculating Equity...'}</h3>
                </div>
            ) : error ? (
                <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--accent-danger)' }}>
                    <h3>⚠️ Error</h3>
                    <p style={{ margin: '8px 0 16px' }}>{error}</p>
                    <button className="btn btn-primary" onClick={fetchPatrimonialData}>Reintentar</button>
                </div>
            ) : (
                <>
                    {/* Big KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                        {/* Activos */}
                        <div className="card" style={{ padding: '24px', borderLeft: '4px solid var(--accent-info)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>
                                Total Activos
                            </div>
                            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {formatCurrency(data.activos.total)}
                            </div>
                        </div>

                        {/* Pasivos */}
                        <div className="card" style={{ padding: '24px', borderLeft: '4px solid var(--accent-danger)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>
                                Total Pasivos
                            </div>
                            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {formatCurrency(data.pasivos.total)}
                            </div>
                        </div>

                        {/* Patrimonio Neto */}
                        <div className="card" style={{ 
                            padding: '24px', 
                            borderLeft: `4px solid ${data.patrimonioNeto >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}`,
                            backgroundColor: 'var(--bg-secondary)'
                        }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>
                                Patrimonio Neto
                            </div>
                            <div style={{ 
                                fontSize: '28px', 
                                fontWeight: '700', 
                                color: data.patrimonioNeto >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' 
                            }}>
                                {formatCurrency(data.patrimonioNeto)}
                            </div>
                        </div>
                    </div>

                    {/* Detailed Collapsible Layout */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                        
                        {/* Activos Column */}
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-info)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>1. ACTIVOS</span>
                                <span>{formatCurrency(data.activos.total)}</span>
                            </h2>
                            
                            <CollapsibleSection 
                                title="Disponibilidades (Caja y Bancos)" 
                                totalAmount={data.activos.cajaBancos}
                                summaryPills={[
                                    { label: 'Efectivo', amount: data.disponibilidadesBreakdown.efectivo },
                                    { label: 'Inversiones', amount: data.disponibilidadesBreakdown.inversiones },
                                    { label: 'Bancos', amount: data.disponibilidadesBreakdown.bancos },
                                    { 
                                        label: data.disponibilidadesBreakdown.dolaresUsd > 0 
                                            ? `Dólares (USD ${data.disponibilidadesBreakdown.dolaresUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })} @ $${data.disponibilidadesBreakdown.dolarRate})` 
                                            : 'Dólares', 
                                        amount: data.disponibilidadesBreakdown.dolares 
                                    }
                                ].filter(p => p.amount !== 0)}
                                items={data.details.cajaBancos}
                            />
                            
                            <CollapsibleSection 
                                title="Créditos por Ventas" 
                                totalAmount={data.activos.cuentasPorCobrar}
                                summaryPills={[
                                    { label: 'Total Clientes Deudores', amount: data.details.cuentasPorCobrar.length ? data.activos.cuentasPorCobrar : 0 }
                                ]}
                                items={data.details.cuentasPorCobrar}
                            />
                            
                            <CollapsibleSection 
                                title="Bienes de Cambio (Inventario)" 
                                totalAmount={data.activos.inventario}
                                summaryPills={[
                                    { label: 'Valor Total Stock', amount: data.activos.inventario }
                                ]}
                                items={data.details.inventario}
                            />
                        </div>

                        {/* Pasivos & PN Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Pasivos */}
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-danger)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>2. PASIVOS</span>
                                    <span>{formatCurrency(data.pasivos.total)}</span>
                                </h2>
                                
                                <CollapsibleSection 
                                    title="Deudas Comerciales (Proveedores)" 
                                    totalAmount={data.pasivos.cuentasPorPagar}
                                    summaryPills={[
                                        { label: 'Total Proveedores a Pagar', amount: data.pasivos.cuentasPorPagar }
                                    ]}
                                    items={data.details.cuentasPorPagar}
                                />
                            </div>

                            {/* Patrimonio Neto Summary */}
                            <div className="card" style={{ padding: '24px', background: 'var(--bg-tertiary)' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>
                                    3. PATRIMONIO NETO
                                </h2>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '15px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Total Activos</span>
                                    <span style={{ fontWeight: '600' }}>{formatCurrency(data.activos.total)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '15px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Total Pasivos</span>
                                    <span style={{ fontWeight: '600', color: 'var(--accent-danger)' }}>- {formatCurrency(data.pasivos.total)}</span>
                                </div>
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    paddingTop: '16px', 
                                    borderTop: '2px dashed var(--border-color)',
                                    fontSize: '18px',
                                    fontWeight: '700',
                                    color: data.patrimonioNeto >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'
                                }}>
                                    <span>Total Patrimonio Neto</span>
                                    <span>{formatCurrency(data.patrimonioNeto)}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </>
            )}
        </div>
        </PageGuard>
    );
}
