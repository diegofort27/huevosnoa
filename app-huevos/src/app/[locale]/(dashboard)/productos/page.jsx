'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import DataTable from '@/components/ui/DataTable';
import { getProducts, createProduct, updateProduct, uploadProductImage, schedulePriceChange, deleteProduct } from '@/lib/api';
import { useSearch } from '@/components/providers/SearchProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProductosPage() {
    const t = useTranslations('products');
    const tCommon = useTranslations('common');
    const { profile } = useAuth();
    const canDelete = profile?.role === 'admin' || profile?.permissions?.['products.delete'] === true;
    const [showModal, setShowModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);

    const [error, setError] = useState(null);
    const { searchTerm } = useSearch();
    const [selectedCategory, setSelectedCategory] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const imageInputRef = useRef(null);
    const marginRef = useRef(1);

    // Form state
    const [formData, setFormData] = useState({
        code: '',
        description: '',
        unit: 'bandeja',
        currentStock: 0,
        minStock: 0,
        cost: 0,
        basePrice: 0,
        image: '🥚',
        allowNegativeStock: false,
        category: '',
        vigenciaTipo: 'inmediata',
        vigenciaFecha: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getProducts();
            setProducts(data);
        } catch (error) {
            console.error('Error loading products:', error);
            setError('No se pudieron cargar los productos. Por favor verifique su conexión.');
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

    // ... (rest of methods)

    if (isLoading) {
        return <div style={{ padding: '20px' }}>Cargando productos...</div>;
    }

    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h3 style={{ color: 'var(--accent-danger)', marginBottom: '16px' }}>Error</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{error}</p>
                <button className="btn btn-primary" onClick={loadData}>Reintentar</button>
            </div>
        );
    }

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        
        setFormData(prev => {
            const updated = { ...prev, [name]: newValue };
            
            if (name === 'basePrice') {
                const currentCost = parseFloat(prev.cost);
                const newPrice = parseFloat(newValue);
                if (!isNaN(currentCost) && currentCost > 0 && !isNaN(newPrice)) {
                    marginRef.current = newPrice / currentCost;
                }
            }
            
            if (name === 'cost') {
                const newCost = parseFloat(newValue);
                if (!isNaN(newCost)) {
                    updated.basePrice = Math.round(newCost * marginRef.current);
                } else {
                    updated.basePrice = 0;
                }
            }
            
            return updated;
        });
    };

    const openModal = (product = null) => {
        if (product) {
            setSelectedProduct(product);
            marginRef.current = (product.cost > 0 && product.base_price > 0) ? (product.base_price / product.cost) : 1;
            setFormData({
                code: product.code,
                description: product.description,
                unit: product.unit,
                currentStock: product.current_stock || 0,
                minStock: product.min_stock || 0,
                cost: product.cost || 0,
                basePrice: product.base_price || 0,
                image: product.image || '🥚',
                allowNegativeStock: product.allow_negative_stock || false,
                category: product.category || '',
                vigenciaTipo: 'inmediata',
                vigenciaFecha: ''
            });
        } else {
            setSelectedProduct(null);
            marginRef.current = 1;
            setFormData({
                code: '',
                description: '',
                unit: 'bandeja',
                currentStock: 0,
                minStock: 0,
                cost: 0,
                basePrice: 0,
                image: '🥚',
                allowNegativeStock: false,
                category: '',
                vigenciaTipo: 'inmediata',
                vigenciaFecha: ''
            });
        }
        setImageFile(null);
        setImagePreview(product?.image?.startsWith('http') ? product.image : null);
        setShowModal(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!formData.code || !formData.description) {
            toast.error('Por favor complete código y descripción');
            return;
        }

        if (formData.vigenciaTipo === 'programada' && !formData.vigenciaFecha) {
            toast.error('Por favor seleccione una fecha y hora para la vigencia programada');
            return;
        }

        setIsSaving(true);
        try {
            // Robust parsing helper
            const parseNum = (val) => {
                if (val === null || val === undefined) return 0;
                // Remove dots (common thousand separators) and replace comma with dot
                let cleanVal = String(val).replace(/\./g, '').replace(/,/g, '.');
                const n = parseFloat(cleanVal);
                return isNaN(n) ? 0 : n;
            };

            let imageUrl = formData.image || '🥚';
            if (imageFile) {
                imageUrl = await uploadProductImage(imageFile);
            }

            const productData = {
                code: formData.code,
                description: formData.description,
                unit: formData.unit,
                current_stock: Math.round(parseNum(formData.currentStock)),
                min_stock: Math.round(parseNum(formData.minStock)),
                cost: parseNum(formData.cost),
                base_price: parseNum(formData.basePrice),
                image: imageUrl,
                allow_negative_stock: formData.allowNegativeStock,
                category: formData.category
            };

            console.log('Productos: Guardando datos...', productData);

            if (selectedProduct) {
                console.log(`Productos: Actualizando ID ${selectedProduct.id}`);
                
                if (formData.vigenciaTipo === 'programada' && formData.vigenciaFecha) {
                    await schedulePriceChange(
                        Number(selectedProduct.id), 
                        productData.cost, 
                        productData.base_price, 
                        new Date(formData.vigenciaFecha).toISOString()
                    );
                    
                    const otherData = { ...productData };
                    delete otherData.cost;
                    delete otherData.base_price;
                    await updateProduct(Number(selectedProduct.id), otherData);
                    
                    toast.success('Producto actualizado y cambio de precio programado con éxito');
                } else {
                    await updateProduct(Number(selectedProduct.id), productData);
                    toast.success('Producto actualizado con éxito');
                }
            } else {
                console.log('Productos: Creando nuevo producto');
                await createProduct(productData);
                toast.success('Producto creado con éxito');
            }

            setShowModal(false);
            await loadData();
        } catch (error) {
            console.error('Error saving product:', error);
            const errorMsg = error.message || error.details || 'Error desconocido';
            toast.error(`Error al guardar producto: ${errorMsg}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current.click();
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const workbook = XLSX.read(bstr, { type: 'binary' });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    toast.error('El archivo está vacío');
                    return;
                }

                setIsLoading(true);
                let updatedCount = 0;
                let createdCount = 0;

                for (const row of data) {
                    const rowId = row['ID'] || row['id'];
                    const rowCode = row['Código'] || row['Code'] || row['code'] || `IMP-${Math.floor(Math.random() * 1000)}`;
                    
                    const existingProduct = products.find(p => 
                        (rowId && p.id == rowId) || 
                        (p.code && p.code === rowCode)
                    );

                    const vigenciaStr = row['Vigencia'] || row['vigencia'];
                    let scheduledDate = null;
                    if (vigenciaStr) {
                        let parsedDate = null;
                        
                        if (typeof vigenciaStr === 'number') {
                            // Excel serial date format
                            // Excel's epoch is Dec 30, 1899 (because of the 1900 leap year bug)
                            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                            parsedDate = new Date(excelEpoch.getTime() + (vigenciaStr * 86400000));
                        } else {
                            const str = String(vigenciaStr).trim();
                            // Attempt to parse DD/MM/YYYY, HH:mm:ss or similar formats
                            const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[, ]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
                            if (match) {
                                const [_, day, month, year, hours, minutes, seconds] = match;
                                parsedDate = new Date(
                                    parseInt(year),
                                    parseInt(month) - 1,
                                    parseInt(day),
                                    hours ? parseInt(hours) : 0,
                                    minutes ? parseInt(minutes) : 0,
                                    seconds ? parseInt(seconds) : 0
                                );
                            } else {
                                parsedDate = new Date(str);
                            }
                        }

                        if (parsedDate && !isNaN(parsedDate.getTime()) && parsedDate > new Date()) {
                            scheduledDate = parsedDate;
                        }
                    }

                    const productData = {
                        code: rowCode,
                        description: row['Descripción'] || row['Description'] || row['description'] || 'Producto Importado',
                        unit: row['Unidad'] || row['Unit'] || row['unit'] || 'unidad',
                        current_stock: parseInt(row['Stock'] || row['current_stock'] || 0),
                        min_stock: parseInt(row['Stock Mínimo'] || row['Min Stock'] || row['min_stock'] || 0),
                        cost: parseFloat(row['Costo'] || row['Cost'] || row['cost'] || 0),
                        base_price: parseFloat(row['Precio'] || row['Price'] || row['price'] || row['base_price'] || 0),
                        category: row['Categoría'] || row['Category'] || row['category'] || '',
                        units_per_bulk: parseInt(row['Unidades x Bulto'] || row['Units per Bulk'] || row['units_per_bulk'] || 1)
                    };
                    
                    const programmedCost = parseFloat(row['Costo Programado'] || row['costo_programado'] || 0);
                    const programmedPrice = parseFloat(row['Precio Programado'] || row['precio_programado'] || 0);

                    if (existingProduct) {
                        productData.image = existingProduct.image || '🥚';
                        productData.allow_negative_stock = existingProduct.allow_negative_stock || false;
                        
                        if (scheduledDate && (programmedCost > 0 || programmedPrice > 0)) {
                            await schedulePriceChange(
                                existingProduct.id, 
                                programmedCost > 0 ? programmedCost : productData.cost, 
                                programmedPrice > 0 ? programmedPrice : productData.base_price, 
                                scheduledDate.toISOString()
                            );
                            await updateProduct(existingProduct.id, productData);
                        } else {
                            await updateProduct(existingProduct.id, productData);
                        }
                        updatedCount++;
                    } else {
                        productData.image = '🥚';
                        productData.allow_negative_stock = false;
                        await createProduct(productData);
                        createdCount++;
                    }
                }

                toast.success(`Importación completada: ${createdCount} creados, ${updatedCount} actualizados.`);
                await loadData();
            } catch (error) {
                console.error('Error importing file:', error);
                toast.error('Error al importar el archivo. Verifique el formato.');
            } finally {
                setIsLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleExportExcel = () => {
        if (products.length === 0) {
            toast.error('No hay productos para exportar');
            return;
        }

        const wb = XLSX.utils.book_new();

        const exportData = products.map(p => {
            let pendingChange = null;
            if (p.scheduled_price_changes && p.scheduled_price_changes.length > 0) {
                pendingChange = p.scheduled_price_changes.find(change => !change.status || change.status === 'pending');
            }

            return {
                'ID': p.id,
                'Código': p.code,
                'Descripción': p.description,
                'Unidad': p.unit,
                'Categoría': p.category || '',
                'Stock': p.current_stock,
                'Stock Mínimo': p.min_stock,
                'Costo': p.cost,
                'Precio': p.base_price,
                'Costo Programado': pendingChange ? pendingChange.new_cost : '',
                'Precio Programado': pendingChange ? pendingChange.new_base_price : '',
                'Vigencia': pendingChange && pendingChange.effective_date 
                    ? new Date(pendingChange.effective_date).toLocaleString('es-AR') 
                    : ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);

        ws['!cols'] = [
            { wch: 8 },  // ID
            { wch: 12 }, // Código
            { wch: 35 }, // Descripción
            { wch: 10 }, // Unidad
            { wch: 15 }, // Categoría
            { wch: 10 }, // Stock
            { wch: 15 }, // Stock Mínimo
            { wch: 12 }, // Costo
            { wch: 12 }, // Precio
            { wch: 18 }, // Costo Programado
            { wch: 18 }, // Precio Programado
            { wch: 20 }  // Vigencia
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Productos');
        XLSX.writeFile(wb, 'productos_export.xlsx');
    };

    const handleExportPDF = () => {
        if (products.length === 0) {
            toast.error('No hay productos para exportar');
            return;
        }

        const doc = new jsPDF();
        doc.text('Lista de Productos', 14, 15);
        
        const tableColumn = ["ID", "Código", "Descripción", "Cat.", "Stock", "Min", "Costo", "Precio"];
        const tableRows = [];

        products.forEach(p => {
            const rowData = [
                p.id,
                p.code,
                p.description,
                p.category || '',
                p.current_stock,
                p.min_stock,
                formatCurrency(p.cost),
                formatCurrency(p.base_price)
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [66, 139, 202] }
        });

        doc.save('productos_export.pdf');
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (window.confirm('¿Está seguro de que desea eliminar este producto?')) {
            try {
                await deleteProduct(id);
                await loadData();
            } catch (error) {
                console.error('Error al eliminar producto:', error);
                toast.error('No se pudo eliminar el producto. ' + (error.message || ''));
            }
        }
    };

    const columns = [
        { key: 'code', label: t('code') },
        {
            key: 'description',
            label: t('description'),
            render: (value, row) => (
                <div className="product-row">
                    <div className="product-image">
                        {row.image && (row.image.startsWith('http://') || row.image.startsWith('https://') || row.image.startsWith('/')) ? (
                            <img 
                                src={row.image} 
                                alt={value} 
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline';
                                }}
                            />
                        ) : null}
                        <span style={{ display: (row.image && (row.image.startsWith('http://') || row.image.startsWith('https://') || row.image.startsWith('/'))) ? 'none' : 'inline' }}>
                            {(!row.image || row.image.startsWith('http') || row.image.startsWith('/')) ? '🥚' : row.image}
                        </span>
                    </div>
                    <span className="product-name">{value}</span>
                </div>
            )
        },
        { key: 'category', label: 'Categoría' },
        { key: 'unit', label: t('unit') },
        {
            key: 'current_stock',
            label: t('currentStock'),
            render: (value, row) => (
                <span style={{
                    color: value <= row.min_stock ? 'var(--accent-danger)' : 'var(--text-primary)',
                    fontWeight: value <= row.min_stock ? '600' : '400'
                }}>
                    {value}
                    {value <= row.min_stock && (
                        <span className="badge badge-danger" style={{ marginLeft: '8px' }}>
                            {t('lowStockAlert')}
                        </span>
                    )}
                </span>
            )
        },
        {
            key: 'cost',
            label: 'Costo',
            render: (value) => formatCurrency(value || 0)
        },
        {
            key: 'base_price',
            label: 'Precio Venta',
            render: (value) => formatCurrency(value || 0)
        }
    ];

    if (canDelete) {
        columns.push({
            key: 'acciones',
            label: 'Acciones',
            render: (_, row) => (
                <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', color: 'var(--accent-danger)' }}
                    onClick={(e) => handleDelete(e, row.id)}
                    title="Eliminar producto"
                >
                    🗑️
                </button>
            )
        });
    }

    if (isLoading) {
        return <div style={{ padding: '20px' }}>Cargando productos...</div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '600' }}>{t('title')}</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileUpload}
                    />
                    <button className="btn btn-secondary" onClick={handleExportExcel} title="Exportar a Excel">
                        📊 Exportar Excel
                    </button>
                    <button className="btn btn-secondary" onClick={handleExportPDF} title="Exportar a PDF">
                        📄 Exportar PDF
                    </button>
                    <button className="btn btn-secondary" onClick={handleImportClick} title="Importar desde Excel">
                        📤 Importar Excel
                    </button>
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        + {t('addProduct')}
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="card-header" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
                        <select 
                            className="form-select"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            <option value="">Todas las categorías</option>
                            {[...new Set(products.map(p => p.category).filter(Boolean))].sort().map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="card-body">
                    <DataTable
                        columns={columns}
                        data={products.filter(product => {
                            if (selectedCategory && product.category !== selectedCategory) return false;
                            if (!searchTerm) return true;
                            const term = searchTerm.toLowerCase();
                            return (
                                product.code?.toLowerCase().includes(term) ||
                                product.description?.toLowerCase().includes(term)
                            );
                        })}
                        onRowClick={(product) => openModal(product)}
                    />
                </div>
            </div>

            <AnimatePresence>
            {showModal && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="modal-overlay" 
                    onClick={() => setShowModal(false)}
                >
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', duration: 0.3 }}
                        className="modal" 
                        style={{ maxWidth: '600px' }} 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {selectedProduct ? t('editProduct') : t('addProduct')}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">{t('code')} *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        name="code"
                                        value={formData.code}
                                        onChange={handleInputChange}
                                        placeholder="Ej: HUE-B30"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('unit')}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        name="unit"
                                        value={formData.unit}
                                        onChange={handleInputChange}
                                        placeholder="Ej: bandeja"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Categoría</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleInputChange}
                                    list="category-suggestions"
                                    placeholder="Ej: Huevos Blancos, Envases..."
                                />
                                <datalist id="category-suggestions">
                                    {[...new Set(products.map(p => p.category).filter(Boolean))].sort().map(cat => (
                                        <option key={cat} value={cat} />
                                    ))}
                                </datalist>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('description')} *</label>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div 
                                        onClick={() => imageInputRef.current?.click()}
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--bg-tertiary)',
                                            border: '2px dashed var(--border-color)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            overflow: 'hidden',
                                            position: 'relative',
                                            flexShrink: 0
                                        }}
                                        title="Cambiar imagen"
                                    >
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: '24px' }}>{formData.image || '📷'}</span>
                                        )}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            background: 'rgba(0,0,0,0.5)',
                                            color: 'white',
                                            fontSize: '10px',
                                            padding: '2px 0',
                                            textAlign: 'center'
                                        }}>
                                            EDITAR
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            name="description"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            placeholder="Ej: Huevos Bandeja x30"
                                            style={{ height: '80px', fontSize: '16px', fontWeight: '500' }}
                                        />
                                    </div>
                                </div>
                                <input 
                                    type="file"
                                    ref={imageInputRef}
                                    onChange={handleImageChange}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">{t('currentStock')}</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        name="currentStock"
                                        value={formData.currentStock}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('minStock')}</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        name="minStock"
                                        value={formData.minStock}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '8px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                    <input
                                        type="checkbox"
                                        name="allowNegativeStock"
                                        checked={formData.allowNegativeStock}
                                        onChange={handleInputChange}
                                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                                    />
                                    Permitir vender sin stock (Venta en negativo)
                                </label>
                            </div>

                            <div style={{
                                background: 'var(--bg-tertiary)',
                                padding: '16px',
                                borderRadius: 'var(--radius-md)',
                                marginTop: '8px'
                            }}>
                                <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>Precios y Costos</h4>
                                
                                {selectedProduct && (
                                    <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                                            <input
                                                type="radio"
                                                name="vigenciaTipo"
                                                value="inmediata"
                                                checked={formData.vigenciaTipo === 'inmediata'}
                                                onChange={handleInputChange}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            Vigencia Inmediata
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                                            <input
                                                type="radio"
                                                name="vigenciaTipo"
                                                value="programada"
                                                checked={formData.vigenciaTipo === 'programada'}
                                                onChange={handleInputChange}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            Vigencia Programada
                                        </label>
                                    </div>
                                )}
                                
                                {formData.vigenciaTipo === 'programada' && selectedProduct && (
                                    <div className="form-group" style={{ marginBottom: '16px' }}>
                                        <label className="form-label">Fecha y Hora de Vigencia *</label>
                                        <input
                                            type="datetime-local"
                                            className="form-input"
                                            name="vigenciaFecha"
                                            value={formData.vigenciaFecha}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Costo Unitario</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            className="form-input"
                                            name="cost"
                                            value={formData.cost}
                                            onChange={handleInputChange}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Precio Venta Base</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            className="form-input"
                                            name="basePrice"
                                            value={formData.basePrice}
                                            onChange={handleInputChange}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                {formData.cost > 0 && formData.basePrice > 0 && (
                                    <div style={{ marginTop: '12px', fontSize: '13px', display: 'flex', gap: '16px' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>
                                            Margen: <strong style={{ color: 'var(--accent-success)' }}>
                                                {formatCurrency(formData.basePrice - formData.cost)}
                                            </strong>
                                        </span>
                                        <span style={{ color: 'var(--text-muted)' }}>
                                            Rentabilidad: <strong style={{ color: 'var(--accent-info)' }}>
                                                {((formData.basePrice - formData.cost) / formData.basePrice * 100).toFixed(1)}%
                                            </strong>
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={isSaving}>
                                {tCommon('cancel')}
                            </button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? 'Guardando... ⏳' : tCommon('save')}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>
    );
}
