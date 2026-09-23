'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import DataTable from '@/components/ui/DataTable';
import { getSales, getZones, updateSaleDeliveryStatus, updateSale, deleteSale, getProducts, getPriceLists, getClients } from '@/lib/api';
import { calculateDiscountedPrice, getCurrentWeekRange, getGoogleMapsLink } from '@/lib/utils';
import { useSearch } from '@/components/providers/SearchProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';

export default function RepartoPage() {
    const tCommon = useTranslations('common');
    const { searchTerm } = useSearch();
    const { hasPermission, profile } = useAuth();
    
    const isAdmin = profile?.role === 'admin';
    const canConfirm = isAdmin || hasPermission('delivery.confirm');
    const canEdit = isAdmin || hasPermission('delivery.edit');

    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

    const [sales, setSales] = useState([]);
    const [zones, setZones] = useState([]);
    const [products, setProducts] = useState([]);
    const [clients, setClients] = useState([]);
    const [priceLists, setPriceLists] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSales, setSelectedSales] = useState([]);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState(null);

    // Filtered range state (null means current week)
    const [activeRange, setActiveRange] = useState(null);
    const [showOnlyPending, setShowOnlyPending] = useState(true);

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingSale, setEditingSale] = useState(null);
    const [editCart, setEditCart] = useState([]);
    const [newProduct, setNewProduct] = useState({ productId: '', quantity: 1, unitPrice: 0 });
    const [saleToDelete, setSaleToDelete] = useState(null);


    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log('RepartoPage: Cargando datos iniciales...');
            const [zonesData, productsData, listsData, clientsData, salesData] = await Promise.all([
                getZones(),
                getProducts(),
                getPriceLists(),
                getClients(),
                getSales()
            ]);
            setZones(zonesData);
            setProducts(productsData);
            setPriceLists(listsData);
            setClients(clientsData);
            setSales(salesData);

            // Default to today
            setActiveRange([new Date().toISOString().split('T')[0]]);
            setIsDataLoaded(true);
        } catch (error) {
            console.error('Error loading initial data in RepartoPage:', error);
            setError('Error de conexión al cargar la hoja de ruta. Revisa tu conexión.');
        } finally {
            setIsLoading(false);
        }
    };

    const loadFilteredOrders = async () => {
        if (!fromDate || !toDate) {
            toast.warning('Por favor seleccione ambas fechas');
            return;
        }
        setIsLoading(true);
        try {
            const salesData = await getSales();
            setSales(salesData);
            
            // Generar rango de fechas
            const range = [];
            let current = new Date(fromDate + 'T12:00:00'); // Use noon to avoid timezone shifts
            const end = new Date(toDate + 'T12:00:00');
            
            while (current <= end) {
                range.push(current.toISOString().split('T')[0]);
                current.setDate(current.getDate() + 1);
            }

            setActiveRange(range);
            setIsDataLoaded(true);
        } catch (error) {
            console.error('Error loading sales:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleThisWeek = () => {
        const week = getCurrentWeekRange();
        if (week.length > 0) {
            setFromDate(week[0]);
            setToDate(week[week.length - 1]);
            setActiveRange(week);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0
        }).format(value);
    };

    const formatQuantity = (value) => {
        return Number(value).toLocaleString('es-AR', {
            maximumFractionDigits: 4,
            minimumFractionDigits: 0
        });
    };

    // Filtered sales
    const filteredSales = sales.filter(s =>
        activeRange ? activeRange.includes(s.date) : true
    ).filter(s => s.status !== 'cancelled');

    const pendingDeliveries = filteredSales.filter(s => !s.isDelivered);

    const handleSelectSale = (id) => {
        setSelectedSales(prev =>
            prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (dateSales) => {
        const datePendingIds = dateSales.filter(s => !s.isDelivered).map(s => s.id);
        const allSelectedInDate = datePendingIds.every(id => selectedSales.includes(id));

        if (allSelectedInDate) {
            setSelectedSales(prev => prev.filter(id => !datePendingIds.includes(id)));
        } else {
            setSelectedSales(prev => [...new Set([...prev, ...datePendingIds])]);
        }
    };

    const handleConfirmDeliveries = async () => {
        if (selectedSales.length === 0) return;

        setIsUpdating(true);
        try {
            await updateSaleDeliveryStatus(selectedSales, true);
            const salesData = await getSales();
            setSales(salesData);
            setSelectedSales([]);
            toast.success('Pedidos confirmados e impacto en cuenta corriente realizado.');
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Error al confirmar entregas.');
        } finally {
            setIsUpdating(false);
        }
    };

    const getZoneName = (zoneId) => {
        return zones.find(z => z.id === zoneId)?.name || '-';
    };

    // --- Edit Logic ---
    const handleOpenEdit = (sale) => {
        setEditingSale(sale);
        setEditCart(sale.items.map(i => ({
            ...i,
            // Add a temporary unique ID for stable keys
            tempId: Math.random().toString(36).substr(2, 9),
            productId: i.productId || products.find(p => p.description === i.productName)?.id,
            total: i.quantity * i.unitPrice
        })));
        setShowEditModal(true);
    };

    const handleAddToCart = () => {
        if (!newProduct.productId || newProduct.quantity <= 0) return;
        const product = products.find(p => p.id === parseInt(newProduct.productId));
        const newItem = {
            tempId: Math.random().toString(36).substr(2, 9),
            productId: product.id,
            productName: product.description,
            quantity: parseInt(newProduct.quantity),
            unitPrice: parseFloat(newProduct.unitPrice),
            total: parseInt(newProduct.quantity) * parseFloat(newProduct.unitPrice)
        };
        setEditCart(prev => [...prev, newItem]);
        setNewProduct({ productId: '', quantity: 1, unitPrice: 0 });
    };

    const handleRemoveFromCart = (tempId) => {
        setEditCart(prev => prev.filter(item => item.tempId !== tempId));
    };

    const handleSaveEdit = async () => {
        const total = editCart.reduce((sum, i) => sum + i.total, 0);
        try {
            await updateSale(editingSale.id, {
                ...editingSale,
                items: editCart,
                total: total
            });
            setShowEditModal(false);
            const salesData = await getSales();
            setSales(salesData);
        } catch (error) {
            toast.error('Error al guardar cambios');
        }
    };

    const handleVoidSale = () => {
        setSaleToDelete(editingSale.id);
    };

    const confirmVoidSale = async () => {
        if (!saleToDelete) return;
        try {
            await deleteSale(saleToDelete);
            setShowEditModal(false);
            setSaleToDelete(null);
            const salesData = await getSales();
            setSales(salesData);
        } catch (error) {
            toast.error('Error al anular pedido');
        }
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const title = "Hoja de Ruta de Reparto";
        
        let firstPage = true;

        sortedDates.forEach((date) => {
            if (!firstPage) doc.addPage();
            firstPage = false;

            doc.setFontSize(16);
            doc.setTextColor(44, 62, 80);
            doc.text(`${title}`, 14, 15);
            doc.setFontSize(12);
            doc.text(`Fecha de Reparto: ${date}`, 14, 22);

            // Calculate totals for this date
            const totals = {};
            groupedSales[date].forEach(sale => {
                (sale.items || []).forEach(item => {
                    const name = item.productName;
                    totals[name] = (totals[name] || 0) + item.quantity;
                });
            });

            // Render totals in top right
            doc.setFontSize(9);
            doc.setTextColor(63, 81, 181); // Indigo
            let summaryY = 12;
            const summaryX = 196;
            
            doc.setFont(undefined, 'bold');
            const headerText = "TOTAL CARGA:";
            doc.text(headerText, summaryX - doc.getTextWidth(headerText), summaryY);
            doc.setFont(undefined, 'normal');
            summaryY += 4;

            Object.entries(totals).sort().forEach(([name, qty]) => {
                const text = `${formatQuantity(qty)} x ${name}`;
                doc.text(text, summaryX - doc.getTextWidth(text), summaryY);
                summaryY += 4;
            });

            const tableData = groupedSales[date].map(sale => {
                const client = clients.find(c => c.id === sale.clientId);
                const hasMap = client?.google_maps_url || client?.address;
                return [
                    sale.clientName,
                    hasMap ? ' ' : '-',
                    getZoneName(sale.zoneId),
                    (sale.items || []).map(i => `${formatQuantity(i.quantity)} x ${i.productName}`).join('\n'),
                    formatCurrency(sale.total)
                ];
            });

            autoTable(doc, {
                startY: 35,
                head: [['Cliente', 'Ubicación', 'Zona', 'Detalle de Artículos', 'Monto']],
                body: tableData,
                headStyles: { fillColor: [63, 81, 181], textColor: 255 },
                styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
                columnStyles: {
                    1: { halign: 'center', cellWidth: 20 }, // Ubicación centered
                    3: { cellWidth: 60 }, // Detalle column
                    4: { halign: 'right' } // Monto right aligned
                },
                didDrawCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1 && data.cell.text[0] !== '-') {
                        const sale = groupedSales[date][data.row.index];
                        const client = clients.find(c => c.id === sale.clientId);
                        const mapLocation = client?.google_maps_url || client?.address;
                        if (mapLocation) {
                            // Dibujar un pin rojo manualmente (círculo + triángulo)
                            const x = data.cell.x + data.cell.width / 2;
                            const y = data.cell.y + 4; // Ajustado para centrar verticalmente
                            
                            doc.setFillColor(231, 76, 60); // Rojo
                            doc.circle(x, y, 2, 'F');
                            doc.triangle(x - 2, y + 0.8, x + 2, y + 0.8, x, y + 5, 'F');
                            
                            // Punto blanco en el centro del pin para más detalle
                            doc.setFillColor(255, 255, 255);
                            doc.circle(x, y, 0.8, 'F');
                            
                            doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { 
                                url: getGoogleMapsLink(mapLocation) 
                            });
                        }
                    }
                }
            });
        });

        doc.save(`hoja_de_ruta_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const columns = [
        {
            key: 'selection',
            label: '', // Generic label because select all is handled per date
            render: (value, row) => (
                <div className="no-print">
                    {(!row.isDelivered && canConfirm) && (
                        <input
                            type="checkbox"
                            checked={selectedSales.includes(row.id)}
                            onChange={() => handleSelectSale(row.id)}
                        />
                    )}
                </div>
            )
        },
        { key: 'clientName', label: 'Cliente' },
        {
            key: 'zoneId',
            label: 'Zona',
            render: (val) => getZoneName(val)
        },
        {
            key: 'items',
            label: 'Detalle de Artículos',
            render: (items) => (
                <div style={{ fontSize: '12px' }}>
                    {items && items.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {items.map((item, idx) => (
                                <li key={idx} style={{ marginBottom: '2px' }}>
                                    <strong>{formatQuantity(item.quantity)}</strong> x {item.productName}
                                </li>
                            ))}
                        </ul>
                    ) : '-'}
                </div>
            )
        },
        {
            key: 'total',
            label: 'Monto',
            render: (val) => formatCurrency(val)
        },
        {
            key: 'action',
            label: <span className="no-print">Acción</span>,
            render: (val, row) => (
                <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
                    {!row.isDelivered ? (
                        <>
                            {canConfirm && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '11px', padding: '4px 8px' }}
                                    onClick={async () => {
                                        await updateSaleDeliveryStatus([row.id], true);
                                        const salesData = await getSales();
                                        setSales(salesData);
                                    }}
                                >
                                    Confirmar
                                </button>
                            )}
                            {canEdit && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--accent-primary)' }}
                                    onClick={() => handleOpenEdit(row)}
                                >
                                    ✏️
                                </button>
                            )}
                        </>
                    ) : (
                        <span className="badge badge-success">Entregado</span>
                    )}
                </div>
            )
        }
    ];

    // Group sales by date
    const groupedSales = (showOnlyPending
        ? [...new Set(sales.filter(s => !s.isDelivered && s.status !== 'cancelled').map(s => s.date))]
        : (activeRange || [])
    ).reduce((acc, date) => {
        let salesInDate = sales.filter(s => s.date === date && s.status !== 'cancelled');
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            salesInDate = salesInDate.filter(s => 
                s.clientName?.toLowerCase().includes(term) ||
                (s.items || []).some(i => i.productName?.toLowerCase().includes(term)) ||
                getZoneName(s.zoneId).toLowerCase().includes(term)
            );
        }

        if (showOnlyPending) {
            salesInDate = salesInDate.filter(s => !s.isDelivered);
        }

        if (salesInDate.length > 0) {
            // Sort by ID descending (newest first)
            acc[date] = salesInDate.sort((a, b) => b.id - a.id);
        }
        return acc;
    }, {});

    const sortedDates = Object.keys(groupedSales).sort((a, b) => b.localeCompare(a));

    if (isLoading && !isDataLoaded) return (
        <div style={{ padding: '60px', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
            <p style={{ color: 'var(--text-muted)' }}>Cargando Hoja de Ruta...</p>
        </div>
    );

    if (error && !isDataLoaded) return (
        <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
            <h3 style={{ color: 'var(--accent-danger)' }}>Error de Carga</h3>
            <p style={{ margin: '16px 0 24px', color: 'var(--text-secondary)' }}>{error}</p>
            <button className="btn btn-primary" onClick={loadInitialData}>
                Reintentar Carga
            </button>
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Hoja de Ruta de Reparto</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        {activeRange && activeRange.length > 1
                            ? `Vista semanal: ${activeRange[0]} al ${activeRange[activeRange.length - 1]}`
                            : 'Vista diaria personalizada'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }} className="no-print">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: 'var(--radius-md)' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Desde:</label>
                        <input
                            type="date"
                            className="form-input"
                            style={{ width: 'auto', padding: '4px 8px', height: '32px' }}
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hasta:</label>
                        <input
                            type="date"
                            className="form-input"
                            style={{ width: 'auto', padding: '4px 8px', height: '32px' }}
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={loadFilteredOrders}>
                        🔍 Filtrar Rango
                    </button>
                    <button className="btn btn-secondary" onClick={handleThisWeek}>
                        📅 Esta Semana
                    </button>
                    <button className="btn btn-secondary" onClick={handleDownloadPDF}>
                        📥 Descargar PDF
                    </button>
                    <button
                        className={`btn ${showOnlyPending ? 'btn-success' : 'btn-outline'}`}
                        onClick={() => setShowOnlyPending(!showOnlyPending)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {showOnlyPending ? '✅ Solo Pendientes' : '📦 Mostrar Todos'}
                    </button>
                </div>
            </div>

            {selectedSales.length > 0 && (
                <div className="no-print" style={{
                    position: 'sticky',
                    top: '20px',
                    zIndex: 10,
                    background: 'var(--bg-card)',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    marginBottom: '24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderLeft: '4px solid var(--accent-success)'
                }}>
                    <div>
                        <span style={{ fontWeight: '600' }}>{selectedSales.length} pedidos seleccionados</span>
                    </div>
                    <button
                        className="btn btn-success"
                        onClick={handleConfirmDeliveries}
                        disabled={isUpdating}
                    >
                        Confirmar Entregas e Impactar Saldo
                    </button>
                </div>
            )}

            {sortedDates.length > 0 ? (
                sortedDates.map(date => (
                    <div key={date} style={{ marginBottom: '32px' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px',
                            background: 'var(--bg-tertiary)',
                            padding: '12px 16px',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: 'var(--accent-primary)' }}>📅</span> {date}
                            </h3>
                            {canConfirm && (
                                <button
                                    className="btn btn-outline no-print"
                                    style={{ fontSize: '11px', padding: '4px 12px' }}
                                    onClick={() => handleSelectAll(groupedSales[date])}
                                >
                                    Seleccionar Todos
                                </button>
                            )}
                        </div>
                        <div className="card">
                            <div className="card-body">
                                <DataTable
                                    columns={columns}
                                    data={groupedSales[date]}
                                />
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div style={{
                    padding: '80px 40px',
                    textAlign: 'center',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px dashed var(--border-color)',
                    color: 'var(--text-muted)'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
                    <h3>No hay pedidos para este periodo</h3>
                    <p>Usa los filtros superiores para buscar otras fechas.</p>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Modificar Pedido: {editingSale.clientName}</h3>
                            <button type="button" className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: '16px' }}>
                                <label className="form-label">Productos en Pedido</label>
                                <table className="table" style={{ fontSize: '13px' }}>
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th>Cant.</th>
                                            <th>Precio</th>
                                            <th>Total</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {editCart.map((item) => (
                                            <tr key={item.tempId}>
                                                <td>{item.productName}</td>
                                                <td>{formatQuantity(item.quantity)}</td>
                                                <td>{formatCurrency(item.unitPrice)}</td>
                                                <td>{formatCurrency(item.total)}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFromCart(item.tempId)}
                                                        style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}
                                                    >
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label" style={{ fontSize: '11px' }}>Agregar Producto</label>
                                        <select
                                            className="form-select"
                                            value={newProduct.productId}
                                            onChange={(e) => setNewProduct({ ...newProduct, productId: e.target.value })}
                                        >
                                            <option value="">Seleccionar...</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.description}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="Cant"
                                            value={newProduct.quantity}
                                            onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="Precio"
                                            value={newProduct.unitPrice}
                                            onChange={(e) => setNewProduct({ ...newProduct, unitPrice: e.target.value })}
                                        />
                                    </div>
                                    <button type="button" className="btn btn-secondary" onClick={handleAddToCart}>+</button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                <strong>Nuevo Total:</strong>
                                <span style={{ fontSize: '20px', color: 'var(--accent-success)' }}>
                                    {formatCurrency(editCart.reduce((sum, i) => sum + i.total, 0))}
                                </span>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <button type="button" className="btn btn-danger" onClick={handleVoidSale}>ANULAR PEDIDO</button>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancelar</button>
                                <button type="button" className="btn btn-success" onClick={handleSaveEdit}>Guardar Cambios</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .card { border: none !important; margin-bottom: 20px !important; }
                    .table th { background: #f0f0f0 !important; }
                }
            `}</style>
            {/* Modal de Confirmación de Anulación de Pedido */}
            <ConfirmModal
                isOpen={!!saleToDelete}
                onClose={() => setSaleToDelete(null)}
                onConfirm={confirmVoidSale}
                title="¿SEGURO DESEAS ELIMINAR?"
                message="Esta acción anulará el pedido y revertirá el impacto en cuenta corriente si ya fue entregado."
            />
        </div>
    );
}
