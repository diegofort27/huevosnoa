'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const formatCurrency = (v) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(v || 0);

function getDefaultDates() {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function ClientsRetention() {
    const defaults = getDefaultDates();
    const [startDate, setStartDate] = useState(defaults.start);
    const [endDate, setEndDate] = useState(defaults.end);
    const [data, setData] = useState([]);
    const [topFallClients, setTopFallClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: retentionData, error: rpcError } = await supabase.rpc('rpc_get_clients_retention', {
                p_start_date: startDate,
                p_end_date: endDate,
            });
            if (rpcError) throw rpcError;
            setData(retentionData || []);

            // Top 10 clients with biggest drop: compare last 3 months vs 3 prior months
            const now = new Date();
            const last3End = new Date(now);
            const last3Start = new Date(now);
            last3Start.setMonth(last3Start.getMonth() - 2);
            last3Start.setDate(1);
            const prev3End = new Date(last3Start);
            prev3End.setDate(prev3End.getDate() - 1);
            const prev3Start = new Date(prev3End);
            prev3Start.setMonth(prev3Start.getMonth() - 2);
            prev3Start.setDate(1);

            const [currQ, prevQ] = await Promise.all([
                supabase.from('sales')
                    .select('client_id, total, clients(name)')
                    .gte('date', last3Start.toISOString().slice(0, 10))
                    .lte('date', last3End.toISOString().slice(0, 10))
                    .neq('status', 'cancelled'),
                supabase.from('sales')
                    .select('client_id, total, clients(name)')
                    .gte('date', prev3Start.toISOString().slice(0, 10))
                    .lte('date', prev3End.toISOString().slice(0, 10))
                    .neq('status', 'cancelled'),
            ]);

            if (!currQ.error && !prevQ.error) {
                const sumByClient = (rows) => {
                    const map = {};
                    (rows || []).forEach(r => {
                        if (!map[r.client_id]) map[r.client_id] = { name: r.clients?.name || r.client_id, total: 0 };
                        map[r.client_id].total += parseFloat(r.total || 0);
                    });
                    return map;
                };
                const currMap = sumByClient(currQ.data);
                const prevMap = sumByClient(prevQ.data);

                const falls = Object.keys(prevMap)
                    .filter(id => prevMap[id].total > 0)
                    .map(id => {
                        const currTotal = currMap[id]?.total || 0;
                        const prevTotal = prevMap[id].total;
                        const drop = prevTotal - currTotal;
                        const dropPct = (drop / prevTotal) * 100;
                        return {
                            client_id: id,
                            name: prevMap[id].name,
                            prev_total: prevTotal,
                            curr_total: currTotal,
                            drop,
                            dropPct,
                        };
                    })
                    .filter(c => c.drop > 0)
                    .sort((a, b) => b.drop - a.drop)
                    .slice(0, 10);
                setTopFallClients(falls);
            }
        } catch (err) {
            setError(err.message || 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Computed stats from data
    const latestMonth = data.length > 0 ? data[data.length - 1] : null;
    const prevMonth = data.length > 1 ? data[data.length - 2] : null;
    const retentionRate = latestMonth && prevMonth && parseInt(prevMonth.total_active_clients) > 0
        ? ((parseInt(latestMonth.retained_clients_count) / parseInt(prevMonth.total_active_clients)) * 100).toFixed(1)
        : null;

    const totalNewInPeriod = data.reduce((s, r) => s + parseInt(r.new_clients_count || 0), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                <button onClick={fetchData} style={btnStyle} disabled={loading}>
                    {loading ? '⏳ Cargando...' : '🔄 Actualizar'}
                </button>
            </div>

            {error && <div style={errorStyle}>⚠️ {error}</div>}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={kpiCard('#6366f1')}>
                    <div style={kpiLabel}>Nuevos Clientes en el Período</div>
                    <div style={{ ...kpiValue, color: '#6366f1' }}>{loading ? '…' : totalNewInPeriod}</div>
                </div>
                <div style={kpiCard('#10b981')}>
                    <div style={kpiLabel}>% Retención (último mes)</div>
                    <div style={{ ...kpiValue, color: '#10b981' }}>{loading ? '…' : retentionRate !== null ? `${retentionRate}%` : '—'}</div>
                </div>
                {latestMonth && (
                    <div style={kpiCard('#3b82f6')}>
                        <div style={kpiLabel}>Activos último mes ({latestMonth.mes})</div>
                        <div style={{ ...kpiValue, color: '#3b82f6' }}>{loading ? '…' : latestMonth.total_active_clients}</div>
                    </div>
                )}
            </div>

            {/* New Clients per Month Chart */}
            {!loading && data.length > 0 && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                    <h3 style={sectionTitle}>Clientes Nuevos y Retenidos por Mes</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="mes" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                            <Legend />
                            <Bar dataKey="new_clients_count" name="Clientes Nuevos" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="retained_clients_count" name="Clientes Retenidos" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Top 10 falling clients */}
            {!loading && topFallClients.length > 0 && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Top 10 Clientes con Mayor Caída de Compras</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Comparando últimos 3 meses vs 3 meses anteriores
                        </p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)' }}>
                                    {['#', 'Cliente', 'Prev. 3 meses', 'Últ. 3 meses', 'Caída $', 'Caída %'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {topFallClients.map((c, i) => (
                                    <tr key={c.client_id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)' }}>
                                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{i + 1}</td>
                                        <td style={{ ...tdStyle, fontWeight: '600' }}>{c.name}</td>
                                        <td style={tdStyle}>{formatCurrency(c.prev_total)}</td>
                                        <td style={tdStyle}>{formatCurrency(c.curr_total)}</td>
                                        <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--accent-danger)' }}>-{formatCurrency(c.drop)}</td>
                                        <td style={{ ...tdStyle }}>
                                            <span style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>
                                                -{c.dropPct.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' };
const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px' };
const btnStyle = { padding: '8px 16px', borderRadius: '8px', background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' };
const sectionTitle = { fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' };
const errorStyle = { padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-danger)', borderRadius: '8px', color: 'var(--accent-danger)' };
const tdStyle = { padding: '12px 16px', color: 'var(--text-secondary)' };
const kpiCard = (color) => ({ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', borderLeft: `4px solid ${color}` });
const kpiLabel = { fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' };
const kpiValue = { fontSize: '36px', fontWeight: '700' };
