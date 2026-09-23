'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getPriceLists, createPriceList, updatePriceList, deletePriceList, updatePriceListItem, getProducts, updateProduct } from '@/lib/api';
import { read, utils, writeFile } from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';


export default function PreciosPage() {
    const t = useTranslations('prices');
    const tProducts = useTranslations('products');
    const tCommon = useTranslations('common');
    const [selectedListId, setSelectedListId] = useState(null);
    const [priceLists, setPriceLists] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingList, setEditingList] = useState(null);
    const [listToDelete, setListToDelete] = useState(null);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');


    // New discount form
    const [newDiscount, setNewDiscount] = useState({
        minQty: 10,
        maxQty: '',
        type: 'percent',
        value: 5
    });

    const fileInputRef = useRef(null);

    const [newListData, setNewListData] = useState({ name: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log('PreciosPage: Iniciando carga de datos...');
            const [lists, products] = await Promise.all([
                getPriceLists(),
                getProducts()
            ]);

            console.log('PreciosPage: Datos recibidos. Listas:', lists?.length, 'Productos:', products?.length);

            // Sort VENTA to top, then alphabetical
            const sortedLists = (lists || []).sort((a, b) => {
                if (a.name === 'VENTA') return -1;
                if (b.name === 'VENTA') return 1;
                return a.name.localeCompare(b.name);
            });

            setPriceLists(sortedLists);
            setAllProducts(products);

            // Select first list by default if none selected
            if (sortedLists.length > 0) {
                if (!selectedListId || !sortedLists.some(l => l.id === selectedListId)) {
                    setSelectedListId(sortedLists[0].id);
                }
            }
        } catch (error) {
            console.error('Error loading data in PreciosPage:', error);
            setError('No se pudieron cargar los precios. Esto puede deberse a una conexión lenta o un problema temporal del servidor.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0
        }).format(value);
    };

    const selectedList = priceLists.find(l => l.id === selectedListId);

    // Merge all products with the prices/discounts from the selected list
    // This ensures we show ALL products, even if they don't have a specific price entry yet (defaults needed?)
    // Actually, usually price lists might only contain some products or all. 
    // Let's assume we want to show all products and their status in this list.
    const listProductsDisplay = allProducts.map(product => {
        const item = selectedList?.products.find(p => p.productId === product.id);
        return {
            ...product, // product details (code, desc, etc)
            price: item ? item.price : product.base_price, // Fallback to base price if not set
            discounts: item ? item.discounts : [],
            isSet: !!item
        };
    });

    const filteredListProductsDisplay = listProductsDisplay.filter(item => {
        if (selectedCategory && item.category !== selectedCategory) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            if (!item.code?.toLowerCase().includes(term) && !item.description?.toLowerCase().includes(term)) {
                return false;
            }
        }
        return true;
    });

    const openDiscountModal = (productItem) => {
        setSelectedProduct(productItem);
        setShowDiscountModal(true);
    };

    const handleSaveList = async () => {
        if (!newListData.name) return;
        setIsSaving(true);
        try {
            if (editingList) {
                await updatePriceList(editingList.id, newListData.name);
            } else {
                const newList = await createPriceList(newListData.name);
                setSelectedListId(newList.id);
            }
            await loadData();
            setShowModal(false);
            setNewListData({ name: '' });
            setEditingList(null);
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar lista');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteList = (id) => {
        const list = priceLists.find(l => l.id === id);
        if (!list) return;

        if (list.name === 'VENTA') {
            toast.warning('La lista VENTA es el sistema base y no se puede eliminar.');
            return;
        }

        setListToDelete(id);
    };

    const confirmDeleteList = async () => {
        if (!listToDelete) return;
        const id = listToDelete;
        setIsLoading(true);
        try {
            await deletePriceList(id);
            await loadData();
            setListToDelete(null);
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar lista');
        } finally {
            setIsLoading(false);
        }
    };

    const openEditModal = (list) => {
        setEditingList(list);
        setNewListData({ name: list.name });
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingList(null);
        setNewListData({ name: '' });
        setShowModal(true);
    };

    const handleAddDiscount = async () => {
        if (!selectedProduct || !selectedListId) return;

        const minQty = parseFloat(newDiscount.minQty);
        const value = parseFloat(newDiscount.value);

        if (isNaN(minQty) || minQty <= 0) {
            toast.warning('Por favor ingrese una cantidad mínima válida');
            return;
        }
        if (isNaN(value) || value < 0) {
            toast.warning('Por favor ingrese un valor de descuento válido');
            return;
        }

        const newDiscountObj = {
            minQty,
            maxQty: newDiscount.maxQty ? parseFloat(newDiscount.maxQty) : null,
            type: newDiscount.type,
            value
        };

        const currentDiscounts = selectedProduct.discounts || [];
        const newDiscounts = [...currentDiscounts, newDiscountObj].sort((a, b) => a.minQty - b.minQty);

        setIsSaving(true);
        try {
            // We must save the price as well. If the item was not set in this list, we use base_price as initial price.
            const priceToSave = selectedProduct.price;

            await updatePriceListItem(
                selectedListId,
                selectedProduct.id,
                priceToSave,
                newDiscounts
            );

            await loadData();

            // Update selected product for modal view
            setSelectedProduct(prev => ({ ...prev, discounts: newDiscounts }));

            setNewDiscount({ minQty: 1, maxQty: '', type: 'fixed', value: 0 });
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar descuento: ' + (error.message || 'Error desconocido'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveDiscount = async (index) => {
        if (!selectedProduct || !selectedListId) return;

        const newDiscounts = selectedProduct.discounts.filter((_, i) => i !== index);

        setIsSaving(true);
        try {
            await updatePriceListItem(
                selectedListId,
                selectedProduct.id,
                selectedProduct.price,
                newDiscounts
            );

            await loadData();
            // Update selected product for modal view
            setSelectedProduct(prev => ({ ...prev, discounts: newDiscounts }));
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar descuento: ' + (error.message || 'Error desconocido'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportList = () => {
        if (!selectedList) return;

        const dataToExport = filteredListProductsDisplay.map(item => ({
            Código: item.code,
            Producto: item.description,
            'Precio Lista': item.price || item.base_price, // Suggested price to edit
            'Descuentos (Info)': item.discounts?.map(d =>
                `${d.minQty}${d.maxQty ? '-' + d.maxQty : '+'}: ${d.type === 'percent' ? d.value + '%' : '$' + d.value}`
            ).join(', ') || 'Sin descuentos'
        }));

        const ws = utils.json_to_sheet(dataToExport);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Precios");

        // Auto-width columns
        const wscols = [
            { wch: 15 }, // Code
            { wch: 40 }, // Description
            { wch: 15 }, // List Price
            { wch: 50 }  // Discounts
        ];
        ws['!cols'] = wscols;

        writeFile(wb, `Lista_${selectedList.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        if (!selectedList) return;

        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text(`Lista de Precios: ${selectedList.name}`, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);

        const tableColumn = ["Código", "Producto", "Precio", "Descuentos"];
        const tableRows = [];

        filteredListProductsDisplay.forEach(item => {
            const ticketData = [
                item.code,
                item.description,
                formatCurrency(item.price || item.base_price),
                item.discounts?.map(d =>
                    `${d.minQty}${d.maxQty ? '-' + d.maxQty : '+'}: ${d.type === 'percent' ? d.value + '%' : '$' + d.value}`
                ).join(', ') || '-'
            ];
            tableRows.push(ticketData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            theme: 'striped',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [66, 66, 66] }
        });

        doc.save(`Lista_${selectedList.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleDownloadTemplate = () => {
        // Create template with all products but empty prices
        const dataToExport = allProducts.map(product => ({
            Código: product.code,
            Producto: product.description,
            Costo: product.cost || 0,
            'Precio Lista': '' // Empty for template
        }));

        const ws = utils.json_to_sheet(dataToExport);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Plantilla");

        // Auto-width columns
        const wscols = [
            { wch: 15 }, // Code
            { wch: 40 }, // Description
            { wch: 15 }, // Costo
            { wch: 15 }  // Price
        ];
        ws['!cols'] = wscols;

        writeFile(wb, `Plantilla_Precios.xlsx`);
    };

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedListId) return;

        setIsLoading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = utils.sheet_to_json(worksheet);

            let updatedCount = 0;
            let errors = 0;
            let notFoundCodes = [];

            // Helper for flexible header matching
            const normalize = (s) => s?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const getVal = (row, targetNames) => {
                const keys = Object.keys(row);
                const normalizedTargets = targetNames.map(normalize);
                const foundKey = keys.find(k => normalizedTargets.includes(normalize(k)));
                return foundKey ? row[foundKey] : undefined;
            };

            // Process in parallel chunks to avoid blocking but control concurrency
            const processItem = async (row) => {
                const codeRaw = getVal(row, ['Código', 'Codigo', 'Code']);
                const priceRaw = getVal(row, ['Precio Lista', 'Precio', 'Price']);
                const costRaw = getVal(row, ['Costo', 'Cost']);
                const discountRaw = getVal(row, ['Descuentos (Info)', 'Descuentos', 'Discount']);

                if (!codeRaw || priceRaw === undefined) return;

                const code = String(codeRaw).trim();
                const newPrice = parseFloat(priceRaw);
                const newCost = costRaw !== undefined ? parseFloat(costRaw) : null;

                if (isNaN(newPrice)) return;

                const product = allProducts.find(p => String(p.code).trim() === code);
                if (!product) {
                    if (!notFoundCodes.includes(code)) notFoundCodes.push(code);
                    return;
                }

                // Find existing item configuration to preserve discounts
                const existingItem = selectedList.products.find(p => p.productId === product.id);
                const currentDiscounts = existingItem ? existingItem.discounts : [];

                let parsedDiscounts = currentDiscounts;
                if (discountRaw !== undefined) {
                    const discountStr = String(discountRaw).trim();
                    if (discountStr.toLowerCase() === 'sin descuentos' || discountStr === '-') {
                        parsedDiscounts = [];
                    } else if (discountStr !== '') {
                        const parts = discountStr.split(',').map(s => s.trim());
                        const newDiscounts = [];
                        let parseError = false;
                        for (const part of parts) {
                            // e.g. "0.01+: $5000", "10-50: 15%"
                            const match = part.match(/^([\d.]+)(?:-([\d.]+)|[+])?\s*:\s*(\$)?([\d.]+)(%)?$/);
                            if (match) {
                                const minQty = parseFloat(match[1]);
                                const maxQty = match[2] ? parseFloat(match[2]) : null;
                                const isPercent = !!match[5];
                                const type = isPercent ? 'percent' : 'fixed';
                                const value = parseFloat(match[4]);
                                newDiscounts.push({ minQty, maxQty, type, value });
                            } else {
                                parseError = true;
                                break;
                            }
                        }
                        if (!parseError) {
                            parsedDiscounts = newDiscounts.sort((a, b) => a.minQty - b.minQty);
                        }
                    }
                }

                try {
                    let costPromise = Promise.resolve();
                    if (newCost !== null && !isNaN(newCost) && newCost !== parseFloat(product.cost || 0)) {
                        costPromise = updateProduct(product.id, { cost: newCost });
                    }

                    await Promise.all([
                        updatePriceListItem(
                            selectedListId,
                            product.id,
                            newPrice,
                            parsedDiscounts
                        ),
                        costPromise
                    ]);
                    updatedCount++;
                } catch (err) {
                    console.error(`Error updating product ${code}:`, err);
                    errors++;
                }
            };

            // Use Promise.all for all items
            await Promise.all(jsonData.map(row => processItem(row)));

            await loadData();

            let message = `Importación completada.\nActualizados: ${updatedCount}`;
            if (errors > 0) message += `\nErrores: ${errors}`;
            if (notFoundCodes.length > 0) {
                message += `\n\nCódigos no encontrados (${notFoundCodes.length}): ${notFoundCodes.slice(0, 5).join(', ')}${notFoundCodes.length > 5 ? '...' : ''}`;
            }
            toast.success(message);

        } catch (error) {
            console.error('Error importing file:', error);
            toast.error('Error al leer el archivo Excel');
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (isLoading && priceLists.length === 0) {
        return (
            <div style={{ padding: '60px', textAlign: 'center' }}>
                <div className="spinner" style={{ marginBottom: '16px', margin: '0 auto' }}></div>
                <p style={{ color: 'var(--text-muted)' }}>Cargando listas de precios...</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Si tarda demasiado, intenta recargar la página.</p>
            </div>
        );
    }

    if (error && priceLists.length === 0) {
        return (
            <div style={{ padding: '60px', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
                <h3 style={{ color: 'var(--accent-danger)', marginBottom: '16px' }}>Error al cargar</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                    {error}
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button className="btn btn-primary" onClick={loadData}>
                        🔄 Reintentar ahora
                    </button>
                    <button className="btn btn-secondary" onClick={() => window.location.reload()}>
                        🌐 Recargar página
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Listas de Precios</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".xlsx, .xls"
                        onChange={handleFileChange}
                    />
                    <button className="btn btn-secondary" onClick={handleDownloadTemplate} title="Descargar plantilla vacía para completar">
                        📄 Plantilla
                    </button>
                    <button className="btn btn-secondary" onClick={handleExportPDF} disabled={!selectedListId} title="Exportar a PDF">
                        📄 Exportar PDF
                    </button>
                    <button className="btn btn-secondary" onClick={handleExportList} disabled={!selectedListId} title="Exportar precios actuales">
                        📥 Exportar Excel
                    </button>
                    <button className="btn btn-secondary" onClick={handleImportClick} disabled={!selectedListId}>
                        📤 Importar Excel
                    </button>
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        + Nueva Lista
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
                {/* Price Lists */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Listas</h3>
                    </div>
                    <div>
                        {priceLists.map(list => (
                            <div
                                key={list.id}
                                onClick={() => setSelectedListId(list.id)}
                                className="sidebar-item"
                                style={{
                                    padding: '16px 20px',
                                    borderBottom: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    background: selectedListId === list.id ? 'var(--bg-hover)' : 'transparent',
                                    transition: 'all var(--transition-fast)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {list.name === 'VENTA' && <span>⭐</span>}
                                    <span style={{ fontWeight: '500' }}>{list.name}</span>
                                </div>

                                <div className="item-actions" style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        className="btn-icon"
                                        onClick={(e) => { e.stopPropagation(); openEditModal(list); }}
                                        title="Editar nombre"
                                    >
                                        ✏️
                                    </button>
                                    {list.name !== 'VENTA' && (
                                        <button
                                            className="btn-icon"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                                            title="Eliminar lista"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Price Details */}
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 className="card-title" style={{ margin: 0 }}>{selectedList?.name || 'Seleccione una lista'}</h3>

                        {selectedList && (
                            <div style={{ display: 'flex', gap: '10px', flex: 1, justifyContent: 'flex-end' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="🔍 Buscar código o nombre..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ maxWidth: '250px' }}
                                />
                                <select
                                    className="form-select"
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    style={{ maxWidth: '200px' }}
                                >
                                    <option value="">Todas las categorías</option>
                                    {[...new Set(allProducts.map(p => p.category).filter(Boolean))].sort().map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="card-body">
                        {selectedList ? (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>{tProducts('code')}</th>
                                        <th>{tProducts('description')}</th>
                                        <th>Costo</th>
                                        <th>Precio</th>
                                        <th>Descuentos por Cantidad</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredListProductsDisplay.map((item, index) => {
                                        const hasDiscounts = item.discounts && item.discounts.length > 0;

                                        return (
                                            <tr key={index}>
                                                <td>{item.code}</td>
                                                <td>
                                                    <div className="product-row">
                                                        <div className="product-image">
                                                            {item.image && (item.image.startsWith('http://') || item.image.startsWith('https://') || item.image.startsWith('/')) ? (
                                                                <img 
                                                                    src={item.image} 
                                                                    alt={item.description} 
                                                                    onError={(e) => {
                                                                        e.target.onerror = null;
                                                                        e.target.style.display = 'none';
                                                                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline';
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <span style={{ display: (item.image && (item.image.startsWith('http://') || item.image.startsWith('https://') || item.image.startsWith('/'))) ? 'none' : 'inline' }}>
                                                                {(!item.image || item.image.startsWith('http') || item.image.startsWith('/')) ? '🥚' : item.image}
                                                            </span>
                                                        </div>
                                                        <span className="product-name">{item.description}</span>
                                                    </div>
                                                </td>
                                                <td style={{ color: 'var(--text-muted)' }}>
                                                    {formatCurrency(item.cost || 0)}
                                                </td>
                                                <td style={{ fontWeight: '600', color: 'var(--accent-success)' }}>
                                                    {formatCurrency(item.price)}
                                                </td>
                                                <td>
                                                    {hasDiscounts ? (
                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                            {item.discounts.map((d, i) => (
                                                                <span
                                                                    key={i}
                                                                    className="badge badge-info"
                                                                    style={{ fontSize: '11px' }}
                                                                >
                                                                    {d.minQty}{d.maxQty ? `-${d.maxQty}` : '+'} → {d.type === 'percent' ? `${d.value}%` : formatCurrency(d.value)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                                            Sin descuentos
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ padding: '6px 12px', fontSize: '12px' }}
                                                        onClick={() => openDiscountModal(item)}
                                                    >
                                                        ⚙️ Descuentos
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Seleccione una lista para ver precios
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* New List Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingList ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nombre de la lista</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej: Lista Premium"
                                    value={newListData.name}
                                    onChange={(e) => setNewListData({ name: e.target.value })}
                                    disabled={isSaving}
                                />
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                Después de crear la lista, podrás agregar productos y configurar precios y descuentos.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={isSaving}>
                                {tCommon('cancel')}
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveList} disabled={isSaving}>
                                {isSaving ? 'Guardando...' : editingList ? 'Guardar Cambios' : 'Crear Lista'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Discount Management Modal */}
            {showDiscountModal && selectedProduct && (
                <div className="modal-overlay" onClick={() => setShowDiscountModal(false)}>
                    <div className="modal" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                Descuentos: {selectedProduct.description}
                            </h3>
                            <button className="modal-close" onClick={() => setShowDiscountModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: '20px' }}>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    Precio en esta lista: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(selectedProduct.price)}</strong>
                                </p>
                            </div>

                            {/* Current discounts */}
                            <div style={{ marginBottom: '20px' }}>
                                <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Descuentos actuales</h4>
                                {selectedProduct.discounts && selectedProduct.discounts.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {selectedProduct.discounts.map((d, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '10px 14px',
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-md)'
                                                }}
                                            >
                                                <div>
                                                    <span style={{ fontWeight: '500' }}>
                                                        {d.minQty} {d.maxQty ? `a ${d.maxQty}` : 'en adelante'} unidades
                                                    </span>
                                                    <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>→</span>
                                                    <span className="badge badge-success">
                                                        {d.value === 0
                                                            ? 'Precio Base'
                                                            : d.type === 'percent'
                                                                ? `${d.value}% de descuento`
                                                                : `${formatCurrency(d.value)} de descuento`
                                                        }
                                                    </span>
                                                </div>
                                                <button
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'var(--accent-danger)',
                                                        cursor: isSaving ? 'not-allowed' : 'pointer',
                                                        padding: '4px 8px',
                                                        opacity: isSaving ? 0.5 : 1
                                                    }}
                                                    onClick={() => !isSaving && handleRemoveDiscount(i)}
                                                    disabled={isSaving}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                        No hay descuentos configurados para este producto.
                                    </p>
                                )}
                            </div>

                            {/* Add new discount */}
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                padding: '16px',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Agregar rango de descuento</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label" style={{ fontSize: '12px' }}>Desde (cant.)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={newDiscount.minQty}
                                            onChange={(e) => setNewDiscount(prev => ({ ...prev, minQty: e.target.value }))}
                                            min={0.0001}
                                            step="any"
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label" style={{ fontSize: '12px' }}>Hasta (opcional)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={newDiscount.maxQty}
                                            onChange={(e) => setNewDiscount(prev => ({ ...prev, maxQty: e.target.value }))}
                                            min={0.0001}
                                            step="any"
                                            placeholder="∞"
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label" style={{ fontSize: '12px' }}>Tipo</label>
                                        <select
                                            className="form-select"
                                            value={newDiscount.type}
                                            onChange={(e) => setNewDiscount(prev => ({ ...prev, type: e.target.value }))}
                                        >
                                            <option value="percent">Porcentaje %</option>
                                            <option value="fixed">Monto fijo $</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label" style={{ fontSize: '12px' }}>Descuento</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={newDiscount.value}
                                            onChange={(e) => setNewDiscount(prev => ({ ...prev, value: e.target.value }))}
                                            min={0}
                                        />
                                    </div>
                                    <button
                                        className="btn btn-success"
                                        onClick={handleAddDiscount}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? '...' : '+'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={() => setShowDiscountModal(false)}>
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Confirmación de Eliminación de Lista */}
            <ConfirmModal
                isOpen={!!listToDelete}
                onClose={() => setListToDelete(null)}
                onConfirm={confirmDeleteList}
                title="¿SEGURO DESEAS ELIMINAR?"
                message="Los clientes asociados a esta lista serán reasignados automáticamente a la lista 'VENTA'."
            />
        </div>
    );
}
