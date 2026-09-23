'use client';

import { useState, useEffect } from 'react';
import {
    getEmpresaConfig, upsertEmpresaConfig,
    getCondicionesFiscales, getAlicuotasIva, getProducts, updateProduct,
    getRegimenesRetencion, createRegimenRetencion, updateRegimenRetencion, deleteRegimenRetencion,
    getIibbJurisdicciones,
} from '@/lib/api';
import { validarCuit, formatearCuit } from '@/lib/fiscal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { PageGuard } from '@/components/auth/RoleGuard';
import { toast } from 'sonner';

const TAB_STYLE = (active) => ({
    padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500',
    background: active ? 'var(--accent-primary)' : 'transparent',
    color: active ? 'white' : 'var(--text-secondary)',
    transition: 'all 0.15s',
});

const EMPTY_REGIMEN = {
    nombre: '', organismo: 'ARCA', tipo: 'retencion',
    impuesto: 'IVA', alicuota_porcentaje: '', monto_minimo: '',
    base_calculo: 'neto', norma_legal: '',
};

export default function ConfigFiscalPage() {
    const [tab, setTab] = useState('empresa');
    const [condiciones, setCondiciones] = useState([]);
    const [alicuotas, setAlicuotas] = useState([]);
    const [products, setProducts] = useState([]);
    const [regimenes, setRegimenes] = useState([]);
    const [jurisdicciones, setJurisdicciones] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [msg, setMsg] = useState({ text: '', type: '' });

    // Empresa config
    const [empresaForm, setEmpresaForm] = useState({
        razon_social: '', cuit: '', condicion_iva_id: '',
        domicilio_fiscal: '', localidad: '', provincia: '', codigo_postal: '',
        punto_venta_default: 1, es_agente_percepcion_iva: false, es_agente_retencion_iva: false,
        es_agente_percepcion_iibb: false,
    });

    // Regímenes
    const [regimenForm, setRegimenForm] = useState({ ...EMPTY_REGIMEN });
    const [editRegimenId, setEditRegimenId] = useState(null);
    const [deleteRegimenId, setDeleteRegimenId] = useState(null);
    const [isSavingRegimen, setIsSavingRegimen] = useState(false);

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setIsLoading(true);
        try {
            const [cond, alic, prods, reg, juris, emp] = await Promise.all([
                getCondicionesFiscales(), getAlicuotasIva(), getProducts(),
                getRegimenesRetencion(), getIibbJurisdicciones(), getEmpresaConfig(),
            ]);
            setCondiciones(cond); setAlicuotas(alic); setProducts(prods);
            setRegimenes(reg); setJurisdicciones(juris);
            if (emp) {
                setEmpresaForm({
                    razon_social: emp.razon_social || '',
                    cuit: emp.cuit || '',
                    condicion_iva_id: emp.condicion_iva_id || '',
                    domicilio_fiscal: emp.domicilio_fiscal || '',
                    localidad: emp.localidad || '',
                    provincia: emp.provincia || '',
                    codigo_postal: emp.codigo_postal || '',
                    punto_venta_default: emp.punto_venta_default || 1,
                    es_agente_percepcion_iva: emp.es_agente_percepcion_iva || false,
                    es_agente_retencion_iva: emp.es_agente_retencion_iva || false,
                    es_agente_percepcion_iibb: emp.es_agente_percepcion_iibb || false,
                });
            }
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const showMsg = (text, type = 'success') => {
        setMsg({ text, type });
        setTimeout(() => setMsg({ text: '', type: '' }), 3000);
    };

    const handleSaveEmpresa = async () => {
        if (!empresaForm.razon_social.trim()) return toast.warning('Ingrese la razón social');
        if (empresaForm.cuit && !validarCuit(empresaForm.cuit)) return toast.warning('El CUIT ingresado no es válido');
        setIsSaving(true);
        try {
            await upsertEmpresaConfig({
                ...empresaForm,
                cuit: empresaForm.cuit ? formatearCuit(empresaForm.cuit) : null,
                condicion_iva_id: empresaForm.condicion_iva_id ? parseInt(empresaForm.condicion_iva_id) : null,
            });
            showMsg('✅ Configuración guardada correctamente');
        } catch (e) { showMsg('❌ Error: ' + e.message, 'error'); }
        finally { setIsSaving(false); }
    };

    const handleSaveProductAlicuota = async (productId, alicuotaIvaId, tipoGravamen) => {
        try {
            await updateProduct(productId, {
                alicuota_iva_id: alicuotaIvaId ? parseInt(alicuotaIvaId) : null,
                tipo_gravamen: tipoGravamen,
            });
            setProducts(prev => prev.map(p => p.id === productId
                ? { ...p, alicuota_iva_id: alicuotaIvaId ? parseInt(alicuotaIvaId) : null, tipo_gravamen: tipoGravamen }
                : p
            ));
            showMsg('✅ Producto actualizado');
        } catch (e) { showMsg('❌ Error: ' + e.message, 'error'); }
    };

    const handleSaveRegimen = async () => {
        if (!regimenForm.nombre.trim()) return toast.warning('Ingrese el nombre del régimen');
        setIsSavingRegimen(true);
        try {
            if (editRegimenId) {
                await updateRegimenRetencion(editRegimenId, { ...regimenForm, alicuota_porcentaje: parseFloat(regimenForm.alicuota_porcentaje), monto_minimo: parseFloat(regimenForm.monto_minimo || 0) });
            } else {
                await createRegimenRetencion({ ...regimenForm, alicuota_porcentaje: parseFloat(regimenForm.alicuota_porcentaje), monto_minimo: parseFloat(regimenForm.monto_minimo || 0), activo: true });
            }
            setRegimenForm({ ...EMPTY_REGIMEN }); setEditRegimenId(null);
            const updated = await getRegimenesRetencion();
            setRegimenes(updated);
            showMsg('✅ Régimen guardado');
        } catch (e) { showMsg('❌ Error: ' + e.message, 'error'); }
        finally { setIsSavingRegimen(false); }
    };

    const handleDeleteRegimen = async () => {
        if (!deleteRegimenId) return;
        await deleteRegimenRetencion(deleteRegimenId);
        setDeleteRegimenId(null);
        const updated = await getRegimenesRetencion();
        setRegimenes(updated);
    };

    if (isLoading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando configuración...</div>;

    return (
        <PageGuard permission="fiscal.manage">
            <div>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '700' }}>⚙️ Configuración Fiscal</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Datos del emisor, IVA por producto y regímenes de retención</p>
            </div>

            {msg.text && (
                <div style={{
                    padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px',
                    background: msg.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                    border: `1px solid ${msg.type === 'error' ? '#ef4444' : '#22c55e'}`,
                    color: msg.type === 'error' ? '#ef4444' : '#22c55e',
                }}>
                    {msg.text}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '24px', width: 'fit-content' }}>
                {[
                    { key: 'empresa', label: '🏢 Empresa' },
                    { key: 'productos', label: '📦 IVA x Producto' },
                    { key: 'regimenes', label: '✂️ Regímenes' },
                    { key: 'iibb', label: '🗺️ IIBB' },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={TAB_STYLE(tab === t.key)}>{t.label}</button>
                ))}
            </div>

            {/* Tab: Empresa */}
            {tab === 'empresa' && (
                <div className="card" style={{ maxWidth: '700px' }}>
                    <div className="card-header"><h3 className="card-title">🏢 Datos del Emisor</h3></div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label className="form-label">Razón Social *</label>
                                <input className="form-input" value={empresaForm.razon_social}
                                    onChange={e => setEmpresaForm(p => ({ ...p, razon_social: e.target.value }))} placeholder="Tu Empresa S.R.L." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">CUIT</label>
                                <input className="form-input" value={empresaForm.cuit} placeholder="20-12345678-9"
                                    onChange={e => setEmpresaForm(p => ({ ...p, cuit: e.target.value }))}
                                    style={{ borderColor: empresaForm.cuit && !validarCuit(empresaForm.cuit) ? '#ef4444' : undefined }} />
                                {empresaForm.cuit && !validarCuit(empresaForm.cuit) && <small style={{ color: '#ef4444', fontSize: '11px' }}>CUIT inválido</small>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Condición IVA</label>
                                <select className="form-select" value={empresaForm.condicion_iva_id}
                                    onChange={e => setEmpresaForm(p => ({ ...p, condicion_iva_id: e.target.value }))}>
                                    <option value="">Seleccionar...</option>
                                    {condiciones.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.descripcion}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label className="form-label">Domicilio Fiscal</label>
                                <input className="form-input" value={empresaForm.domicilio_fiscal}
                                    onChange={e => setEmpresaForm(p => ({ ...p, domicilio_fiscal: e.target.value }))} placeholder="Calle 123, Piso 2" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Localidad</label>
                                <input className="form-input" value={empresaForm.localidad}
                                    onChange={e => setEmpresaForm(p => ({ ...p, localidad: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Provincia</label>
                                <input className="form-input" value={empresaForm.provincia}
                                    onChange={e => setEmpresaForm(p => ({ ...p, provincia: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Código Postal</label>
                                <input className="form-input" value={empresaForm.codigo_postal}
                                    onChange={e => setEmpresaForm(p => ({ ...p, codigo_postal: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Punto de Venta Default</label>
                                <input type="number" className="form-input" min="1" max="99998" value={empresaForm.punto_venta_default}
                                    onChange={e => setEmpresaForm(p => ({ ...p, punto_venta_default: parseInt(e.target.value) }))} />
                            </div>
                        </div>
                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>Agente de Retención / Percepción</label>
                            {[
                                { key: 'es_agente_percepcion_iva', label: '¿Es Agente de Percepción de IVA?' },
                                { key: 'es_agente_retencion_iva', label: '¿Es Agente de Retención de IVA?' },
                                { key: 'es_agente_percepcion_iibb', label: '¿Es Agente de Percepción de IIBB?' },
                            ].map(opt => (
                                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                                    <input type="checkbox" checked={empresaForm[opt.key]}
                                        onChange={e => setEmpresaForm(p => ({ ...p, [opt.key]: e.target.checked }))}
                                        style={{ width: '16px', height: '16px' }} />
                                    {opt.label}
                                </label>
                            ))}
                        </div>
                        <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={handleSaveEmpresa} disabled={isSaving}>
                            {isSaving ? 'Guardando...' : '💾 Guardar Configuración'}
                        </button>
                    </div>
                </div>
            )}

            {/* Tab: Productos */}
            {tab === 'productos' && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">📦 Alícuota IVA por Producto</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>Asigná la alícuota de IVA correcta a cada producto</p>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                    {['Producto', 'Precio Base', 'Alícuota IVA', 'Tipo Gravamen'].map(h => (
                                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(prod => (
                                    <tr key={prod.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '10px 16px', fontWeight: '500' }}>{prod.description}</td>
                                        <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>
                                            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(prod.base_price || 0)}
                                        </td>
                                        <td style={{ padding: '8px 16px' }}>
                                            <select className="form-select" style={{ padding: '5px 10px' }}
                                                value={prod.alicuota_iva_id || ''}
                                                onChange={e => handleSaveProductAlicuota(prod.id, e.target.value, prod.tipo_gravamen || 'gravado')}>
                                                <option value="">Sin asignar ⚠️</option>
                                                {alicuotas.map(a => <option key={a.id} value={a.id}>{a.descripcion} ({a.porcentaje}%)</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: '8px 16px' }}>
                                            <select className="form-select" style={{ padding: '5px 10px' }}
                                                value={prod.tipo_gravamen || 'gravado'}
                                                onChange={e => handleSaveProductAlicuota(prod.id, prod.alicuota_iva_id, e.target.value)}>
                                                <option value="gravado">Gravado</option>
                                                <option value="exento">Exento</option>
                                                <option value="no_gravado">No Gravado</option>
                                                <option value="iva_cero">IVA 0%</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {products.filter(p => !p.alicuota_iva_id).length > 0 && (
                            <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.08)', borderTop: '1px solid #f59e0b', color: '#f59e0b', fontSize: '13px' }}>
                                ⚠️ {products.filter(p => !p.alicuota_iva_id).length} producto(s) sin alícuota IVA asignada
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab: Regímenes */}
            {tab === 'regimenes' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Formulario */}
                    <div className="card">
                        <div className="card-header"><h3 className="card-title">{editRegimenId ? 'Editar Régimen' : '+ Nuevo Régimen'}</h3></div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">Nombre *</label>
                                <input className="form-input" value={regimenForm.nombre} placeholder="Ej: Retención IVA RG 2854"
                                    onChange={e => setRegimenForm(p => ({ ...p, nombre: e.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">Tipo</label>
                                    <select className="form-select" value={regimenForm.tipo} onChange={e => setRegimenForm(p => ({ ...p, tipo: e.target.value }))}>
                                        <option value="retencion">Retención</option>
                                        <option value="percepcion">Percepción</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Impuesto</label>
                                    <select className="form-select" value={regimenForm.impuesto} onChange={e => setRegimenForm(p => ({ ...p, impuesto: e.target.value }))}>
                                        {['IVA', 'Ganancias', 'IIBB', 'SIRCREB', 'SIRTAC', 'SIRCUPA', 'Otro'].map(i => <option key={i}>{i}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Organismo</label>
                                    <input className="form-input" value={regimenForm.organismo} onChange={e => setRegimenForm(p => ({ ...p, organismo: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Alícuota (%)</label>
                                    <input type="number" className="form-input" min="0" step="0.0001" value={regimenForm.alicuota_porcentaje}
                                        onChange={e => setRegimenForm(p => ({ ...p, alicuota_porcentaje: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Monto Mínimo $</label>
                                    <input type="number" className="form-input" min="0" step="0.01" value={regimenForm.monto_minimo}
                                        onChange={e => setRegimenForm(p => ({ ...p, monto_minimo: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Base de Cálculo</label>
                                    <select className="form-select" value={regimenForm.base_calculo} onChange={e => setRegimenForm(p => ({ ...p, base_calculo: e.target.value }))}>
                                        <option value="neto">Neto</option>
                                        <option value="bruto">Bruto (con IVA)</option>
                                        <option value="iva">Solo IVA</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Norma Legal</label>
                                <input className="form-input" value={regimenForm.norma_legal} placeholder="Ej: RG 2854"
                                    onChange={e => setRegimenForm(p => ({ ...p, norma_legal: e.target.value }))} />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {editRegimenId && (
                                    <button className="btn btn-secondary" onClick={() => { setEditRegimenId(null); setRegimenForm({ ...EMPTY_REGIMEN }); }}>Cancelar</button>
                                )}
                                <button className="btn btn-primary" onClick={handleSaveRegimen} disabled={isSavingRegimen}>
                                    {isSavingRegimen ? '...' : editRegimenId ? 'Actualizar' : '+ Crear Régimen'}
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Lista */}
                    <div className="card">
                        <div className="card-header"><h3 className="card-title">Regímenes Activos</h3></div>
                        <div className="card-body" style={{ padding: 0 }}>
                            {regimenes.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Sin regímenes configurados</div>
                            ) : regimenes.map(r => (
                                <div key={r.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{r.nombre}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {r.tipo} — {r.impuesto} — {r.alicuota_porcentaje}% — {r.organismo}
                                            {r.norma_legal && <span style={{ marginLeft: '6px' }}>({r.norma_legal})</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}
                                            onClick={() => { setEditRegimenId(r.id); setRegimenForm({ nombre: r.nombre, organismo: r.organismo, tipo: r.tipo, impuesto: r.impuesto, alicuota_porcentaje: r.alicuota_porcentaje, monto_minimo: r.monto_minimo, base_calculo: r.base_calculo, norma_legal: r.norma_legal || '' }); }}>✎</button>
                                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--accent-danger)', borderColor: 'var(--accent-danger)' }}
                                            onClick={() => setDeleteRegimenId(r.id)}>🗑</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: IIBB */}
            {tab === 'iibb' && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">🗺️ Jurisdicciones IIBB</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>Alícuotas por provincia — Editable desde la BD en Supabase</p>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                    {['Código', 'Provincia', 'Agencia', 'Al. General', 'Al. Percepción', 'Al. Retención'].map(h => (
                                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {jurisdicciones.map(j => (
                                    <tr key={j.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: '700', color: 'var(--accent-primary)' }}>{j.codigo}</td>
                                        <td style={{ padding: '10px 16px', fontWeight: '500' }}>{j.nombre}</td>
                                        <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{j.agencia}</td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>{j.alicuota_general}%</td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>{j.alicuota_percepcion}%</td>
                                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>{j.alicuota_retencion}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <ConfirmModal isOpen={!!deleteRegimenId} onClose={() => setDeleteRegimenId(null)} onConfirm={handleDeleteRegimen}
                title="¿Desactivar régimen?" message="El régimen quedará inactivo pero no se eliminará de la base de datos." />
        </div>
        </PageGuard>
    );
}
