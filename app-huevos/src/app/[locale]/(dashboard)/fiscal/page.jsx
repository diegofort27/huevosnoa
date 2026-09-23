'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
    calcularLiquidacionIva,
    getPeriodosFiscales,
    cerrarPeriodoFiscal,
    getComprobantes,
} from '@/lib/api';
import { getUltimosPeriodos, formatearPeriodo } from '@/lib/fiscal';
import { PageGuard } from '@/components/auth/RoleGuard';
import { toast } from 'sonner';

const formatCurrency = (v) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(v || 0);

const CARD_STYLE = {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    padding: '20px',
};

export default function FiscalPage() {
    const { profile } = useAuth();
    const periodos = getUltimosPeriodos(24);
    const [selectedPeriodo, setSelectedPeriodo] = useState(periodos[0]?.valor || '');
    const [liquidacion, setLiquidacion] = useState(null);
    const [historial, setHistorial] = useState([]);
    const [comprobantesVenta, setComprobantesVenta] = useState([]);
    const [comprobantesCompra, setComprobantesCompra] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCerrando, setIsCerrando] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadDatos();
    }, [selectedPeriodo]);

    const loadDatos = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const anio = parseInt(selectedPeriodo.slice(0, 4));
            const mes = parseInt(selectedPeriodo.slice(4, 6));
            const [liq, hist, ventas, compras] = await Promise.all([
                calcularLiquidacionIva(anio, mes),
                getPeriodosFiscales(),
                getComprobantes({ flujo: 'venta', periodo: selectedPeriodo }),
                getComprobantes({ flujo: 'compra', periodo: selectedPeriodo }),
            ]);
            setLiquidacion(liq);
            setHistorial(hist);
            setComprobantesVenta(ventas);
            setComprobantesCompra(compras);
        } catch (e) {
            console.error(e);
            setError('Error al cargar datos fiscales.');
        } finally {
            setIsLoading(false);
        }
    };

    const saldoTecnico = parseFloat(liquidacion?.debito_fiscal || 0) - parseFloat(liquidacion?.credito_fiscal || 0);
    const ivaAPagar = saldoTecnico
        - parseFloat(liquidacion?.retenciones_sufridas || 0)
        - parseFloat(liquidacion?.percepciones_sufridas || 0);

    const periodoYaCerrado = historial.find(
        h => h.periodo === selectedPeriodo && h.cerrado
    );

    const getSemaforo = () => {
        if (periodoYaCerrado) return { color: '#6b7280', label: 'CERRADO', bg: 'rgba(107,114,128,0.12)' };
        if (ivaAPagar > 0) return { color: '#ef4444', label: 'A PAGAR', bg: 'rgba(239,68,68,0.1)' };
        if (ivaAPagar < 0) return { color: '#22c55e', label: 'A FAVOR', bg: 'rgba(34,197,94,0.1)' };
        return { color: '#f59e0b', label: 'SIN MOVIMIENTOS', bg: 'rgba(245,158,11,0.1)' };
    };

    const semaforo = getSemaforo();

    const handleCerrarPeriodo = async () => {
        if (!confirm(`¿Cerrar el período ${formatearPeriodo(selectedPeriodo)}? Esta acción es irreversible.`)) return;
        setIsCerrando(true);
        try {
            await cerrarPeriodoFiscal(
                parseInt(selectedPeriodo.slice(0, 4)),
                parseInt(selectedPeriodo.slice(4, 6)),
                { ...liquidacion, iva_a_pagar: ivaAPagar },
                profile?.id
            );
            await loadDatos();
        } catch (e) {
            toast.error('Error al cerrar el período: ' + e.message);
        } finally {
            setIsCerrando(false);
        }
    };

    return (
        <PageGuard permission="fiscal.view">
            <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🧾 Dashboard Fiscal</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '14px' }}>
                        Liquidación de IVA mensual — Responsable Inscripto
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        className="form-select"
                        style={{ minWidth: '180px' }}
                        value={selectedPeriodo}
                        onChange={e => setSelectedPeriodo(e.target.value)}
                    >
                        {periodos.map(p => (
                            <option key={p.valor} value={p.valor}>{p.label}</option>
                        ))}
                    </select>
                    {!periodoYaCerrado && !isLoading && (
                        <button
                            className="btn btn-primary"
                            onClick={handleCerrarPeriodo}
                            disabled={isCerrando}
                            style={{ background: 'var(--accent-danger)', borderColor: 'var(--accent-danger)' }}
                        >
                            {isCerrando ? 'Cerrando...' : '🔒 Cerrar Período'}
                        </button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Calculando liquidación...
                </div>
            ) : error ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--accent-danger)', marginBottom: '16px' }}>{error}</p>
                    <button className="btn btn-primary" onClick={loadDatos}>Reintentar</button>
                </div>
            ) : (
                <>
                    {/* Banner de estado */}
                    <div style={{
                        ...CARD_STYLE,
                        background: semaforo.bg,
                        border: `2px solid ${semaforo.color}`,
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                    }}>
                        <div style={{
                            width: '14px', height: '14px', borderRadius: '50%',
                            background: semaforo.color, flexShrink: 0,
                            boxShadow: `0 0 10px ${semaforo.color}`
                        }} />
                        <div>
                            <div style={{ fontWeight: '700', color: semaforo.color, fontSize: '16px' }}>
                                {formatearPeriodo(selectedPeriodo)} — {semaforo.label}
                                {periodoYaCerrado && <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: '400' }}>Cerrado el {periodoYaCerrado.fecha_cierre ? new Date(periodoYaCerrado.fecha_cierre).toLocaleDateString('es-AR') : ''}</span>}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                                {ivaAPagar > 0
                                    ? `Deuda con ARCA: ${formatCurrency(ivaAPagar)}`
                                    : ivaAPagar < 0
                                        ? `Saldo a favor: ${formatCurrency(Math.abs(ivaAPagar))}`
                                        : 'Sin movimientos en este período'}
                            </div>
                        </div>
                    </div>

                    {/* Tarjetas de liquidación */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                        <LiqCard
                            label="Débito Fiscal"
                            sublabel="IVA en ventas"
                            value={liquidacion?.debito_fiscal}
                            color="#ef4444"
                            icon="📤"
                        />
                        <LiqCard
                            label="Crédito Fiscal"
                            sublabel="IVA en compras (FA)"
                            value={liquidacion?.credito_fiscal}
                            color="#22c55e"
                            icon="📥"
                        />
                        <LiqCard
                            label="Retenciones Sufridas"
                            sublabel="SICORE / SIRE"
                            value={liquidacion?.retenciones_sufridas}
                            color="#a78bfa"
                            icon="✂️"
                        />
                        <LiqCard
                            label="Percepciones Sufridas"
                            sublabel="Cobradas por vendedores"
                            value={liquidacion?.percepciones_sufridas}
                            color="#fb923c"
                            icon="➕"
                        />
                    </div>

                    {/* Resumen de liquidación */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div style={CARD_STYLE}>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-secondary)' }}>
                                📊 Cálculo del Período
                            </h3>
                            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                                <tbody>
                                    <CalcRow label="Débito Fiscal" value={liquidacion?.debito_fiscal} />
                                    <CalcRow label="Crédito Fiscal" value={liquidacion?.credito_fiscal} sign="-" />
                                    <CalcRow label="Saldo Técnico" value={saldoTecnico} bold separator />
                                    <CalcRow label="Retenciones sufridas" value={liquidacion?.retenciones_sufridas} sign="-" />
                                    <CalcRow label="Percepciones sufridas" value={liquidacion?.percepciones_sufridas} sign="-" />
                                    <CalcRow
                                        label="IVA a pagar / a favor"
                                        value={ivaAPagar}
                                        bold separator
                                        highlight={ivaAPagar > 0 ? '#ef4444' : '#22c55e'}
                                    />
                                </tbody>
                            </table>
                        </div>

                        <div style={CARD_STYLE}>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-secondary)' }}>
                                📋 Movimientos del Período
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <MovRow icon="🛒" label="Facturas de Venta" count={comprobantesVenta.filter(c => !c.anulado).length} total={liquidacion?.total_ventas} />
                                <MovRow icon="🏭" label="Facturas de Compra (FA)" count={comprobantesCompra.filter(c => !c.anulado && c.discrimina_iva).length} total={liquidacion?.total_compras} />
                                <MovRow icon="🚫" label="Comprobantes Anulados" count={[...comprobantesVenta, ...comprobantesCompra].filter(c => c.anulado).length} />
                            </div>
                            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <a href={`../fiscal/libro-iva`} style={{ fontSize: '13px', color: 'var(--accent-primary)', textDecoration: 'none' }}>
                                    📚 Ver Libro IVA →
                                </a>
                                <a href={`../fiscal/comprobantes`} style={{ fontSize: '13px', color: 'var(--accent-primary)', textDecoration: 'none', marginLeft: '12px' }}>
                                    🗃️ Ver Comprobantes →
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Historial de períodos */}
                    {historial.length > 0 && (
                        <div style={CARD_STYLE}>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>📅 Historial de Períodos</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Período</th>
                                            <th style={{ textAlign: 'right', padding: '8px 12px' }}>Débito</th>
                                            <th style={{ textAlign: 'right', padding: '8px 12px' }}>Crédito</th>
                                            <th style={{ textAlign: 'right', padding: '8px 12px' }}>Saldo</th>
                                            <th style={{ textAlign: 'center', padding: '8px 12px' }}>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historial.map(h => (
                                            <tr key={h.id} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                                                onClick={() => setSelectedPeriodo(h.periodo)}>
                                                <td style={{ padding: '10px 12px', fontWeight: '500' }}>{formatearPeriodo(h.periodo)}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ef4444' }}>{formatCurrency(h.debito_fiscal)}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#22c55e' }}>{formatCurrency(h.credito_fiscal)}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: h.iva_a_pagar > 0 ? '#ef4444' : '#22c55e' }}>
                                                    {formatCurrency(h.iva_a_pagar)}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                    <span style={{
                                                        padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                                                        background: h.cerrado ? 'rgba(107,114,128,0.15)' : 'rgba(245,158,11,0.15)',
                                                        color: h.cerrado ? '#6b7280' : '#f59e0b'
                                                    }}>
                                                        {h.cerrado ? 'CERRADO' : 'ABIERTO'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
        </PageGuard>
    );
}

function LiqCard({ label, sublabel, value, color, icon }) {
    return (
        <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            borderLeft: `3px solid ${color}`,
        }}>
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>{icon}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                {label}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color }}>{formatCurrency(value)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{sublabel}</div>
        </div>
    );
}

function CalcRow({ label, value, sign = '', bold, separator, highlight }) {
    return (
        <tr style={{ borderTop: separator ? '1px solid var(--border-color)' : 'none' }}>
            <td style={{ padding: '6px 4px', color: 'var(--text-secondary)', fontWeight: bold ? '600' : '400' }}>
                {sign && <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>{sign}</span>}
                {label}
            </td>
            <td style={{
                padding: '6px 4px', textAlign: 'right',
                fontWeight: bold ? '700' : '500',
                color: highlight || (bold ? 'var(--text-primary)' : 'var(--text-secondary)')
            }}>
                {formatCurrency(value)}
            </td>
        </tr>
    );
}

function MovRow({ icon, label, count, total }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{icon}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{count} comprobante{count !== 1 ? 's' : ''}</span>
                {total !== undefined && <span style={{ fontSize: '13px', fontWeight: '600' }}>{formatCurrency(total)}</span>}
            </div>
        </div>
    );
}
