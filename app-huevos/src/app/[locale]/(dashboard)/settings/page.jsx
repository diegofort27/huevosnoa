'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import {
    getArqueoCategories,
    createArqueoCategory,
    updateArqueoCategory,
    deleteArqueoCategory
} from '@/lib/api';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useAuth } from '@/components/providers/AuthProvider';
import { useBrand } from '@/components/providers/BrandProvider';
import { toast } from 'sonner';

export default function SettingsPage() {
    const t = useTranslations('nav');
    const tAuth = useTranslations('auth');
    const { profile } = useAuth();
    const { updateBrandState } = useBrand();
    const isAdmin = profile?.role === 'admin';

    const [user, setUser] = useState(null);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Arqueo categories
    const [categories, setCategories] = useState([]);
    const [catForm, setCatForm] = useState({ name: '', editId: null });
    const [catSaving, setCatSaving] = useState(false);
    const [catToDelete, setCatToDelete] = useState(null);

    // Company branding
    const [companyName, setCompanyName] = useState('');
    const [companyLogoUrl, setCompanyLogoUrl] = useState(null);
    const [companyCuit, setCompanyCuit] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [companyPhone, setCompanyPhone] = useState('');
    const [companyEmail, setCompanyEmail] = useState('');
    const [companyLogoFile, setCompanyLogoFile] = useState(null);
    const [companyLogoPreview, setCompanyLogoPreview] = useState(null);
    const [brandingSaving, setBrandingSaving] = useState(false);
    const [brandingMessage, setBrandingMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        fetchUserProfile();
        loadCategories();
        loadBrandingSettings();
    }, []);

    const fetchUserProfile = async () => {
        try {
            setLoading(true);
            const { data: { user: authUser } } = await supabase.auth.getUser();

            if (authUser) {
                setUser(authUser);
                setEmail(authUser.email);

                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', authUser.id)
                    .single();

                if (error && error.code !== 'PGRST116') throw error;
                if (profile) {
                    setFullName(profile.full_name || '');
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            setMessage({ text: 'Error al cargar el perfil', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!user) return;

        try {
            setSaving(true);
            setMessage({ text: '', type: '' });

            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    full_name: fullName,
                    email: email, // This is just for reference in the profiles table
                });

            if (error) throw error;

            setMessage({ text: 'Cambios guardados con éxito', type: 'success' });
        } catch (error) {
            console.error('Error saving profile:', error);
            setMessage({ text: `Error al guardar: ${error.message}`, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const loadCategories = async () => {
        try {
            const data = await getArqueoCategories();
            setCategories(data);
        } catch (e) {
            console.error('Error cargando categorías:', e);
        }
    };

    const loadBrandingSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('id', 1)
                .single();
            if (!error && data) {
                setCompanyName(data.company_name || '');
                setCompanyLogoUrl(data.company_logo_url || null);
                setCompanyCuit(data.company_cuit || '');
                setCompanyAddress(data.company_address || '');
                setCompanyPhone(data.company_phone || '');
                setCompanyEmail(data.company_email || '');
            }
        } catch (e) {
            console.error('Error cargando branding:', e);
        }
    };

    const handleLogoFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setCompanyLogoFile(file);
        setCompanyLogoPreview(URL.createObjectURL(file));
    };

    const handleSaveBranding = async () => {
        setBrandingSaving(true);
        setBrandingMessage({ text: '', type: '' });
        try {
            let logoUrl = companyLogoUrl;

            if (companyLogoFile) {
                const fileExt = companyLogoFile.name.split('.').pop();
                const fileName = `logo-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('company-logos')
                    .upload(fileName, companyLogoFile, { upsert: true });
                if (uploadError) throw uploadError;
                const { data: publicData } = supabase.storage
                    .from('company-logos')
                    .getPublicUrl(fileName);
                logoUrl = publicData.publicUrl;
            }

            const updateData = {
                company_name: companyName,
                company_logo_url: logoUrl,
                company_cuit: companyCuit,
                company_address: companyAddress,
                company_phone: companyPhone,
                company_email: companyEmail,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('app_settings')
                .upsert({ id: 1, ...updateData });

            if (error) throw error;

            setCompanyLogoUrl(logoUrl);
            setCompanyLogoFile(null);
            setCompanyLogoPreview(null);
            
            // Actualizar estado global reactivo de marca
            updateBrandState({
                companyName,
                companyLogoUrl: logoUrl,
                companyCuit,
                companyAddress,
                companyPhone,
                companyEmail
            });

            toast.success('Identidad de empresa guardada con éxito');
            setBrandingMessage({ text: '✓ Configuración guardada correctamente.', type: 'success' });
        } catch (e) {
            console.error('Error guardando branding:', e);
            toast.error(`Error guardando configuración: ${e.message}`);
            setBrandingMessage({ text: `Error: ${e.message}`, type: 'error' });
        } finally {
            setBrandingSaving(false);
        }
    };

    const handleSaveCat = async () => {
        if (!catForm.name.trim()) { toast.warning('Ingrese un nombre'); return; }
        setCatSaving(true);
        try {
            if (catForm.editId) {
                await updateArqueoCategory(catForm.editId, catForm.name.trim());
            } else {
                await createArqueoCategory(catForm.name.trim());
            }
            setCatForm({ name: '', editId: null });
            await loadCategories();
        } catch (e) {
            toast.error(e.message || 'Error guardando categoría');
        } finally {
            setCatSaving(false);
        }
    };

    const handleDeleteCat = (id, isDefault) => {
        if (isDefault) { toast.warning('No se puede eliminar una categoría por defecto'); return; }
        setCatToDelete(id);
    };

    const confirmDeleteCat = async () => {
        if (!catToDelete) return;
        try {
            await deleteArqueoCategory(catToDelete);
            await loadCategories();
            setCatToDelete(null);
        } catch (e) {
            toast.error(e.message || 'Error eliminando categoría');
        }
    };

    // Password change
    const [passwords, setPasswords] = useState({ new: '', confirm: '' });
    const [passSaving, setPassSaving] = useState(false);

    const handleUpdatePassword = async () => {
        if (!passwords.new || passwords.new.length < 6) {
            toast.warning('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        if (passwords.new !== passwords.confirm) {
            toast.warning('Las contraseñas no coinciden');
            return;
        }

        setPassSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: passwords.new });
            if (error) throw error;
            toast.success('Contraseña actualizada correctamente');
            setPasswords({ new: '', confirm: '' });
        } catch (e) {
            toast.error('Error al actualizar contraseña: ' + e.message);
        } finally {
            setPassSaving(false);
        }
    };

    if (loading) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando configuración...</div>;
    }

    return (
        <div>
            <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: '600' }}>{t('settings')}</h1>

            <div style={{ display: 'grid', gap: '20px', maxWidth: '600px' }}>

                {/* ── IDENTIDAD DE EMPRESA ── */}
                {isAdmin && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">🏢 Identidad de Empresa</h3>
                        </div>
                        <div className="card-body">
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                Personaliza el logo y el nombre que aparecen en la barra lateral.
                            </p>

                            {brandingMessage.text && (
                                <div style={{
                                    padding: '12px', borderRadius: '8px', marginBottom: '16px',
                                    background: brandingMessage.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                    color: brandingMessage.type === 'success' ? '#22c55e' : '#ef4444',
                                    border: `1px solid ${brandingMessage.type === 'success' ? '#22c55e' : '#ef4444'}`
                                }}>
                                    {brandingMessage.text}
                                </div>
                            )}

                            {/* Logo preview */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                                <div style={{
                                    width: '72px', height: '72px', borderRadius: '12px',
                                    background: 'var(--bg-tertiary)', border: '2px dashed var(--border-color)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden', flexShrink: 0
                                }}>
                                    {(companyLogoPreview || companyLogoUrl) ? (
                                        <img
                                            src={companyLogoPreview || companyLogoUrl}
                                            alt="Logo"
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        />
                                    ) : (
                                        <span style={{ fontSize: '32px' }}>🥚</span>
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="form-label">Logo de Empresa</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoFileChange}
                                        style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}
                                    />
                                    <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                        PNG, JPG o SVG. Máx 5MB. Recomendado: 128×128 px.
                                    </small>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Nombre de Empresa</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Nombre que aparece en el sidebar"
                                    maxLength={40}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">CUIT / Identificación Fiscal</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={companyCuit}
                                        onChange={(e) => setCompanyCuit(e.target.value)}
                                        placeholder="Ej: 30-12345678-9"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Teléfono de Contacto</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={companyPhone}
                                        onChange={(e) => setCompanyPhone(e.target.value)}
                                        placeholder="Ej: +54 9 11 1234-5678"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Dirección / Dom. Comercial</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={companyAddress}
                                    onChange={(e) => setCompanyAddress(e.target.value)}
                                    placeholder="Ej: Av. Principal 1234, CABA"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Email de la Empresa</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    value={companyEmail}
                                    onChange={(e) => setCompanyEmail(e.target.value)}
                                    placeholder="contacto@miempresa.com"
                                />
                            </div>

                            <button
                                className="btn btn-primary"
                                onClick={handleSaveBranding}
                                disabled={brandingSaving || !companyName.trim()}
                            >
                                {brandingSaving ? 'Guardando...' : 'Guardar Identidad'}
                            </button>
                        </div>
                    </div>
                )}

                {isAdmin && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Perfil de Usuario</h3>
                    </div>
                    <div className="card-body">
                        {message.text && (
                            <div style={{
                                padding: '12px',
                                borderRadius: '8px',
                                marginBottom: '20px',
                                background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                                color: message.type === 'success' ? '#166534' : '#991b1b',
                                border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                            }}>
                                {message.text}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Nombre</label>
                            <input
                                type="text"
                                className="form-input"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Tu nombre completo"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{tAuth('email')}</label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                readOnly
                                style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                El email no se puede cambiar desde aquí por razones de seguridad.
                            </small>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={handleSaveProfile}
                            disabled={saving}
                        >
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
                )}

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Seguridad</h3>
                    </div>
                    <div className="card-body">
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            Usa esta sección para cambiar tu contraseña de acceso. La nueva contraseña debe tener al menos 6 caracteres.
                        </p>
                        <div className="form-group">
                            <label className="form-label">Nueva Contraseña</label>
                            <input 
                                type="password" 
                                className="form-input" 
                                placeholder="Mínimo 6 caracteres" 
                                value={passwords.new}
                                onChange={e => setPasswords(p => ({...p, new: e.target.value}))}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirmar Nueva Contraseña</label>
                            <input 
                                type="password" 
                                className="form-input" 
                                placeholder="Repite la contraseña" 
                                value={passwords.confirm}
                                onChange={e => setPasswords(p => ({...p, confirm: e.target.value}))}
                            />
                        </div>
                        <button 
                            className="btn btn-primary" 
                            disabled={passSaving || !passwords.new}
                            onClick={handleUpdatePassword}
                        >
                            {passSaving ? 'Cambiando...' : 'Cambiar Contraseña'}
                        </button>
                    </div>
                </div>

                {isAdmin && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">🔑 Licencia del Sistema</h3>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Estado de Licencia:</span>
                                    <span style={{
                                        fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px',
                                        background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid #22c55e'
                                    }}>
                                        ● ACTIVA (SaaS Distribuido)
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Clave de Licencia:</span>
                                    <code style={{ fontSize: '12px', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>
                                        {process.env.NEXT_PUBLIC_LICENSE_KEY || 'LIC-DEMO-2026-KEY'}
                                    </code>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Base de Datos Conectada:</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        Supabase Propio del Cliente
                                    </span>
                                </div>
                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                                    <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                                        Módulos Habilitados por Licencia:
                                    </h4>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '11px', background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px' }}>✓ Módulos Base</span>
                                        <span style={{ fontSize: '11px', background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px' }}>✓ Inventario y Stock</span>
                                        <span style={{ fontSize: '11px', background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px' }}>✓ Métricas & Analytics</span>
                                        <span style={{ fontSize: '11px', background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px' }}>✓ Copias de Respaldo</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isAdmin && (
                    <>
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Información del Sistema</h3>
                    </div>
                    <div className="card-body">
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                            <div style={{ marginBottom: '8px' }}>
                                <strong>ID de Usuario:</strong> <code style={{ fontSize: '12px' }}>{user?.id}</code>
                            </div>
                            <div>
                                <strong>Versión:</strong> 0.1.0-robust
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Categorías de Arqueo</h3>
                    </div>
                    <div className="card-body">
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                            Definen dónde se registra el dinero: Efectivo, Banco, Dólares, etc.
                            Las categorías <strong>por defecto</strong> no se pueden eliminar.
                        </p>

                        {/* Lista de categorías */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                            {categories.map(cat => (
                                <div key={cat.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '10px 12px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-sm)',
                                    border: catForm.editId === cat.id ? '1px solid var(--accent-primary)' : '1px solid transparent'
                                }}>
                                    {catForm.editId === cat.id ? (
                                        <input
                                            className="form-input"
                                            style={{ flex: 1, margin: 0, padding: '4px 8px', height: 'auto' }}
                                            value={catForm.name}
                                            autoFocus
                                            onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))}
                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveCat(); if (e.key === 'Escape') setCatForm({ name: '', editId: null }); }}
                                        />
                                    ) : (
                                        <span style={{ flex: 1, fontSize: '14px' }}>{cat.name}</span>
                                    )}
                                    {cat.is_default && (
                                        <span style={{ fontSize: '10px', background: 'var(--accent-primary)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                                            DEFAULT
                                        </span>
                                    )}
                                    {catForm.editId === cat.id ? (
                                        <>
                                            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={handleSaveCat} disabled={catSaving}>
                                                {catSaving ? '...' : '✓'}
                                            </button>
                                            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setCatForm({ name: '', editId: null })}>
                                                ✕
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}
                                                onClick={() => setCatForm({ name: cat.name, editId: cat.id })}>
                                                ✎
                                            </button>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '4px 8px', fontSize: '12px', color: cat.is_default ? 'var(--text-muted)' : 'var(--accent-danger)', borderColor: cat.is_default ? 'transparent' : 'var(--accent-danger)' }}
                                                onClick={() => handleDeleteCat(cat.id, cat.is_default)}
                                                disabled={cat.is_default}
                                                title={cat.is_default ? 'No se puede eliminar' : 'Eliminar'}
                                            >
                                                🗑
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Agregar nueva categoría */}
                        {catForm.editId === null && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    style={{ flex: 1 }}
                                    placeholder="Nueva categoría (ej: Caja Chica)"
                                    value={catForm.name}
                                    onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveCat(); }}
                                />
                                <button className="btn btn-primary" onClick={handleSaveCat} disabled={catSaving || !catForm.name.trim()}>
                                    {catSaving ? '...' : '+ Agregar'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                </>
                )}

            </div>
            {/* Modal de Confirmación de Eliminación de Categoría */}
            <ConfirmModal
                isOpen={!!catToDelete}
                onClose={() => setCatToDelete(null)}
                onConfirm={confirmDeleteCat}
                title="¿SEGURO DESEAS ELIMINAR?"
                message="Esta acción no se puede deshacer si la categoría ya no es necesaria."
            />
        </div>
    );
}
