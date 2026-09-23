'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const formatCurrency = (v) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(v || 0);
const formatNum = (v) => new Intl.NumberFormat('es-AR').format(v || 0);

function getDefaultDates() {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 2);
    start.setDate(1);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function SalesByCategoryTable() {
    const defaults = getDefaultDates();
    const [startDate, setStartDate] = useState(defaults.start);
    const [endDate, setEndDate] = useState(defaults.end);
    const [prevStartDate, setPrevStartDate] = useState('');
    const [prevEndDate, setPrevEndDate] = useState('');
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [data, setData] = useState([]);
    const [prevData, setPrevData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Load categories
    useEffect(() => {
        supabase.from('product_categories').select('id, name').order('name')
            .then(({ data: cats }) => setCategories(cats || []));
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const catId = selectedCategory ? parseInt(selectedCategory) : null;
            const [curr, prev] = await Promise.all([
                supabase.rpc('rpc_get_sales_by_category', {
                    p_start_date: startDate,
                    p_end_date: endDate,
                    p_category_id: catId,
                }),
                prevStartDate && prevEndDate
                    ? supabase.rpc('rpc_get_sales_by_category', {
                        p_start_date: prevStartDate,
                        p_end_date: prevEndDate,
                        p_category_id: catId,
                    })
                    : Promise.resolve({ data: [] })
            ]);
            if (curr.error) throw curr.error;
            setData(curr.data || []);
            setPrevData(prev.data || []);
        } catch (err) {
            setError(err.message || 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, prevStartDate, prevEndDate, selectedCategory]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Totals by unit for % calculation
    const totalByUnit = {};
    data.forEach(row => {
        const key = row.unit_name;
        totalByUnit[key] = (totalByUnit[key] || 0) + parseFloat(row.total_quantity || 0);
    });

    // Chart data (group by category, sum amounts/quantities)
    const chartCategories = [...new Set(data.map(r => r.category_name))];
    const chartData = chartCategories.map(cat => {
        const rows = data.filter(r => r.category_name === cat);
        return {
            category: cat,
            Cantidad: rows.reduce((s, r) => s + parseFloat(r.total_quantity || 0), 0),
            Monto: rows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0),
        };
    });

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
                    <label style={labelStyle}>Período anterior (desde)</label>
                    <input type="date" value={prevStartDate} onChange={e => setPrevStartDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>Período anterior (hasta)</label>
                    <input type="date" value={prevEndDate} onChange={e => setPrevEndDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>Categoría</label>
                    <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={inputStyle}>
                        <option value="">Todas</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <button onClick={fetchData} style={btnStyle} disabled={loading}>
                    {loading ? '⏳ Cargando...' : '🔄 Actualizar'}
                </button>
            </div>

            {error && <div style={errorStyle}>⚠️ {error}</div>}

            {loading ? (
                <div style={loadingStyle}><div className="spinner" style={{ margin: '0 auto 12px' }} />Cargando datos...</div>
            ) : data.length === 0 ? (
                <div style={emptyStyle}>No hay datos para el período seleccionado.</div>
            ) : (
                <>
                    {/* Dual Axis Chart */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <h3 style={sectionTitle}>Volumen (barras) vs Monto $ (línea) por Categoría</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={chartData} margin={{ top: 10, right: 40, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="category" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                                <YAxis yAxisId="left" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                    tickFormatter={v => formatNum(v)} label={{ value: 'Unidades', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} label={{ value: 'Monto $', angle: 90, position: 'insideRight', fill: 'var(--text-muted)', fontSize: 12 }} />
                                <Tooltip
                                    formatter={(val, name) => name === 'Monto' ? [formatCurrency(val), name] : [formatNum(val), name]}
                                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                                <Legend />
                                <Bar yAxisId="left" dataKey="Cantidad" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="Monto" stroke="#10b981" strokeWidth={2} dot={{ r: 5 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Table */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Detalle por Categoría y Unidad</h3>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-tertiary)' }}>
                                        {['Categoría', 'Unidad', 'Cantidad', '% del total (unidad)', 'Precio Prom.', 'Monto Total', 'Variación vs ant.'].map(h => (
                                            <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((row, i) => {
                                        const pct = totalByUnit[row.unit_name]
                                            ? ((parseFloat(row.total_quantity) / totalByUnit[row.unit_name]) * 100).toFixed(1)
                                            : '—';

                                        const prevRow = prevData.find(p => p.category_name === row.category_name && p.unit_name === row.unit_name);
                                        let variation = '—';
                                        let variationColor = 'var(--text-secondary)';
                                        if (prevRow && parseFloat(prevRow.total_amount) > 0) {
                                            const pctVar = ((parseFloat(row.total_amount) - parseFloat(prevRow.total_amount)) / parseFloat(prevRow.total_amount)) * 100;
                                            variation = `${pctVar >= 0 ? '+' : ''}${pctVar.toFixed(1)}%`;
                                            variationColor = pctVar >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';
                                        }

                                        return (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)' }}>
                                                <td style={tdStyle}><span style={{ fontWeight: '600' }}>{row.category_name}</span></td>
                                                <td style={tdStyle}>
                                                    <span style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                                                        {row.unit_name}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>{formatNum(row.total_quantity)}</td>
                                                <td style={tdStyle}>{pct}%</td>
                                                <td style={tdStyle}>{formatCurrency(row.avg_price)}</td>
                                                <td style={{ ...tdStyle, fontWeight: '600' }}>{formatCurrency(row.total_amount)}</td>
                                                <td style={{ ...tdStyle, fontWeight: '700', color: variationColor }}>{variation}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
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
const tdStyle = { padding: '12px 16px', color: 'var(--text-secondary)' };
