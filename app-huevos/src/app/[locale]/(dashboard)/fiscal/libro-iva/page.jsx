'use client';

import { useState, useEffect } from 'react';
import { getComprobantes, getEmpresaConfig } from '@/lib/api';
import { getUltimosPeriodos, formatearPeriodo, generarLibroIvaCSV } from '@/lib/fiscal';

const formatCurrency = (v) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(v || 0);

const COLS_VENTAS = [
    { key: 'fecha_emision', label: 'Fecha' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'pv_numero', label: 'PV-Número' },
    { key: 'cuit_receptor', label: 'CUIT' },
    { key: 'receptor_nombre', label: 'Razón Social' },
    { key: 'condicion_iva_receptor', label: 'Cond.' },
    { key: 'neto_gravado_21', label: 'Neto 21%', right: true },
    { key: 'neto_gravado_105', label: 'Neto 10.5%', right: true },
    { key: 'neto_no_gravado', label: 'No Grav.', right: true },
    { key: 'neto_exento', label: 'Exento', right: true },
    { key: 'iva_21', label: 'IVA 21%', right: true },
    { key: 'iva_105', label: 'IVA 10.5%', right: true },
    { key: 'total_comprobante', label: 'Total', right: true },
];

export default function LibroIvaPage() {
    const periodos = getUltimosPeriodos(24);
    const [tab, setTab] = useState('ventas');
    const [selectedPeriodo, setSelectedPeriodo] = useState(periodos[0]?.valor || '');
    const [tipoFiltro, setTipoFiltro] = useState('');
    const [comprobantes, setComprobantes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [empresaConfig, setEmpresaConfig] = useState(null);

    useEffect(() => {
        loadData();
    }, [tab, selectedPeriodo]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [data, config] = await Promise.all([
                getComprobantes({ flujo: tab === 'ventas' ? 'venta' : 'compra', periodo: selectedPeriodo }),
                getEmpresaConfig(),
            ]);
            setComprobantes(data);
            setEmpresaConfig(config);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const filtered = comprobantes.filter(c => {
        if (tipoFiltro && c.tipo_comprobante_codigo !== tipoFiltro) return false;
        return true;
    });

    const noAnulados = filtered.filter(c => !c.anulado);

    const totales = noAnulados.reduce((acc, c) => ({
        neto_gravado_21: acc.neto_gravado_21 + parseFloat(c.neto_gravado_21 || 0),
        neto_gravado_105: acc.neto_gravado_105 + parseFloat(c.neto_gravado_105 || 0),
        neto_no_gravado: acc.neto_no_gravado + parseFloat(c.neto_no_gravado || 0),
        neto_exento: acc.neto_exento + parseFloat(c.neto_exento || 0),
        iva_21: acc.iva_21 + parseFloat(c.iva_21 || 0),
        iva_105: acc.iva_105 + parseFloat(c.iva_105 || 0),
        total_comprobante: acc.total_comprobante + parseFloat(c.total_comprobante || 0),
    }), { neto_gravado_21: 0, neto_gravado_105: 0, neto_no_gravado: 0, neto_exento: 0, iva_21: 0, iva_105: 0, total_comprobante: 0 });

    const handleExportCSV = () => {
        const enriched = filtered.map(c => ({
            ...c,
            cuit_emisor: empresaConfig?.cuit,
            razon_social_emisor: empresaConfig?.razon_social,
        }));
        const csv = generarLibroIvaCSV(enriched, tab);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `libro_iva_${tab}_${selectedPeriodo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const tiposUnicos = [...new Set(comprobantes.map(c => c.tipo_comprobante_codigo).filter(Boolean))];

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700' }}>📚 Libro IVA Digital</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                        Formato compatible con ARCA — Exportable a CSV
                    </p>
                </div>
                <button className="btn btn-primary" onClick={handleExportCSV} disabled={isLoading || noAnulados.length === 0}>
                    ⬇️ Exportar CSV (ARCA)
                </button>
            </div>

            {/* Tabs + Filtros */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    {['ventas', 'compras'].map(t => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: '6px 18px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500',
                            background: tab === t ? 'var(--accent-primary)' : 'transparent',
                            color: tab === t ? 'white' : 'var(--text-secondary)',
                            transition: 'all 0.15s'
                        }}>
                            {t === 'ventas' ? '📤 Ventas' : '📥 Compras'}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select className="form-select" value={selectedPeriodo} onChange={e => setSelectedPeriodo(e.target.value)} style={{ minWidth: '160px' }}>
                        {periodos.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
                    </select>
                    <select className="form-select" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} style={{ minWidth: '140px' }}>
                        <option value="">Todos los tipos</option>
                        {tiposUnicos.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {/* Totalizadores rápidos */}
            {!isLoading && noAnulados.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                    {[
                        { label: 'Neto 21%', value: totales.neto_gravado_21, color: '#60a5fa' },
                        { label: 'Neto 10.5%', value: totales.neto_gravado_105, color: '#a78bfa' },
                        { label: 'IVA 21%', value: totales.iva_21, color: '#f87171' },
                        { label: 'IVA 10.5%', value: totales.iva_105, color: '#fb923c' },
                        { label: 'No Gravado', value: totales.neto_no_gravado, color: '#6b7280' },
                        { label: 'Exento', value: totales.neto_exento, color: '#6b7280' },
                        { label: 'TOTAL', value: totales.total_comprobante, color: 'var(--accent-primary)' },
                    ].map(t => (
                        <div key={t.label} style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)', padding: '10px 12px', textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{t.label}</div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: t.color }}>{formatCurrency(t.value)}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabla */}
            <div className="card">
                <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
                    {isLoading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando libro IVA...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                            Sin comprobantes para {formatearPeriodo(selectedPeriodo)}
                        </div>
                    ) : (
                        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', minWidth: '1100px' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                    {COLS_VENTAS.map(col => (
                                        <th key={col.key} style={{
                                            padding: '10px 12px', textAlign: col.right ? 'right' : 'left',
                                            fontWeight: '600', color: 'var(--text-muted)', fontSize: '11px',
                                            textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap'
                                        }}>
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(c => (
                                    <tr key={c.id} style={{
                                        borderBottom: '1px solid var(--border-color)',
                                        opacity: c.anulado ? 0.4 : 1,
                                        background: c.anulado ? 'rgba(239,68,68,0.05)' : 'transparent',
                                        transition: 'background 0.1s'
                                    }}>
                                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                                            {c.fecha_emision}
                                            {c.anulado && <span style={{ fontSize: '10px', color: '#ef4444', marginLeft: '4px' }}>ANU</span>}
                                        </td>
                                        <td style={{ padding: '9px 12px' }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700',
                                                background: c.discrimina_iva ? 'rgba(239,68,68,0.12)' : 'rgba(96,165,250,0.12)',
                                                color: c.discrimina_iva ? '#ef4444' : '#60a5fa'
                                            }}>
                                                {c.tipo_comprobante_codigo}
                                            </span>
                                        </td>
                                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: '11px' }}>
                                            {String(c.punto_venta || 1).padStart(5, '0')}-{String(c.numero || 0).padStart(8, '0')}
                                        </td>
                                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: '11px' }}>{c.cuit_receptor || '—'}</td>
                                        <td style={{ padding: '9px 12px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {c.razon_social_receptor || c.receptor_nombre || '—'}
                                        </td>
                                        <td style={{ padding: '9px 12px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>
                                                {c.condicion_iva_receptor || '—'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(c.neto_gravado_21)}</td>
                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(c.neto_gravado_105)}</td>
                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(c.neto_no_gravado)}</td>
                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(c.neto_exento)}</td>
                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#f87171' }}>{formatCurrency(c.iva_21)}</td>
                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#fb923c' }}>{formatCurrency(c.iva_105)}</td>
                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(c.total_comprobante)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {/* Fila de totales */}
                            <tfoot>
                                <tr style={{ background: 'var(--bg-tertiary)', borderTop: '2px solid var(--border-color)', fontWeight: '700' }}>
                                    <td colSpan={6} style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        TOTALES — {noAnulados.length} comprobante{noAnulados.length !== 1 ? 's' : ''}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(totales.neto_gravado_21)}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(totales.neto_gravado_105)}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(totales.neto_no_gravado)}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(totales.neto_exento)}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#f87171' }}>{formatCurrency(totales.iva_21)}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#fb923c' }}>{formatCurrency(totales.iva_105)}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{formatCurrency(totales.total_comprobante)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
