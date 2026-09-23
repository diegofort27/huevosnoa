'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const formatCurrency = (v) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(v || 0);

const formatNum = (v) => new Intl.NumberFormat('es-AR').format(v || 0);

// Paleta de colores más vibrante y moderna (estilo Tailwind/Stripe)
const COLORS = [
    '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899',
    '#14b8a6', '#f43f5e', '#6366f1', '#f97316', '#06b6d4'
];

// Estilo moderno para el tooltip
const customTooltipStyle = {
    background: 'rgba(15, 23, 42, 0.9)', // slate-900 con opacidad
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    color: '#fff',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: '500'
};

function getDefaultDates() {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
    };
}

export default function SalesEvolutionChart() {
    const defaults = getDefaultDates();
    const [startDate, setStartDate] = useState(defaults.start);
    const [endDate, setEndDate] = useState(defaults.end);
    const [mode, setMode] = useState('amount'); // 'amount' | 'quantity'
    const [groupBy, setGroupBy] = useState('total'); // 'total' | 'category' | 'unit'
    const [chartType, setChartType] = useState('bar'); // 'bar' | 'line'
    const [rawData, setRawData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('rpc_get_sales_evolution', {
                p_start_date: startDate,
                p_end_date: endDate,
            });
            if (rpcError) throw rpcError;
            setRawData(data || []);
        } catch (err) {
            setError(err.message || 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Build chart data
    const months = [...new Set(rawData.map(r => r.mes))].sort();

    let chartData = [];
    let seriesKeys = [];

    if (groupBy === 'total') {
        chartData = months.map(mes => {
            const rows = rawData.filter(r => r.mes === mes);
            const total_amount = rows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
            const total_quantity = rows.reduce((s, r) => s + parseFloat(r.total_quantity || 0), 0);
            return { mes, Total: mode === 'amount' ? total_amount : total_quantity };
        });
        seriesKeys = ['Total'];
    } else {
        const groupField = groupBy === 'category' ? 'category_name' : 'unit_name';
        seriesKeys = [...new Set(rawData.map(r => r[groupField]))].filter(Boolean).sort();

        if (mode === 'quantity' && groupBy === 'unit') {
            // Per unit, separate series
            chartData = months.map(mes => {
                const row = { mes };
                seriesKeys.forEach(key => {
                    const rows = rawData.filter(r => r.mes === mes && r[groupField] === key);
                    row[key] = rows.reduce((s, r) => s + parseFloat(r.total_quantity || 0), 0);
                });
                return row;
            });
        } else {
            chartData = months.map(mes => {
                const row = { mes };
                seriesKeys.forEach(key => {
                    const rows = rawData.filter(r => r.mes === mes && r[groupField] === key);
                    const val = mode === 'amount'
                        ? rows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)
                        : rows.reduce((s, r) => s + parseFloat(r.total_quantity || 0), 0);
                    row[key] = val;
                });
                return row;
            });
        }
    }

    // % variation vs prior month
    const variationData = months.map((mes, i) => {
        if (i === 0) return null;
        const curr = chartData[i];
        const prev = chartData[i - 1];
        const currTotal = seriesKeys.reduce((s, k) => s + (curr[k] || 0), 0);
        const prevTotal = seriesKeys.reduce((s, k) => s + (prev[k] || 0), 0);
        if (prevTotal === 0) return null;
        return ((currTotal - prevTotal) / prevTotal) * 100;
    });

    const tooltipFormatter = (value, name) =>
        mode === 'amount' ? [formatCurrency(value), name] : [formatNum(value), name];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                <div>
                    <label style={labelStyle}>Desde</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>Hasta</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>Ver en</label>
                    <select value={mode} onChange={e => setMode(e.target.value)} style={inputStyle}>
                        <option value="amount">$ (Monto)</option>
                        <option value="quantity">Unidades (Cantidad)</option>
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Agrupar por</label>
                    <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={inputStyle}>
                        <option value="total">Total</option>
                        <option value="category">Categoría</option>
                        <option value="unit">Unidad de Venta</option>
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Tipo gráfico</label>
                    <select value={chartType} onChange={e => setChartType(e.target.value)} style={inputStyle}>
                        <option value="bar">Barras</option>
                        <option value="line">Líneas</option>
                    </select>
                </div>
                <button onClick={fetchData} style={btnStyle} disabled={loading}>
                    {loading ? '⏳ Cargando...' : '🔄 Actualizar'}
                </button>
            </div>

            {error && <div style={errorStyle}>⚠️ {error}</div>}

            {loading ? (
                <div style={loadingStyle}><div className="spinner" style={{ margin: '0 auto 12px' }} />Cargando datos...</div>
            ) : chartData.length === 0 ? (
                <div style={emptyStyle}>No hay datos para el período seleccionado.</div>
            ) : (
                <>
                    {/* Main Chart */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <h3 style={sectionTitle}>
                            {mode === 'amount' ? 'Ventas en $' : 'Ventas en Unidades'}
                            {groupBy !== 'total' && ` — por ${groupBy === 'category' ? 'Categoría' : 'Unidad de Venta'}`}
                        </h3>
                        <ResponsiveContainer width="100%" height={320}>
                            {chartType === 'bar' ? (
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                    <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}
                                        tickFormatter={mode === 'amount' ? v => `$${(v / 1000).toFixed(0)}k` : v => formatNum(v)} dx={-10} />
                                    <Tooltip formatter={tooltipFormatter} contentStyle={customTooltipStyle} itemStyle={{ color: '#fff' }} cursor={{ fill: 'var(--text-muted)', opacity: 0.1 }} />
                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                                    {seriesKeys.map((key, i) => (
                                        <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[6, 6, 0, 0]} stackId={groupBy !== 'total' ? 'stack' : undefined} maxBarSize={60} />
                                    ))}
                                </BarChart>
                            ) : (
                                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                                    <defs>
                                        {seriesKeys.map((key, i) => (
                                            <linearGradient key={`color-${i}`} id={`color-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0}/>
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                    <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}
                                        tickFormatter={mode === 'amount' ? v => `$${(v / 1000).toFixed(0)}k` : v => formatNum(v)} dx={-10} />
                                    <Tooltip formatter={tooltipFormatter} contentStyle={customTooltipStyle} itemStyle={{ color: '#fff' }} />
                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                                    {seriesKeys.map((key, i) => (
                                        <Area key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={3} fillOpacity={1} fill={`url(#color-${i})`} activeDot={{ r: 6, strokeWidth: 0 }} />
                                    ))}
                                </AreaChart>
                            )}
                        </ResponsiveContainer>
                    </div>

                    {/* Variation vs prior month */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <h3 style={sectionTitle}>Variación vs mes anterior (%)</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
                            {months.map((mes, i) => {
                                const pct = variationData[i];
                                if (pct === null) return null;
                                const isPos = pct >= 0;
                                return (
                                    <div key={mes} style={{
                                        background: isPos ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        border: `1px solid ${isPos ? 'var(--accent-success)' : 'var(--accent-danger)'}`,
                                        borderRadius: '8px', padding: '10px 16px', textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{mes}</div>
                                        <div style={{ fontSize: '18px', fontWeight: '700', color: isPos ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                            {isPos ? '+' : ''}{pct.toFixed(1)}%
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' };
const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px' };
const btnStyle = { padding: '8px 16px', borderRadius: '8px', background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' };
const sectionTitle = { fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' };
const errorStyle = { padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-danger)', borderRadius: '8px', color: 'var(--accent-danger)' };
const loadingStyle = { padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' };
const emptyStyle = { padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' };
