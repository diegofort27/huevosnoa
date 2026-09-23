'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { formatDateLocal } from '@/lib/utils';
import StatCard from '@/components/ui/StatCard';
import DataTable from '@/components/ui/DataTable';
import { PageGuard } from '@/components/auth/RoleGuard';

export default function EstadoResultadosPage() {
    const t = useTranslations('nav');
    const tCommon = useTranslations('common');
    const locale = useLocale();

    // Date filter state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [quickFilter, setQuickFilter] = useState('thisMonth');

    // Data state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState({
        sales: { amountArs: 0, amountUsd: 0, cogsArs: 0, quantity: 0, list: [] },
        expenses: { totalArs: 0, totalUsd: 0, list: [], byCategory: [] },
        purchases: { totalArs: 0, list: [] },
        productsBreakdown: [],
        profitArs: 0,
        netProfitArs: 0
    });

    const [activeTab, setActiveTab] = useState('products'); // 'products', 'expenses', 'purchases'

    // Drilling states
    const [selectedCategoryDetails, setSelectedCategoryDetails] = useState(null);
    const [modalSearchTerm, setModalSearchTerm] = useState('');

    // Handle Escape key to close details modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setSelectedCategoryDetails(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Clear search term when modal closes
    useEffect(() => {
        if (!selectedCategoryDetails) {
            setModalSearchTerm('');
        }
    }, [selectedCategoryDetails]);

    // Formatter helpers
    const formatCurrency = (value, currency = 'ARS') => {
        return new Intl.NumberFormat(locale === 'es' ? 'es-AR' : 'en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(value);
    };

    const formatQuantity = (value) => {
        return Number(value).toLocaleString(locale === 'es' ? 'es-AR' : 'en-US', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 0
        });
    };

    // Calculate start/end dates based on quick filter selection
    const applyQuickFilter = (filterType) => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (filterType) {
            case 'today':
                start = new Date();
                end = new Date();
                break;
            case 'yesterday':
                start.setDate(today.getDate() - 1);
                end.setDate(today.getDate() - 1);
                break;
            case 'thisWeek': {
                const day = today.getDay();
                const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
                start = new Date(today.setDate(diff));
                end = new Date();
                break;
            }
            case 'thisMonth':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date();
                break;
            case 'lastMonth':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'thisYear':
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date();
                break;
            case 'lastYear':
                start = new Date(today.getFullYear() - 1, 0, 1);
                end = new Date(today.getFullYear() - 1, 11, 31);
                break;
            default:
                return;
        }

        setStartDate(formatDateLocal(start));
        setEndDate(formatDateLocal(end));
    };

    // Initialize with "thisMonth" quick filter
    useEffect(() => {
        applyQuickFilter(quickFilter);
    }, [quickFilter]);

    // Fetch data whenever date range changes
    useEffect(() => {
        if (startDate && endDate) {
            fetchFinancialData();
        }
    }, [startDate, endDate]);

    const fetchFinancialData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Fetch Sales in date range
            const { data: salesData, error: salesError } = await supabase
                .from('sales')
                .select(`
                    id, date, total, status,
                    sale_items (
                        product_id, quantity, unit_price, unit_cost, total,
                        products:product_id (description)
                    )
                `)
                .gte('date', startDate)
                .lte('date', endDate);

            if (salesError) throw salesError;

            // 2. Fetch Expenses in date range
            const { data: expensesData, error: expensesError } = await supabase
                .from('expenses')
                .select(`
                    id, description, category, amount, date, currency, provider_id,
                    profiles:user_id (email, full_name),
                    arqueo_categories (id, name)
                `)
                .gte('date', startDate)
                .lte('date', endDate);

            if (expensesError) throw expensesError;

            // 3. Fetch Purchases in date range
            const { data: purchasesData, error: purchasesError } = await supabase
                .from('purchases')
                .select(`
                    id, date, total, status,
                    purchase_items (
                        product_id, quantity, unit_price, total
                    )
                `)
                .gte('date', startDate)
                .lte('date', endDate);

            if (purchasesError) throw purchasesError;

            // --- FETCH HISTORICAL RATES ---
            let historicalRates = [];
            const hasUsdExpenses = (expensesData || []).some(exp => exp.currency === 'USD');
            if (hasUsdExpenses) {
                try {
                    const response = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/blue');
                    if (response.ok) {
                        historicalRates = await response.json();
                    }
                } catch (e) {
                    console.error("Error fetching historical rates:", e);
                }
            }

            const getRateForDate = (dateStr) => {
                if (!historicalRates || historicalRates.length === 0) return 1405; // Fallback
                const exact = historicalRates.find(r => r.fecha === dateStr);
                if (exact) return exact.venta;
                const pastRates = historicalRates.filter(r => r.fecha < dateStr).sort((a,b) => b.fecha.localeCompare(a.fecha));
                if (pastRates.length > 0) return pastRates[0].venta;
                return historicalRates[0].venta;
            };

            // --- PROCESS SALES ---
            let salesAmountArs = 0;
            let salesAmountUsd = 0;
            let salesCogsArs = 0;
            let salesQuantity = 0;
            const productSalesMap = {};

            (salesData || []).forEach(sale => {
                const total = parseFloat(sale.total || 0);
                
                // Sales in DB are ARS
                salesAmountArs += total;

                (sale.sale_items || []).forEach(item => {
                    const qty = parseFloat(item.quantity || 0);
                    const cost = parseFloat(item.unit_cost || 0);
                    const itemTotal = parseFloat(item.total || 0);
                    
                    salesQuantity += qty;
                    // COGS is calculated in ARS
                    salesCogsArs += qty * cost;

                    const pid = item.product_id;
                    const pName = item.products?.description || `Producto #${pid}`;

                    if (!productSalesMap[pid]) {
                        productSalesMap[pid] = {
                            id: pid,
                            name: pName,
                            quantity: 0,
                            revenue: 0,
                            cost: 0,
                            profit: 0
                        };
                    }

                    productSalesMap[pid].quantity += qty;
                    productSalesMap[pid].revenue += itemTotal;
                    productSalesMap[pid].cost += qty * cost;
                    productSalesMap[pid].profit = productSalesMap[pid].revenue - productSalesMap[pid].cost;
                });
            });

            const productsBreakdown = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue);

            // --- PROCESS EXPENSES ---
            let expensesTotalArs = 0;
            let expensesTotalUsd = 0;
            const expensesByCategory = {};

            (expensesData || []).forEach(exp => {
                // Filter out provider payments for operational expenses
                if (exp.provider_id) return;

                const amount = parseFloat(exp.amount || 0);
                const isUsd = exp.currency === 'USD';
                let amountInArs = amount;

                if (isUsd) {
                    expensesTotalUsd += amount;
                    const rate = getRateForDate(exp.date);
                    amountInArs = amount * rate;
                    expensesTotalArs += amountInArs;
                } else {
                    expensesTotalArs += amount;
                }

                const catName = exp.category || 'General';
                const catId = exp.category || 'General';

                const userObj = exp.profiles || {};
                const userName = userObj.full_name || userObj.email || 'N/A';

                if (!expensesByCategory[catId]) {
                    expensesByCategory[catId] = {
                        id: catId,
                        name: catName,
                        amount: 0,
                        count: 0,
                        expensesList: []
                    };
                }
                expensesByCategory[catId].amount += amountInArs;
                expensesByCategory[catId].count += 1;
                expensesByCategory[catId].expensesList.push({
                    id: exp.id,
                    date: exp.date,
                    description: exp.description || 'Gasto General',
                    amount: amountInArs,
                    originalAmount: amount,
                    originalCurrency: exp.currency,
                    currency: 'ARS',
                    userName: userName,
                    rate: isUsd ? getRateForDate(exp.date) : null
                });
            });

            const processedExpensesByCategory = Object.values(expensesByCategory)
                .sort((a, b) => b.amount - a.amount);

            // --- PROCESS PURCHASES ---
            let purchasesTotalArs = 0;
            (purchasesData || []).forEach(p => {
                purchasesTotalArs += parseFloat(p.total || 0);
            });

            // --- SUMMARY CALCULATIONS (ARS focus) ---
            const profitArs = salesAmountArs - salesCogsArs;
            const netProfitArs = profitArs - expensesTotalArs;

            setData({
                sales: {
                    amountArs: salesAmountArs,
                    amountUsd: salesAmountUsd,
                    cogsArs: salesCogsArs,
                    quantity: salesQuantity,
                    list: salesData || []
                },
                expenses: {
                    totalArs: expensesTotalArs,
                    totalUsd: expensesTotalUsd,
                    list: expensesData || [],
                    byCategory: processedExpensesByCategory
                },
                purchases: {
                    totalArs: purchasesTotalArs,
                    list: purchasesData || []
                },
                productsBreakdown,
                profitArs,
                netProfitArs
            });

        } catch (err) {
            console.error('Error fetching financial reports:', err);
            setError(locale === 'es' ? 'Error al cargar los datos financieros.' : 'Error loading financial data.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <PageGuard permission="reports.view">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {locale === 'es' ? 'Estado de Resultados' : 'Income Statement (P&L)'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        {locale === 'es' ? 'Análisis integral de ingresos, costos directos y gastos operativos' : 'Comprehensive analysis of revenues, direct costs, and operating expenses'}
                    </p>
                </div>
            </div>

            {/* Date Filters Card */}
            <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                    
                    {/* Quick Select Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                            { key: 'today', label: locale === 'es' ? 'Hoy' : 'Today' },
                            { key: 'yesterday', label: locale === 'es' ? 'Ayer' : 'Yesterday' },
                            { key: 'thisWeek', label: locale === 'es' ? 'Semana' : 'Week' },
                            { key: 'thisMonth', label: locale === 'es' ? 'Mes' : 'Month' },
                            { key: 'lastMonth', label: locale === 'es' ? 'Mes Pasado' : 'Last Month' },
                            { key: 'thisYear', label: locale === 'es' ? 'Año' : 'Year' },
                            { key: 'lastYear', label: locale === 'es' ? 'Año Pasado' : 'Last Year' }
                        ].map((btn) => (
                            <button
                                key={btn.key}
                                onClick={() => {
                                    setQuickFilter(btn.key);
                                    applyQuickFilter(btn.key);
                                }}
                                className={`btn ${quickFilter === btn.key ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '8px', fontWeight: '500' }}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {/* Manual Range inputs */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>DESDE</span>
                            <input
                                type="date"
                                className="form-input"
                                style={{ padding: '8px 12px', borderRadius: '8px', margin: 0 }}
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    setQuickFilter('custom');
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>HASTA</span>
                            <input
                                type="date"
                                className="form-input"
                                style={{ padding: '8px 12px', borderRadius: '8px', margin: 0 }}
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    setQuickFilter('custom');
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <h3>{locale === 'es' ? 'Calculando Estado de Resultados...' : 'Calculating Income Statement...'}</h3>
                </div>
            ) : error ? (
                <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--accent-danger)' }}>
                    <h3>⚠️ Error</h3>
                    <p style={{ margin: '8px 0 16px' }}>{error}</p>
                    <button className="btn btn-primary" onClick={fetchFinancialData}>Reintentar</button>
                </div>
            ) : (
                <>
                    {/* Financial KPI Cards */}
                    <div className="stats-grid">
                        <StatCard
                            icon="💰"
                            label={locale === 'es' ? 'Ingresos Totales (ARS)' : 'Total Revenue (ARS)'}
                            value={formatCurrency(data.sales.amountArs)}
                            subValue={data.sales.amountUsd > 0 ? `${formatCurrency(data.sales.amountUsd, 'USD')} (USD)` : null}
                            type="income"
                        />
                        <StatCard
                            icon="📦"
                            label={locale === 'es' ? 'Costo Mercadería (ARS)' : 'Cost of Goods Sold (COGS)'}
                            value={formatCurrency(data.sales.cogsArs)}
                            subValue={locale === 'es' ? `${formatQuantity(data.sales.quantity)} unidades vendidas` : `${formatQuantity(data.sales.quantity)} units sold`}
                            type="views"
                        />
                        <StatCard
                            icon="📈"
                            label={locale === 'es' ? 'Resultado Bruto' : 'Gross Profit'}
                            value={formatCurrency(data.profitArs)}
                            subValue={data.sales.amountArs > 0 ? `Margen: ${((data.profitArs / data.sales.amountArs) * 100).toFixed(1)}%` : null}
                            type="orders"
                        />
                        <StatCard
                            icon="💸"
                            label={locale === 'es' ? 'Gastos Operativos' : 'Operating Expenses'}
                            value={formatCurrency(data.expenses.totalArs)}
                            subValue={data.expenses.totalUsd > 0 ? `${formatCurrency(data.expenses.totalUsd, 'USD')} (USD)` : null}
                            type="expenses"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
                        {/* P&L Statement Structure */}
                        <div className="card" style={{ padding: '24px' }}>
                            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>
                                    {locale === 'es' ? 'Estructura de Resultados' : 'P&L Structure'}
                                </h3>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {locale === 'es' ? `Período: ${startDate} al ${endDate}` : `Period: ${startDate} to ${endDate}`}
                                </p>
                            </div>

                            {/* P&L Line Items */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                
                                {/* INGRESOS */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', fontSize: '15px' }}>
                                    <span>{locale === 'es' ? 'INGRESOS OPERATIVOS (VENTAS)' : 'OPERATING REVENUES (SALES)'}</span>
                                    <span style={{ color: 'var(--accent-primary)' }}>{formatCurrency(data.sales.amountArs)}</span>
                                </div>
                                {data.sales.amountUsd > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', paddingLeft: '16px', marginTop: '-8px' }}>
                                        <span>Ventas en USD</span>
                                        <span>{formatCurrency(data.sales.amountUsd, 'USD')}</span>
                                    </div>
                                )}

                                {/* COSTO DE MERCADERIA */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '14px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                                    <span>(-) Costo de Mercadería Vendida (COGS)</span>
                                    <span style={{ color: 'var(--accent-danger)' }}>{formatCurrency(data.sales.cogsArs)}</span>
                                </div>

                                {/* UTILIDAD BRUTA */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '16px', background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: '8px', margin: '4px 0' }}>
                                    <span>(=) UTILIDAD BRUTA</span>
                                    <span style={{ color: 'var(--accent-success)' }}>{formatCurrency(data.profitArs)}</span>
                                </div>

                                {/* GASTOS OPERATIVOS */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', fontSize: '15px', marginTop: '8px' }}>
                                    <span>(-) GASTOS OPERATIVOS</span>
                                    <span style={{ color: 'var(--accent-danger)' }}>{formatCurrency(data.expenses.totalArs)}</span>
                                </div>

                                {/* Desglose de Gastos rápidos en la estructura */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '16px' }}>
                                    {data.expenses.byCategory.length > 0 ? (
                                        data.expenses.byCategory.slice(0, 5).map(cat => (
                                            <div 
                                                key={cat.id} 
                                                onClick={() => setSelectedCategoryDetails(cat)}
                                                style={{ 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between', 
                                                    fontSize: '13px', 
                                                    color: 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    padding: '4px 6px',
                                                    borderRadius: '4px',
                                                    marginLeft: '-6px',
                                                    marginRight: '-6px',
                                                    transition: 'all 0.2s',
                                                }}
                                                className="drilldown-row"
                                            >
                                                <span>{cat.name} <span style={{ fontSize: '10px', color: 'var(--accent-primary)' }}>🔍</span></span>
                                                <span>{formatCurrency(cat.amount)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            {locale === 'es' ? 'Sin gastos en este período' : 'No expenses in this period'}
                                        </div>
                                    )}
                                    {data.expenses.byCategory.length > 5 && (
                                        <div style={{ fontSize: '12px', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: '500' }} onClick={() => setActiveTab('expenses')}>
                                            + {locale === 'es' ? 'Ver todos los gastos' : 'View all expenses'}
                                        </div>
                                    )}
                                </div>

                                <div style={{ borderTop: '2px solid var(--border-color)', marginTop: '16px', paddingTop: '16px' }}>
                                    {/* NET PROFIT */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontWeight: '800',
                                        fontSize: '20px',
                                        background: data.netProfitArs >= 0 ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                                        border: data.netProfitArs >= 0 ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(248, 113, 113, 0.3)',
                                        padding: '16px 20px',
                                        borderRadius: '12px'
                                    }}>
                                        <span>{locale === 'es' ? '(=) UTILIDAD NETA' : '(=) NET PROFIT'}</span>
                                        <span style={{ color: data.netProfitArs >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                            {formatCurrency(data.netProfitArs)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                        <span>
                                            {locale === 'es' ? 'Rentabilidad neta sobre ventas:' : 'Net profit margin:'}
                                        </span>
                                        <span style={{ fontWeight: '700', color: data.netProfitArs >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                            {data.sales.amountArs > 0 ? `${((data.netProfitArs / data.sales.amountArs) * 100).toFixed(1)}%` : '0%'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Inventory purchases references card */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div className="card" style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                                    {locale === 'es' ? 'Flujo de Stock e Inventario' : 'Stock & Inventory Flow'}
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                                    {locale === 'es' ? 'Comparativa de inversiones en stock (Compras) contra el costo de lo que se vendió realmente (Costo de Mercadería Vendida).' : 'Comparison of stock investments (Purchases) against what actually sold (Cost of Goods Sold).'}
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {locale === 'es' ? 'COMPRAS REALIZADAS' : 'PURCHASES MADE'}
                                            </div>
                                            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px' }}>
                                                {formatCurrency(data.purchases.totalArs)}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '24px' }}>🛒</span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {locale === 'es' ? 'COSTO DE VENTAS (COGS)' : 'COST OF GOODS SOLD'}
                                            </div>
                                            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px' }}>
                                                {formatCurrency(data.sales.cogsArs)}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '24px' }}>🥚</span>
                                    </div>

                                    <div style={{
                                        fontSize: '12px',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        border: '1px solid rgba(59, 130, 246, 0.2)',
                                        color: 'var(--text-secondary)',
                                        lineHeight: '1.5'
                                    }}>
                                        💡 <strong>{locale === 'es' ? 'Diferencia en Caja:' : 'Cash Flow difference:'}</strong> {formatCurrency(data.purchases.totalArs - data.sales.cogsArs)}
                                        <br />
                                        {data.purchases.totalArs > data.sales.cogsArs 
                                            ? (locale === 'es' ? 'Se compró más stock del que se vendió. Esto representa un aumento de inventario (activo) y una salida de caja temporal.' : 'More inventory was purchased than sold. This represents stock accumulation and a temporary cash outflow.')
                                            : (locale === 'es' ? 'Se vendió más stock del comprado. Se consumió inventario existente, mejorando la liquidez en caja.' : 'More inventory was sold than purchased. Existing inventory was consumed, improving cash liquidity.')
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Breakdown Tables section */}
                    <div className="card">
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                            <div className="tabs" style={{ margin: 0 }}>
                                <button
                                    className={`tab ${activeTab === 'products' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('products')}
                                >
                                    📦 {locale === 'es' ? 'Ventas por Producto' : 'Sales by Product'}
                                </button>
                                <button
                                    className={`tab ${activeTab === 'expenses' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('expenses')}
                                >
                                    💸 {locale === 'es' ? 'Gastos por Categoría' : 'Expenses by Category'}
                                </button>
                                <button
                                    className={`tab ${activeTab === 'purchases' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('purchases')}
                                >
                                    🏭 {locale === 'es' ? 'Desglose de Compras' : 'Purchases breakdown'}
                                </button>
                            </div>
                        </div>
                        
                        <div className="card-body">
                            {activeTab === 'products' && (
                                <>
                                    {data.productsBreakdown.length > 0 ? (
                                        <DataTable
                                            columns={[
                                                { key: 'name', label: locale === 'es' ? 'Producto' : 'Product' },
                                                { key: 'quantity', label: locale === 'es' ? 'Cantidad Vendida' : 'Qty Sold', render: (v) => formatQuantity(v) },
                                                { key: 'revenue', label: locale === 'es' ? 'Ingresos Totales' : 'Total Revenue', render: (v) => formatCurrency(v) },
                                                { key: 'cost', label: locale === 'es' ? 'Costo Mercadería' : 'Product Cost', render: (v) => formatCurrency(v) },
                                                { key: 'profit', label: locale === 'es' ? 'Utilidad Bruta' : 'Gross Margin', render: (v) => (
                                                    <span style={{ color: 'var(--accent-success)', fontWeight: '600' }}>{formatCurrency(v)}</span>
                                                ) },
                                                { key: 'margin', label: 'Margen %', render: (_, row) => (
                                                    <span style={{ fontWeight: '500' }}>
                                                        {row.revenue > 0 ? `${((row.profit / row.revenue) * 100).toFixed(1)}%` : '0%'}
                                                    </span>
                                                ) }
                                            ]}
                                            data={data.productsBreakdown}
                                        />
                                    ) : (
                                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            {locale === 'es' ? 'Sin ventas de productos registradas en este período.' : 'No product sales recorded in this period.'}
                                        </div>
                                    )}
                                </>
                            )}

                            {activeTab === 'expenses' && (
                                <>
                                    {data.expenses.byCategory.length > 0 ? (
                                        <DataTable
                                            columns={[
                                                { key: 'name', label: locale === 'es' ? 'Categoría de Gasto' : 'Expense Category' },
                                                { key: 'count', label: locale === 'es' ? 'Transacciones' : 'Transactions' },
                                                { key: 'amount', label: locale === 'es' ? 'Monto Total' : 'Total Amount', render: (v) => formatCurrency(v) },
                                                { key: 'percent', label: '% del Total', render: (_, row) => (
                                                    <span style={{ fontWeight: '500' }}>
                                                        {data.expenses.totalArs > 0 ? `${((row.amount / data.expenses.totalArs) * 100).toFixed(1)}%` : '0%'}
                                                    </span>
                                                ) }
                                            ]}
                                            data={data.expenses.byCategory}
                                            onRowClick={(row) => setSelectedCategoryDetails(row)}
                                        />
                                    ) : (
                                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            {locale === 'es' ? 'Sin gastos registrados en este período.' : 'No expenses recorded in this period.'}
                                        </div>
                                    )}
                                </>
                            )}

                            {activeTab === 'purchases' && (
                                <>
                                    {data.purchases.list.length > 0 ? (
                                        <DataTable
                                            columns={[
                                                { key: 'id', label: '#' },
                                                { key: 'date', label: locale === 'es' ? 'Fecha' : 'Date' },
                                                { key: 'status', label: 'Status', render: (v) => (
                                                    <span className={`badge ${v === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                                                        {v === 'completed' ? (locale === 'es' ? 'Completado' : 'Completed') : v}
                                                    </span>
                                                ) },
                                                { key: 'total', label: locale === 'es' ? 'Monto' : 'Amount', render: (v) => formatCurrency(v) }
                                            ]}
                                            data={data.purchases.list}
                                        />
                                    ) : (
                                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            {locale === 'es' ? 'Sin compras registradas en este período.' : 'No purchases recorded in this period.'}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Modal de Detalle de Movimientos de Egreso */}
            {selectedCategoryDetails && (
                <div 
                    className="modal-overlay" 
                    onClick={() => setSelectedCategoryDetails(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(6px)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div 
                        className="modal" 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '90%',
                            maxWidth: '750px',
                            maxHeight: '85vh',
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: 'var(--bg-primary)',
                            borderRadius: '16px',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                            overflow: 'hidden',
                            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        {/* Modal Header */}
                        <div 
                            className="modal-header"
                            style={{
                                padding: '20px 24px',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'var(--bg-secondary)'
                            }}
                        >
                            <div>
                                <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                                    {locale === 'es' 
                                        ? `Detalle de Gastos: ${selectedCategoryDetails.name}` 
                                        : `Expense Details: ${selectedCategoryDetails.name}`}
                                </h3>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', margin: '4px 0 0' }}>
                                    {locale === 'es'
                                        ? `${selectedCategoryDetails.expensesList?.length || 0} movimientos encontrados en el período`
                                        : `${selectedCategoryDetails.expensesList?.length || 0} movements found in the period`}
                                </p>
                            </div>
                            <button 
                                className="modal-close" 
                                onClick={() => setSelectedCategoryDetails(null)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '22px',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div 
                            className="modal-body"
                            style={{
                                padding: '24px',
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px'
                            }}
                        >
                            {/* Search bar inside Modal */}
                            <div className="form-group" style={{ margin: 0 }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder={locale === 'es' ? '🔍 Buscar movimiento (Ej: Sueldo, Combustible...)' : '🔍 Search movement...'}
                                    value={modalSearchTerm}
                                    onChange={(e) => setModalSearchTerm(e.target.value)}
                                    style={{
                                        padding: '10px 16px',
                                        borderRadius: '10px',
                                        width: '100%',
                                        fontSize: '14px',
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-primary)'
                                    }}
                                    autoFocus
                                />
                            </div>

                            {/* Table list */}
                            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                {locale === 'es' ? 'Fecha' : 'Date'}
                                            </th>
                                            <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                {locale === 'es' ? 'Detalle / Descripción' : 'Description'}
                                            </th>
                                            <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                {locale === 'es' ? 'Responsable' : 'Responsible'}
                                            </th>
                                            <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'right' }}>
                                                {locale === 'es' ? 'Monto' : 'Amount'}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const filtered = (selectedCategoryDetails.expensesList || []).filter(item => {
                                                if (!modalSearchTerm) return true;
                                                const search = modalSearchTerm.toLowerCase();
                                                return (
                                                    item.description?.toLowerCase().includes(search) ||
                                                    item.userName?.toLowerCase().includes(search)
                                                );
                                            }).sort((a, b) => {
                                                const dA = a.date ? new Date(a.date).getTime() : 0;
                                                const dB = b.date ? new Date(b.date).getTime() : 0;
                                                return dB - dA;
                                            });

                                            if (filtered.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                            {locale === 'es' ? 'No se encontraron movimientos' : 'No movements found'}
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            return filtered.map((item, idx) => (
                                                <tr 
                                                    key={item.id || idx}
                                                    style={{ 
                                                        borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid var(--border-color)',
                                                        backgroundColor: idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-tertiary)'
                                                    }}
                                                >
                                                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                                        {formatDateLocal(item.date)}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                                        {item.description}
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span className="badge badge-info" style={{ fontSize: '11px', padding: '4px 8px' }}>
                                                            {item.userName}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: 'var(--accent-danger)' }}>
                                                        <div>{formatCurrency(item.amount, item.currency)}</div>
                                                        {item.originalCurrency === 'USD' && (
                                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '2px' }}>
                                                                {formatCurrency(item.originalAmount, 'USD')} (Cotiz: ${item.rate})
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div 
                            className="modal-footer"
                            style={{
                                padding: '16px 24px',
                                borderTop: '1px solid var(--border-color)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'var(--bg-secondary)'
                            }}
                        >
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                <strong>Total:</strong> <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(selectedCategoryDetails.amount, selectedCategoryDetails.currency || 'ARS')}</span>
                            </div>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setSelectedCategoryDetails(null)}
                                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', margin: 0 }}
                            >
                                {locale === 'es' ? 'Cerrar' : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .drilldown-row {
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .drilldown-row:hover {
                    background-color: var(--bg-tertiary) !important;
                    color: var(--text-primary) !important;
                    padding-left: 10px !important;
                    border-radius: 4px;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
        </PageGuard>
    );
}
