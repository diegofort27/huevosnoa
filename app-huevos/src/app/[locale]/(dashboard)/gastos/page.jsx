'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DataTable from '@/components/ui/DataTable';
import { getExpenses, createExpense, deleteExpense, getProfiles, getArqueoCategories, getProviders } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import { useSearch } from '@/components/providers/SearchProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { formatDateLocal } from '@/lib/utils';
import { toast } from 'sonner';


export default function GastosPage() {
    // const t = useTranslations('expenses'); // Fallback to common if not ready
    const { searchTerm } = useSearch();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [expenses, setExpenses] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [arqueoCategories, setArqueoCategories] = useState([]);
    const [providers, setProviders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState(null);


    // Auth context to default to current user
    const locale = useLocale();
    const { user, profile } = useAuth();

    const [formData, setFormData] = useState({
        type: 'expense', // 'expense' or 'provider'
        providerId: '',
        description: '',
        amount: '',
        date: formatDateLocal(),
        category: 'General',
        userId: '',
        currency: 'ARS',
        arqueoCategoryId: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'new') {
            setShowModal(true);
            const params = new URLSearchParams(searchParams.toString());
            params.delete('action');
            params.delete('t');
            const search = params.toString();
            const newUrl = `${window.location.pathname}${search ? '?' + search : ''}`;
            window.history.replaceState({}, '', newUrl);
        }
    }, [searchParams]);

    // Handle Escape key to close modals
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (showModal) setShowModal(false);
                if (expenseToDelete) setExpenseToDelete(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal, expenseToDelete]);

    const [isSaving, setIsSaving] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [expensesData, profilesData, categoriesData, providersData] = await Promise.all([
                getExpenses(),
                getProfiles(),
                getArqueoCategories(),
                getProviders()
            ]);
            setExpenses(expensesData);
            setProfiles(profilesData);
            setArqueoCategories(categoriesData);
            setProviders(providersData);
        } catch (error) {
            console.error('Error loading expenses:', error);
            toast.error('Error al cargar gastos');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.amount || !formData.userId) {
            toast.warning('Complete todos los campos obligatorios');
            return;
        }

        if (formData.type === 'expense' && !formData.description) {
            toast.warning('Ingrese una descripción para el gasto');
            return;
        }

        if (formData.type === 'provider' && !formData.providerId) {
            toast.warning('Seleccione un proveedor');
            return;
        }

        setIsSaving(true);
        try {
            const expenseData = {
                ...formData,
                amount: parseFloat(formData.amount),
                category: formData.type === 'provider' ? 'Pago a Proveedor' : formData.category,
                description: formData.type === 'provider' ? `Pago a proveedor` : formData.description,
                providerId: formData.type === 'provider' ? formData.providerId : null,
                editorId: profile?.id
            };

            await createExpense(expenseData);
            await loadData();
            setShowModal(false);
            setFormData({
                type: 'expense',
                providerId: '',
                description: '',
                amount: '',
                date: formatDateLocal(),
                category: 'General',
                userId: user?.id || '',
                currency: 'ARS',
                arqueoCategoryId: arqueoCategories.find(c => c.name === 'Efectivo')?.id || ''
            });
        } catch (error) {
            console.error('Error creating expense:', error);
            toast.error('Error al guardar gasto');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        setExpenseToDelete(id);
    };

    const confirmDelete = async () => {
        if (!expenseToDelete) return;
        try {
            await deleteExpense(expenseToDelete);
            setExpenseToDelete(null);
            await loadData();
        } catch (error) {
            console.error('Error deleting expense:', error);
            toast.error('Error eliminando gasto');
        }
    };

    const formatCurrency = (value, currency = 'ARS') => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0
        }).format(value);
    };

    const columns = [
        { key: 'date', label: 'Fecha' },
        { 
            key: 'description', 
            label: 'Detalle',
            render: (val, row) => row.providerName ? `Pago a: ${row.providerName}` : val 
        },
        { key: 'category', label: 'Categoría' },
        {
            key: 'arqueoCategoryName',
            label: 'Caja / Cuenta',
            render: (val) => <span className="badge badge-secondary" style={{ fontSize: '11px' }}>{val}</span>
        },
        {
            key: 'userName',
            label: 'Responsable',
            render: (val) => <span className="badge badge-info">{val}</span>
        },
        {
            key: 'amount',
            label: 'Monto',
            render: (val, row) => <span style={{ color: 'var(--accent-danger)', fontWeight: 'bold' }}>{formatCurrency(val, row.currency)}</span>
        },
        {
            key: 'actions',
            label: 'Acciones',
            render: (_, row) => (
                <button
                    onClick={() => handleDelete(row.id)}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--accent-danger)' }}
                >
                    🗑️
                </button>
            )
        }
    ];

    const expensesArs = expenses.filter(e => (!e.currency || e.currency === 'ARS') && !e.provider_id).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const paymentsArs = expenses.filter(e => (!e.currency || e.currency === 'ARS') && e.provider_id).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const totalArs = expensesArs + paymentsArs;
    const totalUsd = expenses.filter(e => e.currency === 'USD').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    // Initial load of userId
    useEffect(() => {
        if (user && !formData.userId) {
            setFormData(prev => ({ ...prev, userId: user.id }));
        }
    }, [user]);

    // Handle currency -> arqueo category auto-selection
    useEffect(() => {
        if (!showModal) return;
        
        if (formData.currency === 'USD') {
            const usdCat = arqueoCategories.find(c => c.name === 'Dólares');
            if (usdCat) setFormData(prev => ({ ...prev, arqueoCategoryId: usdCat.id }));
        } else if (formData.currency === 'ARS') {
            const arsCat = arqueoCategories.find(c => c.name === 'Efectivo');
            if (arsCat && (formData.arqueoCategoryId === '' || arqueoCategories.find(c => c.id === parseInt(formData.arqueoCategoryId))?.name === 'Dólares')) {
                setFormData(prev => ({ ...prev, arqueoCategoryId: arsCat.id }));
            }
        }
    }, [formData.currency, showModal, arqueoCategories]);

    if (isLoading) return <div style={{ padding: '20px' }}>Cargando egresos...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Egresos</h1>
                    <div style={{ display: 'flex', gap: '24px', marginTop: '4px' }}>
                        <div>
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Gastos Operativos: </span>
                            <span style={{ color: 'var(--accent-danger)', fontWeight: '700' }}>{formatCurrency(expensesArs, 'ARS')}</span>
                        </div>
                        <div>
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Pagos a Proveedores: </span>
                            <span style={{ color: 'var(--accent-warning)', fontWeight: '700' }}>{formatCurrency(paymentsArs, 'ARS')}</span>
                        </div>
                        <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Total Erogado: </span>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>{formatCurrency(totalArs, 'ARS')}</span>
                            {totalUsd > 0 && <span style={{ marginLeft: '8px', color: 'var(--accent-success)', fontWeight: '700' }}> / {formatCurrency(totalUsd, 'USD')}</span>}
                        </div>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    + Nuevo Egreso
                </button>
            </div>

            <div className="card">
                <div className="card-body">
                    <DataTable 
                        columns={columns} 
                        data={expenses.filter(expense => {
                            if (!searchTerm) return true;
                            const term = searchTerm.toLowerCase();
                            return (
                                expense.description?.toLowerCase().includes(term) ||
                                expense.category?.toLowerCase().includes(term) ||
                                expense.arqueoCategoryName?.toLowerCase().includes(term) ||
                                expense.userName?.toLowerCase().includes(term) ||
                                expense.providerName?.toLowerCase().includes(term)
                            );
                        })} 
                    />
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Registrar Egreso</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Tipo de Egreso</label>
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input 
                                            type="radio" 
                                            name="type" 
                                            value="expense" 
                                            checked={formData.type === 'expense'} 
                                            onChange={(e) => setFormData({...formData, type: e.target.value})}
                                            autoFocus
                                        />
                                        Gastos
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input 
                                            type="radio" 
                                            name="type" 
                                            value="provider" 
                                            checked={formData.type === 'provider'} 
                                            onChange={(e) => setFormData({...formData, type: e.target.value})}
                                        />
                                        Pago a Proveedor
                                    </label>
                                </div>
                            </div>

                            {formData.type === 'provider' ? (
                                <div className="form-group">
                                    <label className="form-label">Proveedor *</label>
                                    <select
                                        className="form-select"
                                        value={formData.providerId}
                                        onChange={e => setFormData({ ...formData, providerId: e.target.value })}
                                    >
                                        <option value="">Seleccionar proveedor...</option>
                                        {providers.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Descripción *</label>
                                        <input
                                            className="form-input"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Ej: Combustible, Comida..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Categoría</label>
                                        <select
                                            className="form-select"
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        >
                                            <option value="General">General</option>
                                            <option value="Combustible">Combustible</option>
                                            <option value="Mantenimiento">Mantenimiento</option>
                                            <option value="Sueldos">Sueldos</option>
                                            <option value="Insumos">Insumos</option>
                                            <option value="Impuestos">Impuestos</option>
                                            <option value="Comida">Comida</option>
                                            <option value="Otros">Otros</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="form-group">
                                <label className="form-label">Monto *</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="0.00"
                                    inputMode="decimal"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fecha</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                             <div className="form-group">
                                <label className="form-label">Moneda</label>
                                <select
                                    className="form-select"
                                    value={formData.currency}
                                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                >
                                    <option value="ARS">Pesos (ARS)</option>
                                    <option value="USD">Dólares (USD)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Caja / Cuenta Impacto *</label>
                                <select
                                    className="form-select"
                                    value={formData.arqueoCategoryId}
                                    onChange={e => setFormData({ ...formData, arqueoCategoryId: e.target.value })}
                                >
                                    <option value="">Seleccionar cuenta...</option>
                                    {arqueoCategories.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    El gasto se restará del saldo de esta cuenta en el arqueo.
                                </p>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    Responsable *
                                    <Link href={`/${locale}/usuarios`} target="_blank" style={{ fontSize: '12px', color: 'var(--accent-primary)', textDecoration: 'none' }}>
                                        + Crear Usuario
                                    </Link>
                                </label>
                                <select
                                    className="form-select"
                                    value={formData.userId}
                                    onChange={e => setFormData({ ...formData, userId: e.target.value })}
                                >
                                    <option value="">Seleccionar responsable...</option>
                                    {profiles.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.full_name || p.email?.split('@')[0]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                Cancelar
                            </button>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
            {/* Modal de Confirmación de Eliminación */}
            <ConfirmModal
                isOpen={!!expenseToDelete}
                onClose={() => setExpenseToDelete(null)}
                onConfirm={confirmDelete}
                title="¿SEGURO DESEAS ELIMINAR?"
                message="Esta acción no se puede deshacer y afectará el saldo de la caja."
            />
        </div >
    );
}
