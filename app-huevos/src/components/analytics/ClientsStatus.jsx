'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const formatCurrency = (v) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(v || 0);

const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

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

export default function ClientsStatus() {
    const [days, setDays] = useState(30);
    const [inputDays, setInputDays] = useState('30');
    const [allClients, setAllClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState('days_inactive'); // 'days_inactive' | 'monthly_avg_purchase'
    const [sortDir, setSortDir] = useState('desc');
    const [evolutionData, setEvolutionData] = useState([]);
    const [evLoading, setEvLoading] = useState(false);

    const fetchClientsStatus = useCallback(async (daysParam) => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('rpc_get_clients_status', {
                p_days: daysParam
            });
            if (rpcError) throw rpcError;
            setAllClients(data || []);
        } catch (err) {
            setError(err.message || 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchEvolution = useCallback(async () => {
        setEvLoading(true);
        try {
            // Evolution: active clients per month (last 12 months)
            const end = new Date();
            const start = new Date();
            start.setMonth(start.getMonth() - 11);
            start.setDate(1);
            const { data, error: rpcError } = await supabase.rpc('rpc_get_clients_retention', {
                p_start_date: start.toISOString().slice(0, 10),
                p_end_date: end.toISOString().slice(0, 10),
            });
            if (!rpcError) setEvolutionData(data || []);
        } finally {
            setEvLoading(false);
        }
    }, []);

    useEffect(() => { fetchClientsStatus(days); }, [days, fetchClientsStatus]);
    useEffect(() => { fetchEvolution(); }, [fetchEvolution]);

    const applyDays = () => {
        const n = parseInt(inputDays);
        if (!isNaN(n) && n > 0) setDays(n);
    };

    const activeClients = allClients.filter(c => c.is_active);
    const inactiveClients = allClients.filter(c => !c.is_active);

    const sortedInactive = [...inactiveClients].sort((a, b) => {
        const va = parseFloat(a[sortBy] || 0);
        const vb = parseFloat(b[sortBy] || 0);
        return sortDir === 'desc' ? vb - va : va - vb;
    });

    const toggleSort = (field) => {
        if (sortBy === field) {
            setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(field);
            setSortDir('desc');
        }
    };

    const SortIcon = ({ field }) => {
        if (sortBy !== field) return <span style={{ opacity: 0.3 }}>↕</span>;
        return <span>{sortDir === 'desc' ? '↓' : '↑'}</span>;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Days Input */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Umbral de inactividad:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        id="inactive-days-input"
                        type="number"
                        min="1"
                        value={inputDays}
                        onChange={e => setInputDays(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && applyDays()}
                        style={{ ...inputStyle, width: '80px', textAlign: 'center', fontSize: '18px', fontWeight: '700' }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>días</span>
                </div>
                <button onClick={applyDays} style={btnStyle} disabled={loading}>
                    Aplicar
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    (o presioná Enter en el campo)
                </span>
            </div>

            {error && <div style={errorStyle}>⚠️ {error}</div>}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--accent-success)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Clientes Activos</div>
                    <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--accent-success)' }}>
                        {loading ? '…' : activeClients.length}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>compraron en los últimos {days} días</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--accent-warning)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Clientes Inactivos</div>
                    <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--accent-warning)' }}>
                        {loading ? '…' : inactiveClients.length}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>sin comprar hace más de {days} días</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--accent-info)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Clientes con Compras</div>
                    <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--accent-info)' }}>
                        {loading ? '…' : allClients.length}
                    </div>
                </div>
            </div>

            {/* Inactive Clients Table */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Clientes Inactivos</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => toggleSort('days_inactive')} style={{ ...sortBtnStyle, background: sortBy === 'days_inactive' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: sortBy === 'days_inactive' ? '#fff' : 'var(--text-secondary)' }}>
                            Días sin comprar <SortIcon field="days_inactive" />
                        </button>
                        <button onClick={() => toggleSort('monthly_avg_purchase')} style={{ ...sortBtnStyle, background: sortBy === 'monthly_avg_purchase' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: sortBy === 'monthly_avg_purchase' ? '#fff' : 'var(--text-secondary)' }}>
                            Promedio mensual <SortIcon field="monthly_avg_purchase" />
                        </button>
                    </div>
                </div>
                {loading ? (
                    <div style={loadingStyle}><div className="spinner" style={{ margin: '0 auto 12px' }} /></div>
                ) : sortedInactive.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-success)' }}>
                        ✅ No hay clientes inactivos con el umbral de {days} días.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)' }}>
                                    {['#', 'Cliente', 'Última Compra', 'Días sin Comprar', 'Prom. Mensual Histórico'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedInactive.map((client, i) => {
                                    const dias = parseInt(client.days_inactive || 0);
                                    const urgencyColor = dias > 90 ? 'var(--accent-danger)' : dias > 30 ? 'var(--accent-warning)' : 'var(--text-secondary)';
                                    return (
                                        <tr key={client.client_id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)' }}>
                                            <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{i + 1}</td>
                                            <td style={{ ...tdStyle, fontWeight: '600' }}>{client.client_name}</td>
                                            <td style={tdStyle}>{formatDate(client.last_purchase_date)}</td>
                                            <td style={{ ...tdStyle }}>
                                                <span style={{ fontWeight: '700', color: urgencyColor, fontSize: '16px' }}>{dias}</span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}> días</span>
                                            </td>
                                            <td style={{ ...tdStyle, fontWeight: '600' }}>{formatCurrency(client.monthly_avg_purchase)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Evolution Chart */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                <h3 style={sectionTitle}>Evolución mensual de Clientes Activos (últimos 12 meses)</h3>
                {evLoading ? (
                    <div style={loadingStyle}><div className="spinner" style={{ margin: '0 auto 12px' }} /></div>
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={evolutionData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorClients" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                            <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }} dx={-10} />
                            <Tooltip contentStyle={customTooltipStyle} itemStyle={{ color: '#fff' }} />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                            <Area type="monotone" dataKey="total_active_clients" name="Clientes Activos" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorClients)" activeDot={{ r: 6, strokeWidth: 0 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' };
const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px' };
const btnStyle = { padding: '8px 16px', borderRadius: '8px', background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' };
const sortBtnStyle = { padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '12px' };
const sectionTitle = { fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' };
const errorStyle = { padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-danger)', borderRadius: '8px', color: 'var(--accent-danger)' };
const loadingStyle = { padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' };
const tdStyle = { padding: '12px 16px', color: 'var(--text-secondary)' };
