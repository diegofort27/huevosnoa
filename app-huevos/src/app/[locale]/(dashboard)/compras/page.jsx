'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import DataTable from '@/components/ui/DataTable';
import { getPurchases, createPurchase, deletePurchase, getProviders, getProducts } from '@/lib/api';
import { useSearch } from '@/components/providers/SearchProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatDateLocal } from '@/lib/utils';
import { toast } from 'sonner';


export default function ComprasPage() {
    const tCommon = useTranslations('common');
    const { searchTerm } = useSearch();
    const { profile } = useAuth();
    const [purchases, setPurchases] = useState([]);
    const [providers, setProviders] = useState([]);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [purchaseToDelete, setPurchaseToDelete] = useState(null);

    const [formData, setFormData] = useState({
        providerId: '',
        date: formatDateLocal(),
        status: 'completed',
        items: []
    });

    const [currentItem, setCurrentItem] = useState({
        productId: '',
        quantity: 1,
        unitPrice: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [purchasesData, providersData, productsData] = await Promise.all([
                getPurchases(),
                getProviders(),
                getProducts()
            ]);
            setPurchases(purchasesData);
            setProviders(providersData);
            setProducts(productsData);
        } catch (error) {
            console.error('Error loading compras data:', error);
            toast.error('Error al cargar datos de compras');
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(parseFloat(value || 0));
    };

    const formatQuantity = (value) => {
        return Number(value).toLocaleString('es-AR', {
            maximumFractionDigits: 4,
            minimumFractionDigits: 0
        });
    };

    const handleAddItem = () => {
        if (!currentItem.productId || currentItem.quantity <= 0 || currentItem.unitPrice === '') {
            toast.warning('Complete todos los campos del producto correctamente');
            return;
        }

        const product = products.find(p => p.id === parseInt(currentItem.productId));
        const newItem = {
            productId: parseInt(currentItem.productId),
            productName: product?.description,
            quantity: parseFloat(currentItem.quantity),
            unitPrice: parseFloat(currentItem.unitPrice),
            total: parseFloat(currentItem.quantity) * parseFloat(currentItem.unitPrice)
        };

        setFormData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));

        setCurrentItem({
            productId: '',
            quantity: 1,
            unitPrice: ''
        });
    };

    const handleRemoveItem = (index) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems.splice(index, 1);
            return { ...prev, items: newItems };
        });
    };

    const calculateTotal = () => {
        return formData.items.reduce((sum, item) => sum + item.total, 0);
    };

    const handleSave = async () => {
        if (!formData.providerId) {
            toast.warning('Seleccione un proveedor');
            return;
        }
        if (formData.items.length === 0) {
            toast.warning('Agregue al menos un producto a la compra');
            return;
        }

        setIsSaving(true);
        try {
            const purchaseData = {
                providerId: formData.providerId,
                date: formData.date,
                status: formData.status,
                total: calculateTotal(),
                items: formData.items,
                userId: profile?.id,
                editorId: profile?.id
            };

            await createPurchase(purchaseData);
            
            setShowModal(false);
            setFormData({
                providerId: '',
                date: formatDateLocal(),
                status: 'completed',
                items: []
            });
            await loadData();
            toast.success('Compra registrada con éxito. Stock y saldo actualizados.');
        } catch (error) {
            console.error('Error saving purchase:', error);
            toast.error('Error al registrar la compra');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        setPurchaseToDelete(id);
    };

    const confirmDelete = async () => {
        if (!purchaseToDelete) return;
        try {
            await deletePurchase(purchaseToDelete);
            setPurchaseToDelete(null);
            await loadData();
            toast.success('Compra eliminada correctamente');
        } catch (error) {
            console.error('Error deleting purchase:', error);
            toast.error('Error al eliminar la compra');
        }
    };

    // Auto-fill price when product is selected
    const handleProductSelect = (e) => {
        const pId = e.target.value;
        const prod = products.find(p => p.id === parseInt(pId));
        setCurrentItem(prev => ({
            ...prev,
            productId: pId,
            unitPrice: prod?.cost || 0 // Default to current cost
        }));
    };

    const columns = [
        { key: 'date', label: 'Fecha' },
        { 
            key: 'providerName', 
            label: 'Proveedor',
            render: (val) => <span style={{ fontWeight: '500' }}>{val || 'Desconocido'}</span>
        },
        {
            key: 'items_summary',
            label: 'Detalle',
            render: (_, row) => (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {row.items?.slice(0, 2).map((it, idx) => (
                        <div key={idx}>• {it.productName} (x{formatQuantity(it.quantity)})</div>
                    ))}
                    {row.items?.length > 2 && <div>y {row.items.length - 2} más...</div>}
                </div>
            )
        },
        {
            key: 'total',
            label: 'Total',
            render: (val) => <span style={{ fontWeight: '600', color: 'var(--accent-warning)' }}>{formatCurrency(val)}</span>
        },
        {
            key: 'actions',
            label: 'Acciones',
            render: (_, row) => (
                <button
                    onClick={() => handleDelete(row.id)}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--accent-danger)' }}
                    title="Eliminar Compra"
                >
                    🗑️
                </button>
            )
        }
    ];

    if (isLoading) return <div style={{ padding: '20px' }}>Cargando compras...</div>;

    const filteredPurchases = purchases.filter(p => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return p.providerName?.toLowerCase().includes(term);
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Compras</h1>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    + Nueva Compra
                </button>
            </div>

            <div className="card">
                <div className="card-body">
                    {filteredPurchases.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No hay compras registradas.
                        </div>
                    ) : (
                        <DataTable columns={columns} data={filteredPurchases} />
                    )}
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Registrar Nueva Compra</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
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
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Fecha *</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                                <h4 style={{ marginBottom: '16px' }}>Agregar Productos</h4>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
                                    <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                                        <label className="form-label">Producto</label>
                                        <select
                                            className="form-select"
                                            value={currentItem.productId}
                                            onChange={handleProductSelect}
                                        >
                                            <option value="">Seleccionar producto...</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.description} (Stock: {p.stock})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label className="form-label">Cantidad</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            min="0.1"
                                            step="0.0001"
                                            value={currentItem.quantity}
                                            onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                                            inputMode="decimal"
                                        />
                                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                                            {[30, 60, 180, 360].map(q => (
                                                <button
                                                    key={q}
                                                    type="button"
                                                    className="btn-secondary"
                                                    style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px', minWidth: '32px' }}
                                                    onClick={() => setCurrentItem(prev => ({ ...prev, quantity: q }))}
                                                >
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label className="form-label">Costo Unit.</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            min="0"
                                            step="0.01"
                                            value={currentItem.unitPrice}
                                            onChange={e => setCurrentItem({ ...currentItem, unitPrice: e.target.value })}
                                            inputMode="decimal"
                                        />
                                    </div>

                                    <button 
                                        className="btn btn-secondary" 
                                        onClick={handleAddItem}
                                        style={{ height: '38px', padding: '0 20px' }}
                                    >
                                        Agregar
                                    </button>
                                </div>

                                {formData.items.length > 0 && (
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                                    <th style={{ paddingBottom: '8px' }}>Producto</th>
                                                    <th style={{ paddingBottom: '8px' }}>Cant.</th>
                                                    <th style={{ paddingBottom: '8px' }}>Costo U.</th>
                                                    <th style={{ paddingBottom: '8px' }}>Subtotal</th>
                                                    <th style={{ paddingBottom: '8px' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {formData.items.map((it, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '8px 0' }}>{it.productName}</td>
                                                        <td style={{ padding: '8px 0' }}>{formatQuantity(it.quantity)}</td>
                                                        <td style={{ padding: '8px 0' }}>{formatCurrency(it.unitPrice)}</td>
                                                        <td style={{ padding: '8px 0' }}>{formatCurrency(it.total)}</td>
                                                        <td style={{ padding: '8px 0', textAlign: 'right' }}>
                                                            <button 
                                                                onClick={() => handleRemoveItem(idx)}
                                                                style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}
                                                            >
                                                                ✕
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr>
                                                    <td colSpan="3" style={{ paddingTop: '16px', textAlign: 'right', fontWeight: '600' }}>Total Compra:</td>
                                                    <td colSpan="2" style={{ paddingTop: '16px', fontWeight: '700', color: 'var(--accent-warning)' }}>
                                                        {formatCurrency(calculateTotal())}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={isSaving}>
                                {tCommon('cancel')}
                            </button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? 'Guardando... ⏳' : 'Guardar Compra'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Confirmación de Eliminación */}
            <ConfirmModal
                isOpen={!!purchaseToDelete}
                onClose={() => setPurchaseToDelete(null)}
                onConfirm={confirmDelete}
                title="¿SEGURO DESEAS ELIMINAR?"
                message="Esta acción no se puede deshacer. El stock ingresado se descontará y el saldo del proveedor se revertirá."
            />
        </div>
    );
}
