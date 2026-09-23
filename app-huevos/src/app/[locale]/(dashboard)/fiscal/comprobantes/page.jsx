'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
    getComprobantes, createComprobante, anularComprobante,
    getClients, getProviders, getProducts, getAlicuotasIva,
    getTiposComprobante, getCondicionesFiscales, getEmpresaConfig,
    getRegimenesRetencion,
} from '@/lib/api';
import {
    determinarTipoComprobante, calcularTotalesComprobante,
    calcularIva, validarCuit, formatearCuit, fechaAPeriodo,
    getUltimosPeriodos, formatearPeriodo,
} from '@/lib/fiscal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';

const formatCurrency = (v) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(v || 0);
const formatDateLocal = () => new Date().toISOString().split('T')[0];

const ESTADO_BADGE = {
    borrador: { label: 'Borrador', bg: 'rgba(107,114,128,0.15)', color: '#6b7280' },
    emitido: { label: 'Emitido', bg: 'rgba(96,165,250,0.15)', color: '#60a5fa' },
    autorizado: { label: 'Autorizado', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    pendiente_envio: { label: 'Pendiente', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    error_arca: { label: 'Error ARCA', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    anulado: { label: 'Anulado', bg: 'rgba(239,68,68,0.08)', color: '#ef4444' },
};

const EMPTY_ITEM = { producto_id: '', descripcion: '', cantidad: 1, precio_unitario_neto: '', alicuota_iva_id: '', tipo_gravamen: 'gravado' };
const EMPTY_FORM = {
    flujo: 'venta',
    tipo_comprobante_id: '',
    punto_venta: 1,
    fecha_emision: formatDateLocal(),
    cliente_id: '',
    proveedor_id: '',
    cuit_receptor: '',
    razon_social_receptor: '',
    condicion_iva_receptor: 'CF',
    comprobante_original_id: '',
};

export default function ComprobantesPage() {
    const { profile } = useAuth();
    const periodos = getUltimosPeriodos(24);

    // Filters
    const [flujoFiltro, setFlujoFiltro] = useState('venta');
    const [periodoFiltro, setPeriodoFiltro] = useState(periodos[0]?.valor || '');

    // Data
    const [comprobantes, setComprobantes] = useState([]);
    const [clients, setClients] = useState([]);
    const [providers, setProviders] = useState([]);
    const [products, setProducts] = useState([]);
    const [alicuotas, setAlicuotas] = useState([]);
    const [tiposComp, setTiposComp] = useState([]);
    const [condiciones, setCondiciones] = useState([]);
    const [regimenes, setRegimenes] = useState([]);
    const [empresaConfig, setEmpresaConfig] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [cartItems, setCartItems] = useState([{ ...EMPTY_ITEM }]);
    const [retenciones, setRetenciones] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [toAnular, setToAnular] = useState(null);

    useEffect(() => { loadAll(); }, []);
    useEffect(() => { loadComprobantes(); }, [flujoFiltro, periodoFiltro]);

    const loadAll = async () => {
        try {
            const [cl, pr, pr2, al, tc, cond, reg, emp] = await Promise.all([
                getClients(), getProviders(), getProducts(), getAlicuotasIva(),
                getTiposComprobante(), getCondicionesFiscales(), getRegimenesRetencion(), getEmpresaConfig(),
            ]);
            setClients(cl); setProviders(pr); setProducts(pr2); setAlicuotas(al);
            setTiposComp(tc); setCondiciones(cond); setRegimenes(reg); setEmpresaConfig(emp);
        } catch (e) { console.error(e); }
    };

    const loadComprobantes = async () => {
        setIsLoading(true);
        try {
            const data = await getComprobantes({ flujo: flujoFiltro, periodo: periodoFiltro });
            setComprobantes(data);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    // Auto-determinar tipo de comprobante según condiciones
    const autoTipoComprobante = useCallback(() => {
        const condEmisor = empresaConfig?.condicion_fiscal?.codigo || 'RI';
        const condReceptor = formData.condicion_iva_receptor || 'CF';
        const codigo = determinarTipoComprobante(condEmisor, condReceptor);
        const tc = tiposComp.find(t => t.codigo === codigo);
        if (tc && tc.id !== formData.tipo_comprobante_id) {
            setFormData(prev => ({ ...prev, tipo_comprobante_id: tc.id }));
        }
    }, [formData.condicion_iva_receptor, empresaConfig, tiposComp]);

    useEffect(() => {
        if (formData.flujo === 'venta' && formData.condicion_iva_receptor && tiposComp.length) {
            autoTipoComprobante();
        }
    }, [formData.condicion_iva_receptor, formData.flujo, tiposComp.length]);

    const tipoSeleccionado = tiposComp.find(t => t.id === parseInt(formData.tipo_comprobante_id));
    const discriminaIva = tipoSeleccionado?.discrimina_iva ?? true;

    // Calcular totales en tiempo real
    const itemsParaCalculo = cartItems.map(item => ({
        precioUnitarioNeto: parseFloat(item.precio_unitario_neto || 0),
        cantidad: parseFloat(item.cantidad || 1),
        alicuotaPorcentaje: parseFloat(alicuotas.find(a => a.id === parseInt(item.alicuota_iva_id))?.porcentaje || 0),
        tipoGravamen: item.tipo_gravamen || 'gravado',
    }));
    const totales = calcularTotalesComprobante(itemsParaCalculo, discriminaIva);

    const handleItemChange = (idx, field, value) => {
        setCartItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const updated = { ...item, [field]: value };
            // Auto-copiar alícuota del producto
            if (field === 'producto_id' && value) {
                const prod = products.find(p => p.id === parseInt(value));
                if (prod) {
                    updated.descripcion = prod.description;
                    if (prod.alicuota_iva_id) updated.alicuota_iva_id = prod.alicuota_iva_id;
                    if (prod.tipo_gravamen) updated.tipo_gravamen = prod.tipo_gravamen;
                    if (prod.base_price) updated.precio_unitario_neto = prod.base_price;
                }
            }
            return updated;
        }));
    };

    const handleSave = async () => {
        if (!formData.tipo_comprobante_id) return toast.warning('Seleccione el tipo de comprobante');
        if (formData.flujo === 'venta' && !formData.cliente_id) return toast.warning('Seleccione un cliente');
        if (formData.flujo === 'compra' && !formData.proveedor_id) return toast.warning('Seleccione un proveedor');
        const validItems = cartItems.filter(i => i.descripcion && parseFloat(i.cantidad || 0) > 0);
        if (!validItems.length) return toast.warning('Agregue al menos un ítem válido');

        setIsSaving(true);
        try {
            const periodo = fechaAPeriodo(formData.fecha_emision);
            const itemsPrep = validItems.map(item => {
                const alicuota = alicuotas.find(a => a.id === parseInt(item.alicuota_iva_id));
                const neto = parseFloat(item.precio_unitario_neto || 0) * parseFloat(item.cantidad || 1);
                const ivaImp = discriminaIva ? calcularIva(neto, alicuota?.porcentaje || 0) : 0;
                return {
                    producto_id: item.producto_id ? parseInt(item.producto_id) : null,
                    descripcion: item.descripcion,
                    cantidad: parseFloat(item.cantidad),
                    precio_unitario_neto: parseFloat(item.precio_unitario_neto),
                    alicuota_iva_id: item.alicuota_iva_id ? parseInt(item.alicuota_iva_id) : null,
                    iva_importe: ivaImp,
                    tipo_gravamen: item.tipo_gravamen,
                    total_item: neto + (discriminaIva ? ivaImp : 0),
                };
            });

            await createComprobante({
                flujo: formData.flujo,
                tipo_comprobante_id: parseInt(formData.tipo_comprobante_id),
                punto_venta: parseInt(formData.punto_venta || 1),
                fecha_emision: formData.fecha_emision,
                cliente_id: formData.flujo === 'venta' ? parseInt(formData.cliente_id) : null,
                proveedor_id: formData.flujo === 'compra' ? parseInt(formData.proveedor_id) : null,
                condicion_iva_receptor: formData.condicion_iva_receptor,
                cuit_receptor: formData.cuit_receptor,
                razon_social_receptor: formData.razon_social_receptor,
                ...totales,
                total_comprobante: totales.total_comprobante,
                estado: 'emitido',
                periodo_fiscal: periodo,
                comprobante_original_id: formData.comprobante_original_id || null,
            }, itemsPrep, retenciones, profile?.id);

            setShowModal(false);
            setFormData(EMPTY_FORM);
            setCartItems([{ ...EMPTY_ITEM }]);
            setRetenciones([]);
            await loadComprobantes();
        } catch (e) {
            toast.error('Error al guardar: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAnular = async () => {
        if (!toAnular) return;
        await anularComprobante(toAnular, profile?.id);
        setToAnular(null);
        await loadComprobantes();
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🗃️ Comprobantes Fiscales</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Facturas, notas de débito y crédito</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setFormData(EMPTY_FORM); setCartItems([{ ...EMPTY_ITEM }]); setRetenciones([]); setShowModal(true); }}>
                    + Nuevo Comprobante
                </button>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {['venta', 'compra'].map(f => (
                    <button key={f} onClick={() => setFlujoFiltro(f)} style={{
                        padding: '7px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', cursor: 'pointer',
                        background: flujoFiltro === f ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                        color: flujoFiltro === f ? 'white' : 'var(--text-secondary)', fontWeight: '500', fontSize: '14px'
                    }}>
                        {f === 'venta' ? '📤 Ventas' : '📥 Compras'}
                    </button>
                ))}
                <select className="form-select" value={periodoFiltro} onChange={e => setPeriodoFiltro(e.target.value)} style={{ minWidth: '160px' }}>
                    {periodos.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
                </select>
            </div>

            {/* Tabla */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {isLoading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
                    ) : comprobantes.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗃️</div>
                            Sin comprobantes en {formatearPeriodo(periodoFiltro)}
                            <br />
                            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowModal(true)}>
                                + Crear primer comprobante
                            </button>
                        </div>
                    ) : (
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                    {['#', 'Fecha', 'Tipo', 'PV-Número', 'Receptor', 'CUIT', 'Neto', 'IVA', 'Total', 'Estado', ''].map(h => (
                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {comprobantes.map(c => {
                                    const badge = ESTADO_BADGE[c.estado] || ESTADO_BADGE.emitido;
                                    const neto = parseFloat(c.neto_gravado_21 || 0) + parseFloat(c.neto_gravado_105 || 0) + parseFloat(c.neto_gravado_27 || 0);
                                    const iva = parseFloat(c.iva_21 || 0) + parseFloat(c.iva_105 || 0) + parseFloat(c.iva_27 || 0);
                                    return (
                                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: c.anulado ? 0.5 : 1 }}>
                                            <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{c.id}</td>
                                            <td style={{ padding: '10px 12px' }}>{c.fecha_emision}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700',
                                                    background: c.discrimina_iva ? 'rgba(239,68,68,0.12)' : 'rgba(96,165,250,0.12)',
                                                    color: c.discrimina_iva ? '#ef4444' : '#60a5fa'
                                                }}>
                                                    {c.tipo_comprobante_codigo}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px' }}>
                                                {String(c.punto_venta || 1).padStart(5, '0')}-{String(c.numero || 0).padStart(8, '0')}
                                            </td>
                                            <td style={{ padding: '10px 12px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {c.razon_social_receptor || c.receptor_nombre || '—'}
                                            </td>
                                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {c.cuit_receptor || '—'}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(neto)}</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#f87171' }}>{formatCurrency(iva)}</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(c.total_comprobante)}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: badge.bg, color: badge.color }}>
                                                    {badge.label}
                                                    {c.cae && <span style={{ marginLeft: '4px', opacity: 0.7 }}>•CAE</span>}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                {!c.anulado && (
                                                    <button
                                                        onClick={() => setToAnular(c.id)}
                                                        style={{ background: 'none', border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px' }}
                                                        title="Anular comprobante"
                                                    >
                                                        Anular
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal de nuevo comprobante */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Nuevo Comprobante Fiscal</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {/* Flujo */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                {['venta', 'compra'].map(f => (
                                    <button key={f} onClick={() => setFormData(prev => ({ ...prev, flujo: f }))} style={{
                                        flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', cursor: 'pointer',
                                        background: formData.flujo === f ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                        color: formData.flujo === f ? 'white' : 'var(--text-secondary)', fontWeight: '600'
                                    }}>
                                        {f === 'venta' ? '📤 Venta' : '📥 Compra'}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                                {/* Tipo comprobante */}
                                <div className="form-group">
                                    <label className="form-label">Tipo Comprobante *</label>
                                    <select className="form-select" value={formData.tipo_comprobante_id}
                                        onChange={e => setFormData(prev => ({ ...prev, tipo_comprobante_id: e.target.value }))}>
                                        <option value="">Seleccionar...</option>
                                        {tiposComp.filter(tc => formData.flujo === 'venta' ? tc.aplica_ri : true).map(tc => (
                                            <option key={tc.id} value={tc.id}>{tc.codigo} — {tc.descripcion}</option>
                                        ))}
                                    </select>
                                    {tipoSeleccionado && (
                                        <small style={{ color: tipoSeleccionado.discrimina_iva ? '#22c55e' : '#f59e0b', fontSize: '11px' }}>
                                            {tipoSeleccionado.discrimina_iva ? '✅ IVA discriminado' : '⚠️ IVA NO discriminado'}
                                        </small>
                                    )}
                                </div>
                                {/* Fecha */}
                                <div className="form-group">
                                    <label className="form-label">Fecha Emisión *</label>
                                    <input type="date" className="form-input" value={formData.fecha_emision}
                                        onChange={e => setFormData(prev => ({ ...prev, fecha_emision: e.target.value }))} />
                                </div>
                                {/* Punto de venta */}
                                <div className="form-group">
                                    <label className="form-label">Punto de Venta</label>
                                    <input type="number" className="form-input" value={formData.punto_venta} min="1" max="99998"
                                        onChange={e => setFormData(prev => ({ ...prev, punto_venta: e.target.value }))} />
                                </div>
                            </div>

                            {/* Receptor */}
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                                    {formData.flujo === 'venta' ? '👤 Datos del Cliente / Receptor' : '🏭 Datos del Proveedor / Emisor'}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                    {formData.flujo === 'venta' ? (
                                        <div className="form-group">
                                            <label className="form-label">Cliente *</label>
                                            <select className="form-select" value={formData.cliente_id}
                                                onChange={e => {
                                                    const cl = clients.find(c => c.id === parseInt(e.target.value));
                                                    setFormData(prev => ({
                                                        ...prev, cliente_id: e.target.value,
                                                        cuit_receptor: cl?.cuit_fiscal || cl?.cuit || '',
                                                        razon_social_receptor: cl?.razon_social || cl?.name || '',
                                                    }));
                                                }}>
                                                <option value="">Seleccionar cliente...</option>
                                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="form-group">
                                            <label className="form-label">Proveedor *</label>
                                            <select className="form-select" value={formData.proveedor_id}
                                                onChange={e => {
                                                    const pr = providers.find(p => p.id === parseInt(e.target.value));
                                                    setFormData(prev => ({
                                                        ...prev, proveedor_id: e.target.value,
                                                        cuit_receptor: pr?.cuit_fiscal || pr?.cuit || '',
                                                        razon_social_receptor: pr?.razon_social || pr?.name || '',
                                                    }));
                                                }}>
                                                <option value="">Seleccionar proveedor...</option>
                                                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label className="form-label">CUIT</label>
                                        <input type="text" className="form-input" placeholder="XX-XXXXXXXX-X"
                                            value={formData.cuit_receptor}
                                            onChange={e => setFormData(prev => ({ ...prev, cuit_receptor: e.target.value }))}
                                            style={{ borderColor: formData.cuit_receptor && !validarCuit(formData.cuit_receptor) ? '#ef4444' : undefined }}
                                        />
                                        {formData.cuit_receptor && !validarCuit(formData.cuit_receptor) && (
                                            <small style={{ color: '#ef4444', fontSize: '11px' }}>CUIT inválido</small>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Condición IVA Receptor</label>
                                        <select className="form-select" value={formData.condicion_iva_receptor}
                                            onChange={e => setFormData(prev => ({ ...prev, condicion_iva_receptor: e.target.value }))}>
                                            {condiciones.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.descripcion}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '8px', marginBottom: 0 }}>
                                    <label className="form-label">Razón Social</label>
                                    <input type="text" className="form-input" placeholder="Nombre o razón social del receptor"
                                        value={formData.razon_social_receptor}
                                        onChange={e => setFormData(prev => ({ ...prev, razon_social_receptor: e.target.value }))} />
                                </div>
                            </div>

                            {/* Ítems */}
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>📦 Ítems del Comprobante</span>
                                    <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 12px' }}
                                        onClick={() => setCartItems(prev => [...prev, { ...EMPTY_ITEM }])}>
                                        + Agregar ítem
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {cartItems.map((item, idx) => {
                                        const alicuotaItem = alicuotas.find(a => a.id === parseInt(item.alicuota_iva_id));
                                        const neto = parseFloat(item.precio_unitario_neto || 0) * parseFloat(item.cantidad || 1);
                                        const ivaCalc = discriminaIva ? calcularIva(neto, alicuotaItem?.porcentaje || 0) : 0;
                                        return (
                                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr auto', gap: '8px', alignItems: 'start', background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                                <div>
                                                    <select className="form-select" style={{ marginBottom: '4px' }} value={item.producto_id}
                                                        onChange={e => handleItemChange(idx, 'producto_id', e.target.value)}>
                                                        <option value="">Producto (opcional)</option>
                                                        {products.map(p => <option key={p.id} value={p.id}>{p.description}</option>)}
                                                    </select>
                                                    <input type="text" className="form-input" placeholder="Descripción *" value={item.descripcion}
                                                        onChange={e => handleItemChange(idx, 'descripcion', e.target.value)} />
                                                </div>
                                                <div>
                                                    <select className="form-select" style={{ marginBottom: '4px' }} value={item.alicuota_iva_id}
                                                        onChange={e => handleItemChange(idx, 'alicuota_iva_id', e.target.value)}>
                                                        <option value="">IVA...</option>
                                                        {alicuotas.map(a => <option key={a.id} value={a.id}>{a.descripcion}</option>)}
                                                    </select>
                                                    <select className="form-select" value={item.tipo_gravamen}
                                                        onChange={e => handleItemChange(idx, 'tipo_gravamen', e.target.value)}>
                                                        <option value="gravado">Gravado</option>
                                                        <option value="exento">Exento</option>
                                                        <option value="no_gravado">No Gravado</option>
                                                        <option value="iva_cero">IVA 0%</option>
                                                    </select>
                                                </div>
                                                <input type="number" className="form-input" placeholder="Cant." min="0" step="0.001" value={item.cantidad}
                                                    onChange={e => handleItemChange(idx, 'cantidad', e.target.value)} />
                                                <input type="number" className="form-input" placeholder="P. Neto" min="0" step="0.01" value={item.precio_unitario_neto}
                                                    onChange={e => handleItemChange(idx, 'precio_unitario_neto', e.target.value)} />
                                                <div style={{ textAlign: 'right', paddingTop: '8px' }}>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>IVA</div>
                                                    <div style={{ fontSize: '13px', color: '#f87171', fontWeight: '600' }}>{formatCurrency(ivaCalc)}</div>
                                                </div>
                                                <div style={{ textAlign: 'right', paddingTop: '8px' }}>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total</div>
                                                    <div style={{ fontSize: '14px', fontWeight: '700' }}>{formatCurrency(neto + ivaCalc)}</div>
                                                </div>
                                                <button onClick={() => setCartItems(prev => prev.filter((_, i) => i !== idx))}
                                                    style={{ background: 'none', border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', marginTop: '8px' }}>
                                                    ✕
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Totales */}
                            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
                                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>📊 Desglose Fiscal</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                                    {totales.neto_gravado_27 > 0 && <TotalRow label="Neto Gravado 27%" value={totales.neto_gravado_27} />}
                                    {totales.neto_gravado_21 > 0 && <TotalRow label="Neto Gravado 21%" value={totales.neto_gravado_21} />}
                                    {totales.neto_gravado_105 > 0 && <TotalRow label="Neto Gravado 10.5%" value={totales.neto_gravado_105} />}
                                    {totales.neto_gravado_0 > 0 && <TotalRow label="Neto Gravado 0%" value={totales.neto_gravado_0} />}
                                    {totales.neto_no_gravado > 0 && <TotalRow label="No Gravado" value={totales.neto_no_gravado} />}
                                    {totales.neto_exento > 0 && <TotalRow label="Exento" value={totales.neto_exento} />}
                                    {totales.iva_27 > 0 && <TotalRow label="IVA 27%" value={totales.iva_27} color="#f87171" />}
                                    {totales.iva_21 > 0 && <TotalRow label="IVA 21%" value={totales.iva_21} color="#f87171" />}
                                    {totales.iva_105 > 0 && <TotalRow label="IVA 10.5%" value={totales.iva_105} color="#fb923c" />}
                                </div>
                                <div style={{ borderTop: '2px solid var(--border-color)', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: '700', fontSize: '16px' }}>TOTAL</span>
                                    <span style={{ fontWeight: '700', fontSize: '20px', color: 'var(--accent-primary)' }}>{formatCurrency(totales.total_comprobante)}</span>
                                </div>
                            </div>

                            {/* Botones */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? 'Guardando...' : '💾 Guardar Comprobante'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal isOpen={!!toAnular} onClose={() => setToAnular(null)} onConfirm={handleAnular}
                title="¿Anular comprobante?" message="Esta acción marcará el comprobante como anulado. No se puede deshacer." />
        </div>
    );
}

function TotalRow({ label, value, color }) {
    return (
        <>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ textAlign: 'right', fontFamily: 'monospace', color: color || 'var(--text-primary)', fontWeight: '500' }}>
                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(value)}
            </span>
        </>
    );
}
