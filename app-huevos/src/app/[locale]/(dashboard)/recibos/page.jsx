'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import DataTable from '@/components/ui/DataTable';
import { getCollections, getClients, getProfiles, getArqueoCategories } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import { mockPaymentMethods } from '@/lib/mockData';

export default function RecibosPage() {
    const tCommon = useTranslations('common');
    
    const [collections, setCollections] = useState([]);
    const [clients, setClients] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [filterClientId, setFilterClientId] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    // Receipt Modal
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    const { user, profile: currentProfile } = useAuth();
    const isAdmin = currentProfile?.role === 'admin';

    useEffect(() => {
        loadData();
    }, []);

    // Handle Escape key to close modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (selectedReceipt) setSelectedReceipt(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedReceipt]);

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
            setError('No se pudieron cargar los recibos. Verifique su conexión.');
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

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const getPaymentMethodName = (id) => {
        const method = mockPaymentMethods.find(m => m.id === id);
        return method ? method.name : id;
    };

    const handlePrint = () => {
        window.print();
    };

    const columns = [
        { key: 'id', label: 'Nº Recibo' },
        {
            key: 'clientName',
            label: 'Cliente',
            render: (value, row) => row.clientName || 'Cliente desconocido'
        },
        { 
            key: 'date', 
            label: 'Fecha',
            render: (value) => formatDate(value)
        },
        {
            key: 'amount',
            label: 'Monto',
            render: (value, row) => (
                <span style={{ fontWeight: '600', color: 'var(--accent-success)' }}>
                    {formatCurrency(value, row.currency)}
                </span>
            )
        },
        {
            key: 'payment_method',
            label: 'Método',
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
            key: 'action',
            label: 'Acciones',
            render: (_, row) => (
                <button
                    className="btn btn-secondary btn-sm no-print"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedReceipt(row); }}
                >
                    🧾 Ver Recibo
                </button>
            )
        }
    ];

    const filteredCollections = collections.filter(item => {
        // Restriction: non-admins only see their own collections
        if (!isAdmin && item.collector_id !== user?.id) return false;

        if (filterClientId && item.client_id?.toString() !== filterClientId) return false;
        
        if (filterDateFrom && item.date < filterDateFrom) return false;
        if (filterDateTo && item.date > filterDateTo) return false;

        return true;
    });

    if (isLoading) return <div style={{ padding: '20px' }}>Cargando recibos...</div>;

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
        <div className="recibos-page">
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .receipt-print-area, .receipt-print-area * {
                        visibility: visible;
                    }
                    .receipt-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 20px;
                        margin: 0;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .modal-overlay {
                        background: none !important;
                    }
                    .modal {
                        box-shadow: none !important;
                        transform: none !important;
                        top: 0 !important;
                        left: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                    }
                }
                
                .receipt-card {
                    background: #fff;
                    color: #333;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 24px;
                    font-family: monospace;
                    max-width: 400px;
                    margin: 0 auto;
                }
                
                .receipt-header {
                    text-align: center;
                    border-bottom: 2px dashed #cbd5e1;
                    padding-bottom: 16px;
                    margin-bottom: 16px;
                }
                
                .receipt-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                
                .receipt-total {
                    border-top: 2px dashed #cbd5e1;
                    padding-top: 16px;
                    margin-top: 16px;
                    font-size: 18px;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                }
            `}</style>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Recibos</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        Visualiza y emite comprobantes de pago.
                    </p>
                </div>
            </div>

            <div className="card no-print" style={{ marginBottom: '24px' }}>
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
                            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Filtrar:</span>
                        </div>
                        
                        <select 
                            className="form-select" 
                            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', minWidth: '160px' }}
                            value={filterClientId}
                            onChange={(e) => setFilterClientId(e.target.value)}
                        >
                            <option value="">Todos los clientes</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>

                        <input 
                            type="date"
                            className="form-input"
                            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
                            value={filterDateFrom}
                            onChange={(e) => setFilterDateFrom(e.target.value)}
                            title="Fecha Desde"
                        />
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                        <input 
                            type="date"
                            className="form-input"
                            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
                            value={filterDateTo}
                            onChange={(e) => setFilterDateTo(e.target.value)}
                            title="Fecha Hasta"
                        />

                        {(filterClientId || filterDateFrom || filterDateTo) && (
                            <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--accent-danger)' }}
                                onClick={() => { setFilterClientId(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                            >
                                Limpiar
                            </button>
                        )}
                    </div>

                    <DataTable 
                        columns={columns} 
                        defaultSort={{ key: 'date', direction: 'desc' }}
                        data={filteredCollections} 
                    />
                </div>
            </div>

            {selectedReceipt && (
                <div className="modal-overlay" onClick={() => setSelectedReceipt(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header no-print">
                            <h3 className="modal-title">Comprobante de Pago</h3>
                            <button className="modal-close" onClick={() => setSelectedReceipt(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="receipt-print-area receipt-card">
                                <div className="receipt-header">
                                    <h2 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>RECIBO OFICIAL</h2>
                                    <div>Nº {String(selectedReceipt.id).padStart(6, '0')}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>{formatDate(selectedReceipt.date)}</div>
                                </div>
                                
                                <div style={{ marginBottom: '20px' }}>
                                    <div className="receipt-row">
                                        <span style={{ color: '#64748b' }}>Cliente:</span>
                                        <span style={{ fontWeight: 'bold' }}>{selectedReceipt.clientName}</span>
                                    </div>
                                    <div className="receipt-row">
                                        <span style={{ color: '#64748b' }}>Método:</span>
                                        <span>{getPaymentMethodName(selectedReceipt.payment_method)}</span>
                                    </div>
                                    <div className="receipt-row">
                                        <span style={{ color: '#64748b' }}>Cobrador:</span>
                                        <span>{selectedReceipt.collectorName}</span>
                                    </div>
                                    {selectedReceipt.observations && (
                                        <div className="receipt-row">
                                            <span style={{ color: '#64748b' }}>Notas:</span>
                                            <span style={{ textAlign: 'right', maxWidth: '60%' }}>{selectedReceipt.observations}</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="receipt-total">
                                    <span>TOTAL ABONADO:</span>
                                    <span>{formatCurrency(selectedReceipt.amount, selectedReceipt.currency)}</span>
                                </div>
                                
                                <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                                    <p>Gracias por su pago.</p>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer no-print">
                            <button className="btn btn-secondary" onClick={() => setSelectedReceipt(null)}>
                                Cerrar
                            </button>
                            <button className="btn btn-primary" onClick={handlePrint}>
                                🖨️ Imprimir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
