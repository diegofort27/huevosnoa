'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { useTranslations } from 'next-intl';
import { getSales, createSale, updateSaleDeliveryStatus, createCollection, getClients, getProducts, getPriceLists, getArqueoCategories } from '@/lib/api';
import { mockPaymentMethods, calculateDiscountedPrice } from '@/lib/mockData';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import { formatDateLocal } from '@/lib/utils';
import { useSearch } from '@/components/providers/SearchProvider';

export default function VentaRapidaPage() {
    const tCommon = useTranslations('common');
    const { profile: currentProfile } = useAuth();
    const { searchTerm } = useSearch();

    // Data SWR hooks
    const { data: clients = [], isLoading: isClientsLoading } = useSWR('clients', () => getClients());
    const { data: products = [], isLoading: isProductsLoading } = useSWR('products', () => getProducts());
    const { data: priceLists = [], isLoading: isPriceListsLoading } = useSWR('priceLists', () => getPriceLists());
    const { data: arqueoCategories = [] } = useSWR('arqueoCategories', () => getArqueoCategories());

    const isLoading = isClientsLoading || isProductsLoading || isPriceListsLoading;

    // Base VENTA price list
    const ventaPriceList = useMemo(() => {
        return priceLists.find(pl => pl.name?.toUpperCase() === 'VENTA') || priceLists[0];
    }, [priceLists]);

    // Consumidor Final default client
    const consumidorFinalClient = useMemo(() => {
        return clients.find(c => c.name.toLowerCase().includes('consumidor final') || c.name.toLowerCase().includes('mostrador')) || {
            id: 'cf',
            name: 'Consumidor Final',
            price_list_id: ventaPriceList?.id || null
        };
    }, [clients, ventaPriceList]);

    // Form state
    const [selectedClientId, setSelectedClientId] = useState('');
    const [date, setDate] = useState(formatDateLocal());
    const [payments, setPayments] = useState([{ method: 'cash', amount: '' }]);
    const [observations, setObservations] = useState('');

    // Cart items
    const [cartItems, setCartItems] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Filtered / Searched products
    const [productSearch, setProductSearch] = useState('');

    // Set default client once clients load
    useEffect(() => {
        if (!selectedClientId && clients.length > 0) {
            setSelectedClientId(consumidorFinalClient.id.toString());
        }
    }, [clients, consumidorFinalClient, selectedClientId]);

    // Active client object
    const isConsumidorFinal = !selectedClientId || selectedClientId === 'cf';
    const activeClient = useMemo(() => {
        if (isConsumidorFinal) return consumidorFinalClient;
        return clients.find(c => c.id.toString() === selectedClientId.toString()) || consumidorFinalClient;
    }, [selectedClientId, clients, consumidorFinalClient, isConsumidorFinal]);

    // Price list helper for client:
    // Uses "VENTA" list by default, and only switches if non-CF client has an assigned list
    const activePriceList = useMemo(() => {
        if (isConsumidorFinal || !activeClient?.price_list_id) {
            return ventaPriceList;
        }
        return priceLists.find(pl => pl.id === activeClient.price_list_id) || ventaPriceList;
    }, [isConsumidorFinal, activeClient, priceLists, ventaPriceList]);

    // Price calculator helper
    const getProductPriceInfo = (product, qty = 1) => {
        if (!product) return { basePrice: 0, finalUnitPrice: 0, discount: null };

        let basePrice = product.base_price || 0;
        let discounts = [];

        if (activePriceList) {
            const listProduct = (activePriceList.products || []).find(p => p.productId === product.id);
            if (listProduct) {
                basePrice = listProduct.price || basePrice;
                discounts = listProduct.discounts || [];
            }
        }

        const { finalPrice, discount } = calculateDiscountedPrice(basePrice, qty, discounts);
        return {
            basePrice,
            finalUnitPrice: finalPrice,
            discount
        };
    };

    // Recalculate cart items when active price list changes
    useEffect(() => {
        if (cartItems.length > 0 && activePriceList && products.length > 0) {
            setCartItems(prevItems => prevItems.map(item => {
                const product = products.find(p => p.id === item.productId);
                if (!product) return item;
                const priceInfo = getProductPriceInfo(product, item.quantity);
                return {
                    ...item,
                    basePrice: priceInfo.basePrice,
                    unitPrice: priceInfo.finalUnitPrice,
                    discount: priceInfo.discount ? (priceInfo.basePrice - priceInfo.finalUnitPrice) : null,
                    total: item.quantity * priceInfo.finalUnitPrice
                };
            }));
        }
    }, [activePriceList, products]);

    // Add item to cart
    const handleAddProductToCart = (product, inputQuantity = 1, qtyType = 'unidades') => {
        if (!product) return;

        const unitsPerBulk = product.units_per_bulk || 1;
        const totalUnits = qtyType === 'bultos' ? inputQuantity * unitsPerBulk : inputQuantity;

        if (isNaN(totalUnits) || totalUnits <= 0) {
            toast.warning('La cantidad debe ser mayor a 0');
            return;
        }

        // Stock validation
        const qtyAlreadyInCart = cartItems.reduce(
            (sum, item) => item.productId === product.id ? sum + item.quantity : sum, 0
        );
        const effectiveStock = parseFloat(product.current_stock || 0);
        const requestedTotal = qtyAlreadyInCart + totalUnits;

        if (!product.allow_negative_stock && effectiveStock < requestedTotal) {
            toast.error(`Stock insuficiente para "${product.description}". Stock actual: ${effectiveStock}.`);
            return;
        }

        const priceInfo = getProductPriceInfo(product, requestedTotal);

        // Check if product already exists in cart to update or push new
        const existingIndex = cartItems.findIndex(item => item.productId === product.id);

        if (existingIndex >= 0) {
            const updatedItems = [...cartItems];
            const updatedQty = updatedItems[existingIndex].quantity + totalUnits;
            const updatedPriceInfo = getProductPriceInfo(product, updatedQty);

            updatedItems[existingIndex] = {
                ...updatedItems[existingIndex],
                quantity: updatedQty,
                unitPrice: updatedPriceInfo.finalUnitPrice,
                basePrice: updatedPriceInfo.basePrice,
                discount: updatedPriceInfo.discount ? (updatedPriceInfo.basePrice - updatedPriceInfo.finalUnitPrice) : null,
                total: updatedQty * updatedPriceInfo.finalUnitPrice
            };
            setCartItems(updatedItems);
        } else {
            const newItem = {
                productId: product.id,
                productName: product.description,
                quantity: totalUnits,
                basePrice: priceInfo.basePrice,
                unitPrice: priceInfo.finalUnitPrice,
                discount: priceInfo.discount ? (priceInfo.basePrice - priceInfo.finalUnitPrice) : null,
                total: totalUnits * priceInfo.finalUnitPrice
            };
            setCartItems(prev => [...prev, newItem]);
        }

        toast.success(`+${totalUnits} ${product.description}`);
    };

    // Remove from cart
    const handleRemoveFromCart = (index) => {
        setCartItems(prev => prev.filter((_, i) => i !== index));
    };

    // Update cart item quantity
    const handleUpdateCartQuantity = (index, delta) => {
        const item = cartItems[index];
        const newQty = item.quantity + delta;

        if (newQty <= 0) {
            handleRemoveFromCart(index);
            return;
        }

        const product = products.find(p => p.id === item.productId);
        if (product && !product.allow_negative_stock && parseFloat(product.current_stock || 0) < newQty) {
            toast.error(`Stock insuficiente para "${product.description}".`);
            return;
        }

        const priceInfo = getProductPriceInfo(product, newQty);
        const updatedItems = [...cartItems];
        updatedItems[index] = {
            ...item,
            quantity: newQty,
            unitPrice: priceInfo.finalUnitPrice,
            basePrice: priceInfo.basePrice,
            discount: priceInfo.discount ? (priceInfo.basePrice - priceInfo.finalUnitPrice) : null,
            total: newQty * priceInfo.finalUnitPrice
        };
        setCartItems(updatedItems);
    };

    // Totals & Payment Calculations
    const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.total, 0), [cartItems]);
    const totalPaidInput = useMemo(() => payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0), [payments]);
    
    // Si solo hay 1 pago y amount está vacío, asumimos que salda el total.
    const effectivePaid = useMemo(() => {
        if (payments.length === 1 && payments[0].amount === '') return cartTotal;
        return totalPaidInput;
    }, [payments, totalPaidInput, cartTotal]);

    const changeAmount = effectivePaid > cartTotal ? effectivePaid - cartTotal : 0;
    const remainingToAccount = cartTotal > effectivePaid ? cartTotal - effectivePaid : 0;

    const handleAddPaymentRow = () => {
        setPayments(prev => [...prev, { method: 'cash', amount: '' }]);
    };

    const handleRemovePaymentRow = (index) => {
        if (payments.length <= 1) return;
        setPayments(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdatePayment = (index, field, value) => {
        setPayments(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    // Save Quick Sale
    const handleCompleteQuickSale = async () => {
        if (cartItems.length === 0) {
            toast.warning('Agrega al menos un producto al carrito para guardar la venta');
            return;
        }

        setIsSaving(true);

        try {
            // 1. Prepare sale object
            const isRealClient = selectedClientId && selectedClientId !== 'cf';
            const clientId = isRealClient ? parseInt(selectedClientId) : null;
            
            // Calculate total paid across all payment entries
            let totalPaid = 0;
            if (payments.length === 1 && (payments[0].amount === '' || payments[0].amount === null)) {
                totalPaid = cartTotal;
            } else {
                totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            }

            const remainingBalance = Math.max(0, cartTotal - totalPaid);

            // Validation: Consumidor Final cannot leave debt
            if (!isRealClient && remainingBalance > 0.01) {
                toast.warning('Para ventas a Consumidor Final el total debe ser saldado por completo.');
                setIsSaving(false);
                return;
            }

            const isFullyPaid = remainingBalance <= 0.01;

            const saleData = {
                clientId: clientId,
                date: date,
                items: cartItems,
                total: cartTotal,
                saleType: isFullyPaid ? 'contado' : 'cc',
                status: 'venta_rapida', // Toda venta generada en el módulo de Venta Rápida tiene status 'venta_rapida'
                isDelivered: true, // Entregada de inmediato
                userId: currentProfile?.id,
                editorId: currentProfile?.id
            };

            // 2. Create Sale
            const createdSale = await createSale(saleData);

            // 4. Create Collections (Cobranzas) for each payment entry entered
            for (const p of payments) {
                let pAmount = parseFloat(p.amount) || 0;
                if (payments.length === 1 && (p.amount === '' || p.amount === null)) {
                    pAmount = cartTotal;
                }

                if (pAmount <= 0) continue;

                let arqueoCategoryId = null;
                if (p.method === 'cash') {
                    const cat = arqueoCategories.find(c => c.name.toLowerCase().includes('efectivo'));
                    arqueoCategoryId = cat?.id;
                } else if (p.method === 'transfer' || p.method === 'mercadoPago') {
                    const cat = arqueoCategories.find(c => c.name.toLowerCase().includes('banco') || c.name.toLowerCase().includes('digital') || c.name.toLowerCase().includes('transferencia'));
                    arqueoCategoryId = cat?.id;
                }

                await createCollection({
                    clientId: clientId,
                    date: date,
                    amount: pAmount,
                    paymentMethod: p.method,
                    observations: observations ? `Venta Rápida #${createdSale.id} - ${observations}` : `Venta Rápida #${createdSale.id}`,
                    collectorId: currentProfile?.id,
                    currency: 'ARS',
                    arqueo_category_id: arqueoCategoryId,
                    editorId: currentProfile?.id
                });
            }

            if (remainingBalance > 0.01) {
                toast.success(`¡Venta Rápida #${createdSale.id} registrada! Pago parcial de $${totalPaid.toLocaleString()} y resto ($${remainingBalance.toLocaleString()}) a Cta Cte 📋`);
            } else {
                toast.success(`¡Venta Rápida #${createdSale.id} cobrada con éxito! ⚡`);
            }

            // Revalidate SWR caches
            mutate('sales');
            mutate('products');
            mutate('collections');

            // Reset form for next sale
            setCartItems([]);
            setPayments([{ method: 'cash', amount: '' }]);
            setObservations('');
            setSelectedClientId(consumidorFinalClient.id.toString());
        } catch (error) {
            console.error('Error procesando Venta Rápida:', error);
            toast.error('Ocurrió un error al procesar la Venta Rápida. Verifique los datos.');
        } finally {
            setIsSaving(false);
        }
    };

    // Filter products list
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const query = (productSearch || searchTerm || '').toLowerCase();
            const matchesQuery = p.description.toLowerCase().includes(query) || (p.code && p.code.toLowerCase().includes(query));
            return matchesQuery;
        });
    }, [products, productSearch, searchTerm]);

    return (
        <div className="pos-container fade-in">
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        <span style={{ fontSize: '1.8rem' }}>⚡</span> Venta Rápida (POS)
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
                        Registra ventas de contado, entrega y cobranza al instante en una sola pantalla.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                        type="date"
                        className="form-control"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        style={{ width: 'auto' }}
                    />
                </div>
            </div>

            <div className="pos-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
                
                {/* Left Panel: Catalog & Selection */}
                <div className="pos-catalog-panel" style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border)' }}>
                    
                    {/* Top Bar: Client & Search */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem', margin: 0 }}>👤 Cliente</label>
                                {activePriceList && (
                                    <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--primary)', background: 'var(--bg-hover)', padding: '0.1rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                        🏷️ Lista: {activePriceList.name}
                                    </span>
                                )}
                            </div>
                            <select
                                className="form-control"
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                            >
                                <option value="cf">🌐 Consumidor Final (Venta Mostrador)</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id.toString()}>
                                        {c.name} {c.sale_condition === 'cc' ? '(Cta Cte)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>🔍 Buscar Producto</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Nombre o código de producto..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Products Grid */}
                    <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {isLoading ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Cargando catálogo de productos...</div>
                        ) : filteredProducts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No se encontraron productos</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                                {filteredProducts.map(product => {
                                    const priceInfo = getProductPriceInfo(product, 1);
                                    const stock = parseFloat(product.current_stock || 0);
                                    const isLowStock = stock <= (product.min_stock || 0);

                                    return (
                                        <div
                                            key={product.id}
                                            onClick={() => handleAddProductToCart(product, 1, 'unidades')}
                                            style={{
                                                background: 'var(--bg-hover)',
                                                borderRadius: '10px',
                                                padding: '1rem',
                                                cursor: 'pointer',
                                                border: '1px solid var(--border)',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justify: 'space-between',
                                                position: 'relative'
                                            }}
                                            className="pos-product-card"
                                        >
                                            <div>
                                                <div style={{ height: '48px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {product.image && (product.image.startsWith('http://') || product.image.startsWith('https://') || product.image.startsWith('/')) ? (
                                                        <img
                                                            src={product.image}
                                                            alt={product.description}
                                                            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px' }}
                                                            onError={(e) => {
                                                                e.target.onerror = null;
                                                                e.target.style.display = 'none';
                                                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                                                            }}
                                                        />
                                                    ) : null}
                                                    <span style={{ 
                                                        fontSize: '1.75rem', 
                                                        display: (product.image && (product.image.startsWith('http://') || product.image.startsWith('https://') || product.image.startsWith('/'))) ? 'none' : 'block' 
                                                    }}>
                                                        {(!product.image || product.image.startsWith('http') || product.image.startsWith('/')) ? '📦' : product.image}
                                                    </span>
                                                </div>
                                                <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.25rem', lineHeight: '1.2' }}>
                                                    {product.description}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {product.code ? `Cód: ${product.code}` : ''}
                                                </div>
                                            </div>

                                            <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px border-dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                                <div>
                                                    <span style={{ fontSize: '0.75rem', color: isLowStock ? '#ef4444' : 'var(--text-secondary)' }}>
                                                        Stock: {stock}
                                                    </span>
                                                </div>
                                                <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--primary)' }}>
                                                    ${priceInfo.finalUnitPrice.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Cart & Checkout */}
                <div className="pos-cart-panel" style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', minHeight: '550px' }}>
                    
                    <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>🛒 Carrito</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                            {cartItems.length} {cartItems.length === 1 ? 'ítem' : 'ítems'}
                        </span>
                    </h3>

                    {/* Cart Items List */}
                    <div style={{ flex: '1', overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.25rem' }}>
                        {cartItems.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', border: '2px dashed var(--border)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛒</div>
                                Haz clic en los productos para agregarlos al carrito
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {cartItems.map((item, index) => (
                                    <div key={index} style={{ background: 'var(--bg-hover)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ flex: '1' }}>
                                            <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{item.productName}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                ${item.unitPrice.toLocaleString()} c/u
                                            </div>
                                        </div>

                                        {/* Qty controls */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0 0.5rem' }}>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '0.1rem 0.4rem', fontSize: '0.8rem', minWidth: '24px' }}
                                                onClick={() => handleUpdateCartQuantity(index, -1)}
                                            >
                                                -
                                            </button>
                                            <span style={{ fontWeight: '600', fontSize: '0.85rem', minWidth: '20px', textAlign: 'center' }}>
                                                {item.quantity}
                                            </span>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '0.1rem 0.4rem', fontSize: '0.8rem', minWidth: '24px' }}
                                                onClick={() => handleUpdateCartQuantity(index, 1)}
                                            >
                                                +
                                            </button>
                                        </div>

                                        <div style={{ textAlign: 'right', minWidth: '70px' }}>
                                            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>
                                                ${item.total.toLocaleString()}
                                            </div>
                                            <button
                                                onClick={() => handleRemoveFromCart(index)}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                                            >
                                                Quitar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Payment Details Section */}
                    <div style={{ borderTop: '2px solid var(--border)', paddingTop: '1rem' }}>
                        
                        {/* Subtotal & Total */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>TOTAL:</span>
                            <span style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)' }}>
                                ${cartTotal.toLocaleString()}
                            </span>
                        </div>

                        {/* Payment Rows Section */}
                        <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.8rem', margin: 0 }}>Forma de Cobro</label>
                                <button
                                    type="button"
                                    onClick={handleAddPaymentRow}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                                >
                                    + Agregar otro medio
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '140px', overflowY: 'auto' }}>
                                {payments.map((p, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                        <select
                                            className="form-control"
                                            value={p.method}
                                            onChange={(e) => handleUpdatePayment(idx, 'method', e.target.value)}
                                            style={{ flex: '1.2', fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}
                                        >
                                            <option value="cash">Efectivo</option>
                                            <option value="transfer">Transferencia</option>
                                            <option value="mercadoPago">Mercado Pago</option>
                                            <option value="check">Cheque</option>
                                            <option value="other">Otro</option>
                                        </select>
                                        <input
                                            type="number"
                                            className="form-control"
                                            placeholder={payments.length === 1 ? cartTotal.toString() : 'Monto'}
                                            value={p.amount}
                                            onChange={(e) => handleUpdatePayment(idx, 'amount', e.target.value)}
                                            style={{ flex: '1', fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}
                                        />
                                        {payments.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePaymentRow(idx)}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.9rem', cursor: 'pointer', padding: '0 0.2rem' }}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Summary Info (Change or Remaining Balance) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem', background: 'var(--bg-hover)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Vuelto (Efectivo)</div>
                                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: changeAmount > 0 ? '#10b981' : 'var(--text-secondary)' }}>
                                    ${changeAmount.toLocaleString()}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Resto a Cta. Cte.</div>
                                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: isConsumidorFinal && remainingToAccount > 0 ? '#ef4444' : (remainingToAccount > 0 ? '#f59e0b' : 'var(--text-secondary)') }}>
                                    {isConsumidorFinal && remainingToAccount > 0 ? '⛔ No permitido' : `$${remainingToAccount.toLocaleString()}`}
                                </div>
                            </div>
                        </div>

                        {/* Consumidor final alert message if unpaid */}
                        {isConsumidorFinal && remainingToAccount > 0 && (
                            <div style={{ fontSize: '0.75rem', color: '#ef4444', marginBottom: '0.5rem', textAlign: 'center', fontWeight: '600' }}>
                                ⚠️ Consumidor Final no admite saldo en Cta. Cte. Selecciona un cliente registrado o ingresa el cobro completo.
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            className="btn btn-primary"
                            style={{
                                width: '100%',
                                padding: '0.85rem',
                                fontSize: '1.05rem',
                                fontWeight: '700',
                                marginTop: '0.5rem',
                                borderRadius: '8px',
                                opacity: (isConsumidorFinal && remainingToAccount > 0) ? 0.5 : 1,
                                cursor: (isConsumidorFinal && remainingToAccount > 0) ? 'not-allowed' : 'pointer'
                            }}
                            disabled={isSaving || cartItems.length === 0 || (isConsumidorFinal && remainingToAccount > 0)}
                            onClick={handleCompleteQuickSale}
                        >
                            {isSaving ? 'Guardando Venta...' : '⚡ Completar Venta Rápida'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
