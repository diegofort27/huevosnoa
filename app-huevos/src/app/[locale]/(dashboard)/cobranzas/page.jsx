'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import DataTable from '@/components/ui/DataTable';
import { getCollections, createCollection, deleteCollection, getClients, getProfiles, getArqueoCategories } from '@/lib/api';
import ConfirmModal from '@/components/ui/ConfirmModal';

import { mockPaymentMethods } from '@/lib/mockData';
import { useAuth } from '@/components/providers/AuthProvider';
import { useSearch } from '@/components/providers/SearchProvider';
import { formatDateLocal } from '@/lib/utils';
import { toast } from 'sonner';

export default function CobranzasPage() {
    const t = useTranslations('collections');
    const tCommon = useTranslations('common');
    const { searchTerm } = useSearch();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [collectionToDelete, setCollectionToDelete] = useState(null);


    const [collections, setCollections] = useState([]);
    const [clients, setClients] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [filterMethod, setFilterMethod] = useState('');
    const [filterCollector, setFilterCollector] = useState('');

    const { user, profile: currentProfile } = useAuth();
    const isAdmin = currentProfile?.role === 'admin';
    const canDelete = isAdmin || currentProfile?.permissions?.['collections.delete'] === true;

    const [categories, setCategories] = useState([]);

    // Form state
    const [formData, setFormData] = useState({
        clientId: '',
        date: formatDateLocal(),
        paymentMethod: 'cash',
        amount: '',
        observations: '',
        collectorId: '',
        currency: 'ARS',
        arqueo_category_id: ''
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

    // Set default collector and default arqueo category when modal opens
    useEffect(() => {
        if (showModal && user) {
            setFormData(prev => {
                const updates = {};
                if (!prev.collectorId) updates.collectorId = user.id;
                // Auto-set default arqueo category to 'Efectivo' if not already set
                if (!prev.arqueo_category_id && categories.length > 0) {
                    const efectivo = categories.find(c => c.name === 'Efectivo');
                    if (efectivo) updates.arqueo_category_id = efectivo.id.toString();
                }
                return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
            });
        }
    }, [showModal, user, categories]);

    // Handle Escape key to close modals
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (showModal) setShowModal(false);
                if (collectionToDelete) setCollectionToDelete(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal, collectionToDelete]);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [collectionsData, clientsData, profilesData, catsData] = await Promise.all([
                getCollections(),
                getClients(),
                getProfiles(),
                getArqueoCategories()
            ]);
            setCollections(collectionsData);
            setClients(clientsData);
            setProfiles(profilesData);
            setCategories(catsData);
        } catch (error) {
            console.error('Error loading data:', error);
            setError('No se pudieron cargar las cobranzas. Verifique su conexión.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value, currency = 'ARS') => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(value);
    };

    const getPaymentMethodName = (id) => {
        const method = mockPaymentMethods.find(m => m.id === id);
        return method ? method.name : id;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updates = { [name]: value };
            
            if (name === 'paymentMethod') {
                if (value === 'cash') {
                    const efectivoCat = categories.find(c => c.name === 'Efectivo');
                    if (efectivoCat) updates.arqueo_category_id = efectivoCat.id.toString();
                } else if (value === 'transfer') {
                    const bancoCat = categories.find(c => c.name === 'Banco');
                    if (bancoCat) updates.arqueo_category_id = bancoCat.id.toString();
                }
            }
            
            return {
                ...prev,
                ...updates
            };
        });
    };



    const handleSave = async () => {
        if (!formData.clientId || !formData.amount) {
            toast.warning('Por favor complete cliente y monto');
            return;
        }

        setIsSaving(true);
        const newCollection = {
            clientId: parseInt(formData.clientId),
            date: formData.date,
            amount: parseFloat(formData.amount),
            paymentMethod: formData.paymentMethod,
            observations: formData.observations || 'Pago registrado',
            collectorId: formData.collectorId,
            currency: formData.currency,
            arqueo_category_id: formData.arqueo_category_id ? parseInt(formData.arqueo_category_id) : null,
            editorId: currentProfile?.id
        };

        try {
            console.log('Iniciando creación de cobranza...', newCollection);
            await createCollection(newCollection);
            
            // Si llegamos aquí, la cobranza se creó. Cerramos el modal e intentamos recargar.
            setShowModal(false);
            
            // Reset form
            setFormData({
                clientId: '',
                date: formatDateLocal(),
                paymentMethod: 'cash',
                amount: '',
                observations: '',
                collectorId: user?.id || '',
                currency: 'ARS',
                arqueo_category_id: ''
            });

            // Recargamos los datos sin bloquear el estado isSaving principal si es posible,
            // pero lo dejamos true un momento más para refrescar la tabla.
            await loadData();
        } catch (error) {
            console.error('Error creating collection:', error);
            toast.error('Error al registrar cobro: ' + (error.message || 'La operación falló o tardó demasiado. Verifique su conexión e intente nuevamente.'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        setCollectionToDelete(id);
    };

    const confirmDelete = async () => {
        if (!collectionToDelete) return;
        try {
            await deleteCollection(collectionToDelete);
            setCollectionToDelete(null);
            await loadData();
        } catch (error) {
            console.error('Error al eliminar cobranza:', error);
            toast.error('Error al eliminar la cobranza');
        }
    };

    const columns = [
        { key: 'id', label: '#' },
        {
            key: 'clientName',
            label: 'Cliente',
            render: (value, row) => row.clientName || 'Cliente desconocido'
        },
        { key: 'date', label: 'Fecha' },
        {
            key: 'collectorName',
            label: 'Cobrador',
            render: (value) => <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{value}</span>
        },
        {
            key: 'payment_method',
            label: t('paymentMethod'),
            render: (value) => {
                const badgeClass = value === 'cash' ? 'badge-success' :
                    value === 'transfer' ? 'badge-info' :
                        value === 'mercadoPago' ? 'badge-warning' : 'badge-info';
                return (
                    <span className={`badge ${badgeClass}`}>
                        {getPaymentMethodName(value)}
                    </span>
                );
            }
        },
        {
            key: 'amount',
            label: t('amount'),
            render: (value, row) => (
                <span style={{ fontWeight: '600', color: 'var(--accent-success)' }}>
                    {formatCurrency(value, row.currency)}
                </span>
            )
        },
        { key: 'observations', label: t('observations') },
        {
            key: 'arqueo_category_id',
            label: 'Categoría',
            render: (value, row) => {
                const cat = categories.find(c => c.id === value);
                return <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cat?.name || 'Efectivo'}</span>;
            }
        },
        {
            key: 'action',
            label: 'Acciones',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                    {canDelete && (
                        <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--accent-danger)', borderColor: 'var(--accent-danger)' }}
                            onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                            title="Eliminar Cobranza"
                        >
                            ✕ Eliminar
                        </button>
                    )}
                </div>
            )
        }
    ];



    // Calculate total collections
    const totalArs = collections.filter(c => !c.currency || c.currency === 'ARS').reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
    const totalUsd = collections.filter(c => c.currency === 'USD').reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

    if (isLoading) return <div style={{ padding: '20px' }}>Cargando cobranzas...</div>;

    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h3 style={{ color: 'var(--accent-danger)', marginBottom: '16px' }}>Error</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{error}</p>
                <button className="btn btn-primary" onClick={loadData}>Reintentar</button>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '600' }}>{t('title')}</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        Total cobrado: <span style={{ color: 'var(--accent-success)', fontWeight: '600' }}>{formatCurrency(totalArs, 'ARS')}</span>
                        {totalUsd > 0 && <span style={{ marginLeft: '12px', color: 'var(--accent-info)', fontWeight: '600' }}> / {formatCurrency(totalUsd, 'USD')}</span>}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    + {t('newCollection')}
                </button>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-body">
                    <div style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        marginBottom: '20px', 
                        padding: '12px', 
                        background: 'var(--bg-tertiary)', 
                        borderRadius: 'var(--radius-md)',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Filtrar por:</span>
                        </div>
                        
                        <select 
                            className="form-select" 
                            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', minWidth: '160px' }}
                            value={filterMethod}
                            onChange={(e) => setFilterMethod(e.target.value)}
                        >
                            <option value="">Todos los medios de pago</option>
                            {mockPaymentMethods.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>

                        <select 
                            className="form-select" 
                            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', minWidth: '160px' }}
                            value={filterCollector}
                            onChange={(e) => setFilterCollector(e.target.value)}
                        >
                            <option value="">Todos los cobradores</option>
                            {profiles.map(p => (
                                <option key={p.id} value={p.id}>{p.full_name || p.email?.split('@')[0]}</option>
                            ))}
                        </select>

                        {(filterMethod || filterCollector) && (
                            <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--accent-danger)' }}
                                onClick={() => { setFilterMethod(''); setFilterCollector(''); }}
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>

                    <DataTable 
                        columns={columns} 
                        defaultSort={{ key: 'id', direction: 'desc' }}
                        data={collections.filter(item => {
                            // 1. Search term filter
                            if (searchTerm) {
                                const term = searchTerm.toLowerCase();
                                const clientName = (item.clientName || '').toLowerCase();
                                const method = getPaymentMethodName(item.payment_method).toLowerCase();
                                const collector = (item.collectorName || '').toLowerCase();
                                const obs = (item.observations || '').toLowerCase();
                                
                                const matchesSearch = clientName.includes(term) || 
                                                    method.includes(term) || 
                                                    collector.includes(term) ||
                                                    obs.includes(term) ||
                                                    item.id?.toString().includes(term);
                                
                                if (!matchesSearch) return false;
                            }

                            // 2. Specific filters
                            // Restriction: non-admins only see their own collections
                            if (!isAdmin && item.collector_id !== user?.id) return false;

                            if (filterMethod && item.payment_method !== filterMethod) return false;
                            if (filterCollector && item.collector_id !== filterCollector) return false;

                            return true;
                        })} 
                    />
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{t('newCollection')}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Cliente *</label>
                                <select
                                    className="form-select"
                                    name="clientId"
                                    value={formData.clientId}
                                    onChange={handleInputChange}
                                    autoFocus
                                >
                                    <option value="">Seleccionar cliente...</option>
                                    {clients.map(client => (
                                        <option key={client.id} value={client.id}>
                                            {client.name}
                                        </option>
                                    ))}
                                </select>
                                {formData.clientId && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Saldo Pendiente:</span>
                                        <span style={{
                                            fontSize: '16px',
                                            fontWeight: '700',
                                            color: (clients.find(c => c.id === parseInt(formData.clientId))?.balance || 0) > 0
                                                ? 'var(--accent-danger, #ef4444)'
                                                : 'var(--accent-success, #22c55e)'
                                        }}>
                                            {formatCurrency(clients.find(c => c.id === parseInt(formData.clientId))?.balance || 0)}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fecha</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('paymentMethod')}</label>
                                <select
                                    className="form-select"
                                    name="paymentMethod"
                                    value={formData.paymentMethod}
                                    onChange={handleInputChange}
                                >
                                    {mockPaymentMethods.map(method => (
                                        <option key={method.id} value={method.id}>{method.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Moneda</label>
                                <select
                                    className="form-select"
                                    name="currency"
                                    value={formData.currency}
                                    onChange={handleInputChange}
                                >
                                    <option value="ARS">Pesos (ARS)</option>
                                    <option value="USD">Dólares (USD)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('amount')} *</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleInputChange}
                                    placeholder="Ingrese el monto"
                                    inputMode="decimal"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('observations')}</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="observations"
                                    value={formData.observations}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Pago parcial, Pago total..."
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Categoría Arqueo</label>
                                <select
                                    className="form-select"
                                    name="arqueo_category_id"
                                    value={formData.arqueo_category_id}
                                    onChange={handleInputChange}
                                >
                                    <option value="">Seleccionar categoría...</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}{cat.is_default && cat.name === 'Efectivo' ? ' (default)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                             <div className="form-group">
                                <label className="form-label">Cobrador</label>
                                <select
                                    className="form-select"
                                    name="collectorId"
                                    value={formData.collectorId || ''}
                                    onChange={handleInputChange}
                                    disabled={!isAdmin}
                                    style={!isAdmin ? { background: 'var(--bg-secondary)', cursor: 'not-allowed' } : {}}
                                >
                                    {!isAdmin && profiles.find(p => p.id === user?.id) ? (
                                        <option value={user?.id}>
                                            {profiles.find(p => p.id === user?.id)?.full_name || user?.email?.split('@')[0]}
                                        </option>
                                    ) : (
                                        <>
                                            <option value="">Seleccionar cobrador...</option>
                                            {profiles.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.full_name || p.email?.split('@')[0]}
                                                </option>
                                            ))}
                                        </>
                                    )}
                                </select>
                                {!isAdmin && <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Tu usuario se asignará automáticamente como cobrador.</small>}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={isSaving}>
                                {tCommon('cancel')}
                            </button>
                            <button className="btn btn-success" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? 'Guardando...' : tCommon('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Confirmación de Eliminación */}
            <ConfirmModal
                isOpen={!!collectionToDelete}
                onClose={() => setCollectionToDelete(null)}
                onConfirm={confirmDelete}
                title="¿SEGURO DESEAS ELIMINAR?"
                message="Esta acción no se puede deshacer y el saldo del cliente será revertido."
            />
        </div>
    );
}

