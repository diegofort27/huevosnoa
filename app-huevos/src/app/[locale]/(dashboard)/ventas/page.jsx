'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import DataTable from '@/components/ui/DataTable';
import { getSales, createSale, updateSale, getClients, getProducts, getPriceLists, getZones, deleteSale, createClientAdjustment } from '@/lib/api';
import ConfirmModal from '@/components/ui/ConfirmModal';

import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import { calculateDiscountedPrice, getNextDeliveryDay, formatDateLocal } from '@/lib/utils';
import { useSearch } from '@/components/providers/SearchProvider';

export default function VentasPage() {
    const t = useTranslations('sales');
    const tCommon = useTranslations('common');
    const { profile: currentProfile } = useAuth();
    const { searchTerm } = useSearch();
    const [showModal, setShowModal] = useState(false);
    const [editingSaleId, setEditingSaleId] = useState(null);
    const [saleToDelete, setSaleToDelete] = useState(null);

    // Credit Note Modal state
    const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
    const [creditNoteData, setCreditNoteData] = useState({
        type: 'monto', // 'monto' | 'productos'
        clientId: '',
        amount: '',
        items: [],
        date: formatDateLocal(),
        description: ''
    });
    const [cnProductForm, setCnProductForm] = useState({
        productId: '',
        quantity: 1,
        unitPrice: '',
        total: ''
    });
    const [isSavingCreditNote, setIsSavingCreditNote] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();
    const clientSelectRef = useRef(null);
    const [showQuantityPicker, setShowQuantityPicker] = useState(false);
    const [quantityInput, setQuantityInput] = useState('');


    const canDelete = currentProfile?.role === 'admin' || currentProfile?.permissions?.['sales.delete'];
    const isAdmin = currentProfile?.role === 'admin';

    // Data state using SWR for aggressive caching
    const { data: sales = [], error: salesError, isLoading: isSalesLoading } = useSWR('sales', () => getSales(), { 
        revalidateOnFocus: true,
        dedupingInterval: 5000
    });
    const { data: clients = [], isLoading: isClientsLoading } = useSWR('clients', () => getClients());
    const { data: products = [], isLoading: isProductsLoading } = useSWR('products', () => getProducts());
    const { data: priceLists = [], isLoading: isPriceListsLoading } = useSWR('priceLists', () => getPriceLists());
    const { data: zones = [], isLoading: isZonesLoading } = useSWR('zones', () => getZones());

    const isLoading = isSalesLoading || isClientsLoading || isProductsLoading || isPriceListsLoading || isZonesLoading;
    const error = salesError ? 'No se pudieron cargar los datos de ventas. Verifique su conexión.' : null;

    // Form state
    const [formData, setFormData] = useState({
        clientId: '',
        date: formatDateLocal(),
        productId: '',
        quantity: 1,
        quantityType: 'unidades',
        unitPrice: 0,
        saleType: 'contado',
        status: 'pending'
    });

    // Current discount info
    const [currentDiscount, setCurrentDiscount] = useState(null);

    // Cart items
    const [cartItems, setCartItems] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Persistence: Load draft on mount
    useEffect(() => {
        const savedDraft = localStorage.getItem('venta_draft');
        if (savedDraft) {
            try {
                const { formData: savedForm, cartItems: savedCart, showModal: wasOpen } = JSON.parse(savedDraft);
                if (savedCart && savedCart.length > 0) {
                    setCartItems(savedCart);
                    setFormData(prev => ({ ...prev, ...savedForm }));
                    if (wasOpen) setShowModal(true);
                }
            } catch (e) {
                console.error('Error restoring draft:', e);
            }
        }
    }, []);

    // Handle action from URL (shortcuts)
    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'new') {
            setEditingSaleId(null);
            setShowModal(true);

            // Focus after modal animation
            setTimeout(() => {
                if (clientSelectRef.current) {
                    clientSelectRef.current.focus();
                }
            }, 100);

            // Clear the param without refreshing to avoid re-opening on reload
            const params = new URLSearchParams(searchParams.toString());
            params.delete('action');
            params.delete('t');
            const search = params.toString();
            const newUrl = `${window.location.pathname}${search ? '?' + search : ''}`;
            window.history.replaceState({}, '', newUrl);
        }
    }, [searchParams]);

    // Focus on modal open
    useEffect(() => {
        if (showModal && !editingSaleId) {
            setTimeout(() => {
                if (clientSelectRef.current) {
                    clientSelectRef.current.focus();
                }
            }, 150); // Slightly longer delay to ensure DOM is ready
        }
    }, [showModal, editingSaleId]);

    // Handle Escape key to close modals
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (showModal) setShowModal(false);
                if (saleToDelete) setSaleToDelete(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal, saleToDelete]);

    // Persistence: Save draft on changes
    useEffect(() => {
        if (!editingSaleId && (cartItems.length > 0 || formData.clientId)) {
            localStorage.setItem('venta_draft', JSON.stringify({
                formData: {
                    clientId: formData.clientId,
                    date: formData.date,
                    saleType: formData.saleType
                },
                cartItems,
                showModal
            }));
        } else if (!editingSaleId) {
            localStorage.removeItem('venta_draft');
        }
    }, [formData.clientId, formData.date, formData.saleType, cartItems, showModal, editingSaleId]);

    // Removed manual loadData function as SWR handles initial fetch

    const formatCurrency = (value, currency = 'ARS') => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(value);
    };

    const formatQuantity = (value) => {
        return Number(value).toLocaleString('es-AR', {
            maximumFractionDigits: 4,
            minimumFractionDigits: 0
        });
    };

    const getClientName = (id) => {
        const client = clients.find(c => c.id === parseInt(id));
        return client ? client.name : '';
    };

    const getProductById = (id) => {
        return products.find(p => p.id === parseInt(id));
    };

    const getClientPriceList = (clientId) => {
        const client = clients.find(c => c.id === parseInt(clientId));
        if (!client) return null;
        // Adjust property name based on DB schema (price_list_id vs priceListId)
        const listId = client.price_list_id || client.priceListId;
        return priceLists.find(pl => pl.id === listId);
    };

    const getProductPriceInfo = (productId, clientId, quantity) => {
        const product = getProductById(productId);
        if (!product) return { basePrice: 0, finalPrice: 0, discount: null, discounts: [] };

        const priceList = getClientPriceList(clientId);

        // If no price list or product not in list, use base price
        if (!priceList) {
            return {
                basePrice: product.base_price || 0,
                finalPrice: product.base_price || 0,
                discount: null,
                discounts: []
            };
        }

        const priceItem = priceList.products.find(p => p.productId === parseInt(productId));

        // If item not customized in list, check if we should fallback or return base
        // Assuming we fallback to product base price
        if (!priceItem) {
            return {
                basePrice: product.base_price || 0,
                finalPrice: product.base_price || 0,
                discount: null,
                discounts: []
            };
        }

        const { finalPrice, discount } = calculateDiscountedPrice(priceItem.price, quantity, priceItem.discounts);

        return {
            basePrice: priceItem.price,
            finalPrice,
            discount,
            discounts: priceItem.discounts || []
        };
    };

    // Update price and suggest date when product, client, or quantity changes
    useEffect(() => {
        if (formData.clientId && formData.productId) {
            const priceInfo = getProductPriceInfo(formData.productId, formData.clientId, formData.quantity);
            setFormData(prev => ({ ...prev, unitPrice: priceInfo.finalPrice }));
            setCurrentDiscount(priceInfo);
        }
    }, [formData.clientId, formData.productId, formData.quantity]);

    // Independent effect for date suggestion and default sale type when client changes
    useEffect(() => {
        if (formData.clientId) {
            const client = clients.find(c => c.id === parseInt(formData.clientId));
            if (client) {
                const updates = {};

                // Default sale type from client profile
                if (client.sale_condition) {
                    updates.saleType = client.sale_condition;
                } else {
                    updates.saleType = 'contado';
                }

                // Delivery date calculation
                if (client.zone_id) {
                    const zone = zones.find(z => z.id === client.zone_id);
                    if (zone && zone.delivery_days && zone.delivery_days.length > 0) {
                        const nextDate = getNextDeliveryDay(zone.delivery_days);
                        if (nextDate) {
                            const year = nextDate.getFullYear();
                            const month = String(nextDate.getMonth() + 1).padStart(2, '0');
                            const day = String(nextDate.getDate()).padStart(2, '0');
                            updates.date = `${year}-${month}-${day}`;
                        }
                    }
                }

                if (Object.keys(updates).length > 0) {
                    setFormData(prev => ({ ...prev, ...updates }));
                }
            }
        }
    }, [formData.clientId, zones, clients]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCreditNoteInputChange = (e) => {
        const { name, value } = e.target;
        setCreditNoteData(prev => ({ ...prev, [name]: value }));
    };

    const handleCnTypeChange = (type) => {
        setCreditNoteData(prev => ({ ...prev, type }));
    };

    const handleCnProductChange = (e) => {
        const pId = e.target.value;
        setCnProductForm(prev => ({ ...prev, productId: pId }));

        if (pId && creditNoteData.clientId) {
            const client = clients.find(c => c.id === parseInt(creditNoteData.clientId));
            const priceListId = client?.price_list_id;

            if (priceListId) {
                const list = priceLists.find(l => l.id === priceListId);
                const item = list?.products?.find(p => p.productId === parseInt(pId));
                if (item) {
                    const price = parseFloat(item.price);
                    const qty = parseFloat(cnProductForm.quantity || 1);
                    setCnProductForm(prev => ({
                        ...prev,
                        unitPrice: price,
                        total: price * qty
                    }));
                }
            }
        }
    };

    const handleCnQuantityOrPriceChange = (e) => {
        const { name, value } = e.target;
        setCnProductForm(prev => {
            const newState = { ...prev, [name]: value };
            const q = parseFloat(newState.quantity || 0);
            const p = parseFloat(newState.unitPrice || 0);
            newState.total = q * p;
            return newState;
        });
    };

    const handleCnAddToCart = () => {
        if (!cnProductForm.productId) {
            toast.warning('Por favor seleccione un producto');
            return;
        }
        if (!cnProductForm.quantity || isNaN(cnProductForm.quantity) || parseFloat(cnProductForm.quantity) <= 0) {
            toast.warning('Ingrese una cantidad válida mayor a 0');
            return;
        }
        if (!cnProductForm.unitPrice || isNaN(cnProductForm.unitPrice) || parseFloat(cnProductForm.unitPrice) < 0) {
            toast.warning('Ingrese un precio unitario válido');
            return;
        }

        const product = products.find(p => p.id === parseInt(cnProductForm.productId));
        const newItem = {
            productId: parseInt(cnProductForm.productId),
            productName: product?.description || '',
            quantity: parseFloat(cnProductForm.quantity),
            unitPrice: parseFloat(cnProductForm.unitPrice),
            total: parseFloat(cnProductForm.total)
        };

        setCreditNoteData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));

        setCnProductForm(prev => ({
            ...prev,
            productId: '',
            quantity: 1,
            unitPrice: '',
            total: ''
        }));
    };

    const handleCnRemoveItem = (index) => {
        setCreditNoteData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleSaveCreditNote = async () => {
        if (!creditNoteData.clientId) {
            toast.warning('Por favor seleccione un cliente');
            return;
        }

        let finalAmount = 0;
        if (creditNoteData.type === 'monto') {
            finalAmount = parseFloat(creditNoteData.amount || 0);
            if (isNaN(finalAmount) || finalAmount <= 0) {
                toast.warning('El monto debe ser mayor a cero');
                return;
            }
        } else {
            if (creditNoteData.items.length === 0) {
                toast.warning('Debe agregar al menos un producto a la devolución');
                return;
            }
            finalAmount = creditNoteData.items.reduce((sum, item) => sum + item.total, 0);
            if (finalAmount <= 0) {
                toast.warning('El total de los productos debe ser mayor a cero');
                return;
            }
        }

        if (!creditNoteData.description.trim()) {
            toast.warning('Por favor ingrese un motivo/observación');
            return;
        }

        setIsSavingCreditNote(true);

        try {
            await createClientAdjustment({
                clientId: parseInt(creditNoteData.clientId),
                amount: finalAmount,
                type: 'decrease', // Disminución de deuda (Nota de Crédito)
                description: `Nota de Crédito: ${creditNoteData.description.trim()}`,
                date: creditNoteData.date,
                userId: currentProfile?.id,
                editorId: currentProfile?.id
            });

            if (creditNoteData.type === 'productos') {
                const freshProducts = await getProducts();
                for (const item of creditNoteData.items) {
                    const product = freshProducts.find(p => p.id === item.productId);
                    if (product) {
                        const newStock = parseFloat(product.current_stock || 0) + parseFloat(item.quantity);
                        await updateProduct(item.productId, { current_stock: newStock });
                    }
                }
            }

            toast.success('Nota de Crédito creada con éxito');

            // Reset form
            setCreditNoteData({
                type: 'monto',
                clientId: '',
                amount: '',
                items: [],
                date: formatDateLocal(),
                description: ''
            });
            setShowCreditNoteModal(false);
            mutate('sales');
            mutate('products'); // Refresh products if stock changed
        } catch (error) {
            console.error('Error al guardar nota de crédito:', error);
            toast.error('Error al guardar la Nota de Crédito. Verifique su conexión.');
        } finally {
            setIsSavingCreditNote(false);
        }
    };

    const handleAddToCart = () => {
        if (!formData.productId) {
            toast.warning('Por favor seleccione un producto');
            return;
        }

        const product = getProductById(formData.productId);
        if (!product) return;

        let inputQty = parseFloat(formData.quantity || 0);
        if (isNaN(inputQty) || inputQty <= 0) {
            toast.warning('La cantidad debe ser mayor a cero');
            return;
        }

        const qty = formData.quantityType === 'bultos' ? inputQty * (product.units_per_bulk || 1) : inputQty;

        // Al editar, los items del carrito ya consumieron stock previamente.
        // updateSale los devuelve antes de descontar los nuevos, así que
        // el stock "real disponible" = stock actual + lo que ya está en el carrito para este producto.
        const qtyAlreadyInCartForProduct = cartItems.reduce(
            (sum, item) => item.productId === product.id ? sum + item.quantity : sum, 0
        );
        const effectiveStock = parseFloat(product.current_stock || 0) + (editingSaleId ? qtyAlreadyInCartForProduct : 0);

        // Cantidad total que se quiere reservar (lo que ya hay en el carrito + lo nuevo)
        const totalRequestedQty = qty + qtyAlreadyInCartForProduct;

        // Validación: si el producto NO autoriza stock negativo, frenar aquí
        if (!product.allow_negative_stock && effectiveStock < totalRequestedQty) {
            const disponible = parseFloat(product.current_stock || 0);
            toast.error(`Stock insuficiente para "${product.description}". Stock actual: ${disponible}, solicitado: ${totalRequestedQty}. Activá "Permitir venta en negativo" en la ficha del producto.`);
            return;
        }

        const priceInfo = getProductPriceInfo(formData.productId, formData.clientId, qty);
        const unitPrice = parseFloat(formData.unitPrice || 0);

        const newItem = {
            productId: parseInt(formData.productId),
            productName: product.description,
            quantity: qty,
            basePrice: priceInfo.basePrice,
            unitPrice: unitPrice,
            discount: unitPrice < priceInfo.basePrice ? priceInfo.basePrice - unitPrice : null,
            total: qty * unitPrice
        };

        setCartItems(prev => [...prev, newItem]);
        setFormData(prev => ({ ...prev, productId: '', quantity: 1, quantityType: 'unidades', unitPrice: 0 }));
        setCurrentDiscount(null);
    };

    const handleRemoveFromCart = (index) => {
        setCartItems(prev => prev.filter((_, i) => i !== index));
    };

    const cartTotal = cartItems.reduce((sum, item) => sum + item.total, 0);
    const cartSavings = cartItems.reduce((sum, item) => {
        if (item.discount) {
            return sum + (item.basePrice - item.unitPrice) * item.quantity;
        }
        return sum;
    }, 0);

    const handleSave = async () => {
        if (!formData.clientId || cartItems.length === 0) {
            toast.warning('Por favor seleccione un cliente y agregue al menos un producto');
            return;
        }

        setIsSaving(true);

        const saleData = {
            clientId: parseInt(formData.clientId),
            date: formData.date,
            items: cartItems,
            total: cartTotal,
            saleType: formData.saleType,
            status: formData.status || 'pending',
            userId: currentProfile?.id,
            editorId: currentProfile?.id
        };

        try {
            if (editingSaleId) {
                await updateSale(editingSaleId, saleData);
            } else {
                await createSale(saleData);
            }

            // Clean draft immediately after success
            localStorage.removeItem('venta_draft');

            // Optimistically update and revalidate
            mutate('sales');

            // Reset form
            setFormData({
                clientId: '',
                date: formatDateLocal(),
                productId: '',
                quantity: 1,
                quantityType: 'unidades',
                unitPrice: 0,
                saleType: 'contado',
                status: 'pending'
            });
            setCartItems([]);
            setCurrentDiscount(null);
            setEditingSaleId(null);
            setShowModal(false);
        } catch (error) {
            console.error('Error saving sale:', error);
            toast.error('Error al guardar venta. Verifique su conexión.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (sale) => {
        setEditingSaleId(sale.id);

        // Prepare cart items
        // Important: in the table rows, items are already formatted
        const items = (sale.items || []).map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            basePrice: item.basePrice || item.unitPrice, // Fallback if not stored
            unitPrice: item.unitPrice,
            discount: item.discount_applied ? item.discount_applied[0] : null,
            total: item.total
        }));

        setFormData({
            clientId: sale.clientId.toString(),
            date: formatDateLocal(sale.date),
            productId: '',
            quantity: 1,
            quantityType: 'unidades',
            unitPrice: 0,
            saleType: sale.saleType,
            status: sale.status
        });
        setCartItems(items);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        setSaleToDelete(id);
    };

    const confirmDelete = async () => {
        if (!saleToDelete) return;
        try {
            await deleteSale(saleToDelete);
            setSaleToDelete(null);
            mutate('sales');
        } catch (error) {
            console.error('Error al eliminar:', error);
            toast.error('Error al eliminar la venta');
        }
    };

    const columns = [
        { key: 'id', label: '#' },
        {
            key: 'clientName',
            label: t('client'),
            render: (value, row) => row.clientName || getClientName(row.clientId)
        },
        { 
            key: 'date', 
            label: t('date'),
            render: (value) => {
                if (!value) return '-';
                const [year, month, day] = value.split('T')[0].split('-');
                return `${day}/${month}/${year}`;
            }
        },
        {
            key: 'items',
            label: t('products'),
            render: (value) => {
                if (!value) return '-';
                const text = value.map(i => i.productName).join(', ');
                return text.length > 40 ? text.substring(0, 40) + '...' : text;
            }
        },
        {
            key: 'saleType',
            label: t('saleType'),
            render: (value, row) => {
                const isCC = value === 'cc' || (row.status === 'pending');
                return (
                    <span className={`badge ${isCC ? 'badge-info' : 'badge-success'}`}>
                        {isCC ? 'Cuenta Corriente' : 'Contado'}
                    </span>
                );
            }
        },
        {
            key: 'status',
            label: 'Status',
            render: (value, row) => {
                if (value === 'venta_rapida' || row.saleType === 'venta_rapida') {
                    return (
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontWeight: 'bold' }}>
                            ⚡ Venta Rápida
                        </span>
                    );
                }
                return (
                    <span className={`badge ${value === 'success' ? 'badge-success' : 'badge-warning'}`}>
                        {value === 'success' ? t('success') : t('pending')}
                    </span>
                );
            }
        },
        {
            key: 'total',
            label: t('total'),
            render: (value) => formatCurrency(value)
        },
        {
            key: 'action',
            label: 'Acciones',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                    {isAdmin && (
                        <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
                            onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
                            title="Editar Venta"
                        >
                            ✎
                        </button>
                    )}
                    {canDelete && (
                        <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--accent-danger)', borderColor: 'var(--accent-danger)' }}
                            onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                            title="Eliminar Venta"
                        >
                            ✕
                        </button>
                    )}
                </div>
            )
        }
    ];

    // Calculate total sales
    const totalSales = sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);

    if (isLoading) return <div style={{ padding: '20px' }}>Cargando ventas...</div>;

    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h3 style={{ color: 'var(--accent-danger)', marginBottom: '16px' }}>Error</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{error}</p>
                <button className="btn btn-primary" onClick={() => mutate('sales')}>Reintentar</button>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '600' }}>{t('title')}</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        Total ventas: <span style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>{formatCurrency(totalSales)}</span>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            setCreditNoteData({
                                type: 'monto',
                                clientId: '',
                                amount: '',
                                items: [],
                                date: formatDateLocal(),
                                description: ''
                            });
                            setShowCreditNoteModal(true);
                        }}
                    >
                        + Nota de Crédito
                    </button>
                    <button className="btn btn-primary" onClick={() => { setEditingSaleId(null); setShowModal(true); }}>
                        + {t('newSale')}
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="card-body">
                    <DataTable
                        columns={columns}
                        defaultSort={{ key: 'id', direction: 'desc' }}
                        data={sales.filter(sale => {
                            if (!searchTerm) return true;
                            const term = searchTerm.toLowerCase();
                            const clientName = (sale.clientName || getClientName(sale.clientId) || '').toLowerCase();
                            const productNames = (sale.items || []).map(i => i.productName.toLowerCase()).join(' ');
                            const id = sale.id.toString();

                            return clientName.includes(term) || productNames.includes(term) || id.includes(term);
                        })}
                    />
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingSaleId(null); }}>
                    <div className="modal" style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingSaleId ? 'Editar Venta' : t('newSale')}</h3>
                            <button className="modal-close" onClick={() => { setShowModal(false); setEditingSaleId(null); }}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">{t('client')} *</label>
                                    <select
                                        className="form-select"
                                        name="clientId"
                                        value={formData.clientId}
                                        onChange={handleInputChange}
                                        disabled={!!editingSaleId}
                                        ref={clientSelectRef}
                                        autoFocus
                                    >
                                        <option value="">Seleccionar cliente...</option>
                                        {clients.map(client => (
                                            <option key={client.id} value={client.id}>{client.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('date')}</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>

                            <div style={{
                                background: 'var(--bg-tertiary)',
                                padding: '16px',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: '16px'
                            }}>
                                <label className="form-label" style={{ marginBottom: '12px' }}>Agregar producto</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <select
                                            className="form-select"
                                            name="productId"
                                            value={formData.productId}
                                            onChange={handleInputChange}
                                        >
                                            <option value="">Producto...</option>
                                            {products.map(product => (
                                                <option key={product.id} value={product.id}>{product.description}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0, display: 'flex' }}>
                                        <input
                                            type="number"
                                            className="form-input"
                                            name="quantity"
                                            value={formData.quantity}
                                            onChange={handleInputChange}
                                            placeholder="Cant."
                                            min={0.01}
                                            step="0.0001"
                                            inputMode="decimal"
                                            list="quantity-options"
                                            style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1, minWidth: '70px' }}
                                        />
                                        <select
                                            className="form-select"
                                            name="quantityType"
                                            value={formData.quantityType}
                                            onChange={handleInputChange}
                                            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 0, width: 'auto', backgroundColor: 'var(--bg-secondary)' }}
                                        >
                                            <option value="unidades">Unidades</option>
                                            <option value="bultos">Bultos</option>
                                        </select>
                                        <datalist id="quantity-options">
                                            {Array.from({ length: 30 }, (_, i) => (i + 1) * 0.5).map(q => (
                                                <option key={q} value={q} />
                                            ))}
                                        </datalist>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <input
                                            type="number"
                                            className="form-input"
                                            name="unitPrice"
                                            value={formData.unitPrice}
                                            onChange={handleInputChange}
                                            placeholder="Precio"
                                            inputMode="decimal"
                                            style={currentDiscount?.discount ? { borderColor: 'var(--accent-success)' } : {}}
                                        />
                                    </div>

                                    <button className="btn btn-secondary" onClick={handleAddToCart}>
                                        +
                                    </button>
                                </div>

                                {/* Discount info */}
                                {currentDiscount && currentDiscount.discounts.length > 0 && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '10px',
                                        background: 'var(--bg-card)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '12px'
                                    }}>
                                        <div style={{ marginBottom: '6px', color: 'var(--text-muted)' }}>
                                            📊 Descuentos por cantidad:
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {currentDiscount.discounts.map((d, i) => {
                                                const isActive = formData.quantity >= d.minQty && (!d.maxQty || formData.quantity <= d.maxQty);
                                                return (
                                                    <span
                                                        key={i}
                                                        style={{
                                                            padding: '4px 8px',
                                                            background: isActive ? 'var(--accent-success)' : 'var(--bg-tertiary)',
                                                            color: isActive ? 'white' : 'var(--text-secondary)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            fontSize: '11px',
                                                            border: isActive ? '1px solid transparent' : '1px solid var(--border-color)'
                                                        }}
                                                    >
                                                        {d.minQty}{d.maxQty ? `-${d.maxQty}` : '+'} → {d.value === 0
                                                            ? 'Precio Base'
                                                            : d.type === 'percent'
                                                                ? `${d.value}% OFF`
                                                                : `${formatCurrency(d.value)} OFF`
                                                        }
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        {currentDiscount.discount && (
                                            <div style={{ marginTop: '8px', color: 'var(--accent-success)', fontWeight: '500' }}>
                                                ✓ Aplicado: {currentDiscount.discount.type === 'percent'
                                                    ? `${currentDiscount.discount.value}% de descuento`
                                                    : `${formatCurrency(currentDiscount.discount.value)} de descuento`}
                                                <span style={{ marginLeft: '8px', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                                                    {formatCurrency(currentDiscount.basePrice)}
                                                </span>
                                                <span style={{ marginLeft: '8px' }}>
                                                    → {formatCurrency(currentDiscount.finalPrice)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {cartItems.length > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th>Cant.</th>
                                                <th>Precio</th>
                                                <th>Dto.</th>
                                                <th>Subtotal</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cartItems.map((item, index) => (
                                                <tr key={index}>
                                                    <td>{item.productName}</td>
                                                    <td>{formatQuantity(item.quantity)}</td>
                                                    <td>
                                                        {item.discount && (
                                                            <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: '6px', fontSize: '12px' }}>
                                                                {formatCurrency(item.basePrice)}
                                                            </span>
                                                        )}
                                                        {formatCurrency(item.unitPrice)}
                                                    </td>
                                                    <td>
                                                        {item.discount ? (
                                                            <span className="badge badge-success">
                                                                {item.discount.type === 'percent' ? `${item.discount.value}%` : formatCurrency(item.discount.value)}
                                                            </span>
                                                        ) : '-'}
                                                    </td>
                                                    <td>{formatCurrency(item.total)}</td>
                                                    <td>
                                                        <button
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: 'var(--accent-danger)',
                                                                cursor: 'pointer'
                                                            }}
                                                            onClick={() => handleRemoveFromCart(index)}
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">{t('saleType')}</label>
                                <select
                                    className="form-select"
                                    name="saleType"
                                    value={formData.saleType}
                                    onChange={handleInputChange}
                                >
                                    <option value="contado">Contado</option>
                                    <option value="cc">Cuenta Corriente</option>
                                </select>
                            </div>

                            <div style={{
                                background: 'var(--bg-tertiary)',
                                padding: '16px',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <span style={{ fontWeight: '600' }}>{t('total')}</span>
                                    {cartSavings > 0 && (
                                        <div style={{ fontSize: '12px', color: 'var(--accent-success)' }}>
                                            Ahorraste: {formatCurrency(cartSavings)}
                                        </div>
                                    )}
                                </div>
                                <span style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-success)' }}>
                                    {formatCurrency(cartTotal)}
                                </span>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                {tCommon('cancel')}
                            </button>
                            <button
                                className="btn btn-success"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Guardando...' : tCommon('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Nueva Nota de Crédito */}
            {showCreditNoteModal && (
                <div className="modal-overlay" onClick={() => setShowCreditNoteModal(false)}>
                    <div className="modal" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">📉 Nueva Nota de Crédito</h3>
                            <button className="modal-close" onClick={() => setShowCreditNoteModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                Genere una Nota de Crédito para disminuir el saldo del cliente seleccionado. Esto no afecta la caja física.
                            </p>

                            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                <button
                                    className={`btn ${creditNoteData.type === 'monto' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => handleCnTypeChange('monto')}
                                    style={{ flex: 1 }}
                                >
                                    💰 Monto Libre
                                </button>
                                <button
                                    className={`btn ${creditNoteData.type === 'productos' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => handleCnTypeChange('productos')}
                                    style={{ flex: 1 }}
                                >
                                    📦 Devolución de Productos
                                </button>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Cliente *</label>
                                <select
                                    className="form-select"
                                    name="clientId"
                                    value={creditNoteData.clientId}
                                    onChange={handleCreditNoteInputChange}
                                >
                                    <option value="">Seleccionar cliente...</option>
                                    {clients.map(client => (
                                        <option key={client.id} value={client.id}>{client.name}</option>
                                    ))}
                                </select>
                            </div>

                            {creditNoteData.type === 'monto' ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Monto *</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            name="amount"
                                            placeholder="0.00"
                                            value={creditNoteData.amount}
                                            onChange={handleCreditNoteInputChange}
                                            min="0.01"
                                            step="0.01"
                                            inputMode="decimal"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Fecha</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            name="date"
                                            value={creditNoteData.date}
                                            onChange={handleCreditNoteInputChange}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Fecha</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                name="date"
                                                value={creditNoteData.date}
                                                onChange={handleCreditNoteInputChange}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Agregar Producto Devuelto</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label">Producto</label>
                                                <select
                                                    className="form-select"
                                                    value={cnProductForm.productId}
                                                    onChange={handleCnProductChange}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {products.map(product => (
                                                        <option key={product.id} value={product.id}>
                                                            {product.description}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label">Cantidad</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    name="quantity"
                                                    value={cnProductForm.quantity}
                                                    onChange={handleCnQuantityOrPriceChange}
                                                    min="0.1"
                                                    step="0.1"
                                                />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label">Precio Un.</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    name="unitPrice"
                                                    value={cnProductForm.unitPrice}
                                                    onChange={handleCnQuantityOrPriceChange}
                                                    min="0"
                                                    step="0.01"
                                                />
                                            </div>
                                            <button
                                                className="btn btn-primary"
                                                onClick={handleCnAddToCart}
                                                style={{ height: '42px', padding: '0 16px' }}
                                                disabled={!cnProductForm.productId || !creditNoteData.clientId}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    {creditNoteData.items.length > 0 && (
                                        <div className="table-responsive" style={{ marginBottom: '16px', maxHeight: '200px', overflowY: 'auto' }}>
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>Producto</th>
                                                        <th style={{ textAlign: 'right' }}>Cant.</th>
                                                        <th style={{ textAlign: 'right' }}>Precio Un.</th>
                                                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                                                        <th style={{ width: '40px' }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {creditNoteData.items.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td>{item.productName}</td>
                                                            <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                                                            <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                                            <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.total)}</td>
                                                            <td>
                                                                <button
                                                                    onClick={() => handleCnRemoveItem(idx)}
                                                                    style={{ color: 'var(--accent-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                                                    title="Eliminar"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {creditNoteData.items.length > 0 && (
                                        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: '600' }}>Total Devolución:</span>
                                            <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-success)' }}>
                                                {formatCurrency(creditNoteData.items.reduce((sum, item) => sum + item.total, 0))}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Motivo / Observación *</label>
                                <textarea
                                    className="form-input"
                                    name="description"
                                    placeholder={creditNoteData.type === 'productos' ? "Ej: Devolución de maple por mal estado..." : "Ej: Bonificación por huevos rotos..."}
                                    rows="3"
                                    value={creditNoteData.description}
                                    onChange={handleCreditNoteInputChange}
                                    style={{ resize: 'none' }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCreditNoteModal(false)} disabled={isSavingCreditNote}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveCreditNote} disabled={isSavingCreditNote}>
                                {isSavingCreditNote ? 'Guardando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Eliminación */}
            <ConfirmModal
                isOpen={!!saleToDelete}
                onClose={() => setSaleToDelete(null)}
                onConfirm={confirmDelete}
                title="¿SEGURO DESEAS ELIMINAR?"
                message="Esta acción no se puede deshacer y actualizará los saldos."
            />
        </div>
    );
}
