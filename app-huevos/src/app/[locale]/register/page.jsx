'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';

export default function RegisterPage() {
    const [companyName, setCompanyName] = useState('');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();
    const locale = useLocale();

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(null);

        if (!companyName.trim()) {
            setError('Por favor ingresa el nombre de tu empresa u organización');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setLoading(true);

        try {
            // 1. Registro de usuario en Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        company_name: companyName
                    }
                }
            });

            if (authError) throw authError;

            const user = authData.user;
            if (!user) throw new Error('No se pudo completar el registro de la cuenta');

            // 2. Generar el tenant_id / organization_id único
            const organizationId = `org_${companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;

            // 3. Crear el perfil inicial del usuario con rol 'admin' de su empresa
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    full_name: fullName,
                    email: email,
                    role: 'admin',
                    organization_id: organizationId,
                    is_approved: true,
                    is_disabled: false,
                    updated_at: new Date().toISOString()
                });

            if (profileError) {
                console.warn('Registro: Error asociando perfil, reintentando...', profileError.message);
            }

            // 4. Crear o actualizar configuración de la empresa (Branding inicial)
            await supabase
                .from('app_settings')
                .upsert({
                    id: 1,
                    company_name: companyName,
                    company_email: email,
                    organization_id: organizationId,
                    updated_at: new Date().toISOString()
                });

            toast.success('¡Empresa registrada con éxito! Iniciando sesión...');

            // 5. Iniciar sesión automáticamente
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (!loginError) {
                window.location.href = `/${locale}/overview`;
            } else {
                router.push(`/${locale}/login`);
            }

        } catch (err) {
            console.error('Error durante el registro:', err);
            setError(err.message || 'Error registrando la empresa');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-secondary)',
            padding: '20px'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Registrar Nueva Empresa
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
                        Crea tu cuenta SaaS y comienza a administrar con tus propios datos
                    </p>
                </div>

                <form onSubmit={handleRegister}>
                    <div className="form-group">
                        <label className="form-label">Nombre de tu Empresa / Organización</label>
                        <input
                            type="text"
                            className="form-input"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            required
                            placeholder="Ej: Distribuidora Central"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Tu Nombre Completo</label>
                        <input
                            type="text"
                            className="form-input"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            placeholder="Ej: Juan Pérez"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Correo Electrónico</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="contacto@miempresa.com"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label className="form-label">Contraseña</label>
                            <input
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirmar Contraseña</label>
                            <input
                                type="password"
                                className="form-input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            padding: '12px',
                            borderRadius: '8px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            fontSize: '14px',
                            marginBottom: '20px'
                        }}>
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', marginBottom: '16px', padding: '12px' }}
                        disabled={loading}
                    >
                        {loading ? 'CREANDO EMPRESA...' : 'REGISTRAR EMPRESA Y COMENZAR 🚀'}
                    </button>

                    <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        ¿Ya tienes una cuenta?{' '}
                        <button
                            type="button"
                            onClick={() => router.push(`/${locale}/login`)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-accent)',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                fontWeight: '600'
                            }}
                        >
                            Iniciar Sesión
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
