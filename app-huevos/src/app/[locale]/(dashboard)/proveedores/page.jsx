'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import DataTable from '@/components/ui/DataTable';
import { getProviders, createProvider, updateProvider, deleteProvider, getPurchases, getExpenses, getProviderAdjustments, createProviderAdjustment } from '@/lib/api';
import { useSearch } from '@/components/providers/SearchProvider';
import * as XLSX from 'xlsx';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';


export default function ProveedoresPage() {
    const tCommon = useTranslations('common');
    const { profile } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [providers, setProviders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [providerToDelete, setProviderToDelete] = useState(null);
    const fileInputRef = useRef(null);


    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [providerMovements, setProviderMovements] = useState([]);
    const [isMovementsLoading, setIsMovementsLoading] = useState(false);
    const [showAdjModal, setShowAdjModal] = useState(false);
    const [adjData, setAdjData] = useState({
        type: 'increase',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
    });

    const [error, setError] = useState(null);
    const { searchTerm } = useSearch();

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        cuit: '',
        address: '',
        phone: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getProviders();
            setProviders(data);
        } catch (error) {
            console.error('Error loading providers:', error);
            setError('No se pudieron cargar los proveedores. Por favor verifique su conexión.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <div style={{ padding: '20px' }}>Cargando proveedores...</div>;
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

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0
        }).format(parseFloat(value || 0));
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const openModal = (provider = null) => {
        if (provider) {
            setSelectedProvider(provider);
            setFormData({
                name: provider.name || '',
                cuit: provider.cuit || '',
                address: provider.address || '',
                phone: provider.phone || ''
            });
        } else {
            setSelectedProvider(null);
            setFormData({
                name: '',
                cuit: '',
                address: '',
                phone: ''
            });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name) {
            toast.warning('Por favor complete la Razón Social');
            return;
        }

        setIsSaving(true);
        try {
            const providerData = {
                name: formData.name,
                cuit: formData.cuit,
                address: formData.address,
                phone: formData.phone
            };

            if (selectedProvider) {
                await updateProvider(Number(selectedProvider.id), providerData);
                toast.success('Proveedor actualizado con éxito');
            } else {
                await createProvider(providerData);
                toast.success('Proveedor creado con éxito');
            }

            setShowModal(false);
            await loadData();
        } catch (error) {
            console.error('Error saving provider:', error);
            const errorMsg = error.message || error.details || 'Error desconocido';
            toast.error(`Error al guardar proveedor: ${errorMsg}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        setProviderToDelete(id);
    };

    const confirmDelete = async () => {
        if (!providerToDelete) return;
        try {
            await deleteProvider(providerToDelete);
            setProviderToDelete(null);
            await loadData();
            toast.success('Proveedor eliminado');
        } catch (error) {
            console.error('Error deleting provider:', error);
            toast.error('Error eliminando proveedor');
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
                    toast.warning('El archivo está vacío');
                    return;
                }

                setIsLoading(true);
                let updatedCount = 0;
                let createdCount = 0;

                for (const row of data) {
                    const rowId = row['ID'] || row['id'];
                    const rowName = row['Razon Social'] || row['Razón Social'] || row['name'] || row['Name'];
                    
                    if (!rowName) continue; // Skip rows without name

                    const existingProvider = providers.find(p => 
                        (rowId && p.id == rowId) || 
                        (p.name && p.name.toLowerCase() === rowName.toLowerCase())
                    );

                    const providerData = {
                        name: rowName,
                        cuit: row['CUIT'] || row['cuit'] || '',
                        address: row['Dirección'] || row['Direccion'] || row['address'] || '',
                        phone: row['Teléfono'] || row['Telefono'] || row['phone'] || ''
                    };

                    if (existingProvider) {
                        await updateProvider(existingProvider.id, providerData);
                        updatedCount++;
                    } else {
                        await createProvider(providerData);
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

    const downloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        // Empty array with headers
        const templateData = [{
            'ID': '',
            'Razon Social': 'Ejemplo S.A.',
            'CUIT': '30-12345678-9',
            'Direccion': 'Calle Falsa 123',
            'Telefono': '1123456789'
        }];
        const ws = XLSX.utils.json_to_sheet(templateData);
        ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Proveedores');
        XLSX.writeFile(wb, 'plantilla_proveedores.xlsx');
    };

    const handleExportExcel = () => {
        if (providers.length === 0) {
            toast.warning('No hay proveedores para exportar');
            return;
        }

        const wb = XLSX.utils.book_new();

        const exportData = providers.map(p => ({
            'ID': p.id,
            'Razon Social': p.name,
            'CUIT': p.cuit,
            'Direccion': p.address,
            'Telefono': p.phone
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);

        ws['!cols'] = [
            { wch: 8 },  // ID
            { wch: 30 }, // Razón Social
            { wch: 15 }, // CUIT
            { wch: 30 }, // Dirección
            { wch: 15 }  // Teléfono
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Proveedores');
        XLSX.writeFile(wb, 'proveedores_export.xlsx');
    };

    const columns = [
        { key: 'name', label: 'Razón Social' },
        { key: 'cuit', label: 'CUIT' },
        { key: 'address', label: 'Dirección' },
        { key: 'phone', label: 'Teléfono' },
        { 
            key: 'balance', 
            label: 'Saldo',
            render: (val) => <span style={{ fontWeight: '600', color: val > 0 ? 'var(--accent-warning)' : 'var(--text-primary)' }}>{formatCurrency(val)}</span>
        },
        {
            key: 'actions',
            label: 'Acciones',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); openDetailsModal(row); }}
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                        title="Ver Detalles / Cuenta Corriente"
                    >
                        👁️ Detalles
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); openModal(row); }}
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                        ✏️
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--accent-danger)' }}
                    >
                        🗑️
                    </button>
                </div>
            )
        }
    ];

    const openDetailsModal = async (provider) => {
        setSelectedProvider(provider);
        setShowDetailsModal(true);
        loadProviderMovements(provider.id);
    };

    const loadProviderMovements = async (providerId) => {
        setIsMovementsLoading(true);
        try {
            const [purchases, expenses, adjustments] = await Promise.all([
                getPurchases(),
                getExpenses(),
                getProviderAdjustments(providerId)
            ]);

            const provPurchases = purchases.filter(p => p.providerId === providerId);
            const provExpenses = expenses.filter(e => e.providerId === providerId);

            const rawMovements = [
                ...provPurchases.map(p => ({
                    id: p.id,
                    date: p.date,
                    createdAt: p.createdAt,
                    amount: p.total,
                    type: 'purchase',
                    description: `Compra #${p.id}`
                })),
                ...provExpenses.map(e => ({
                    id: e.id,
                    date: e.date,
                    createdAt: e.date,
                    amount: e.amount,
                    type: 'payment',
                    description: `Pago a proveedor (${e.description})`
                })),
                ...adjustments.map(a => ({
                    id: a.id,
                    date: a.date,
                    createdAt: a.created_at || a.date,
                    amount: parseFloat(a.amount || 0),
                    type: 'adjustment',
                    adjType: a.type,
                    description: `Ajuste: ${a.description}`
                }))
            ].sort((a, b) => {
                const dateA = new Date(a.date + 'T12:00:00');
                const dateB = new Date(b.date + 'T12:00:00');
                if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
                return new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date);
            });

            let currentBalance = 0;
            const movs = rawMovements.map(m => {
                if (m.type === 'purchase') currentBalance += m.amount;
                else if (m.type === 'payment') currentBalance -= m.amount;
                else if (m.type === 'adjustment') currentBalance += (m.adjType === 'increase' ? m.amount : -m.amount);
                return { ...m, runningBalance: currentBalance };
            });

            setProviderMovements(movs); // Ya están ordenados de más antiguo a más nuevo desde rawMovements
        } catch (e) {
            console.error(e);
            toast.error('Error cargando movimientos del proveedor');
        } finally {
            setIsMovementsLoading(false);
        }
    };

    const handleSaveAdjustment = async () => {
        if (!selectedProvider) return;
        if (!adjData.amount || parseFloat(adjData.amount) <= 0) {
            toast.warning('Ingrese un monto válido');
            return;
        }
        if (!adjData.description) {
            toast.warning('Ingrese una descripción');
            return;
        }

        setIsSaving(true);
        try {
            await createProviderAdjustment({
                providerId: selectedProvider.id,
                amount: parseFloat(adjData.amount),
                type: adjData.type,
                description: adjData.description,
                date: adjData.date,
                userId: profile?.id,
                editorId: profile?.id
            });
            setShowAdjModal(false);
            setAdjData({
                type: 'increase',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                description: ''
            });
            await loadProviderMovements(selectedProvider.id);
            await loadData(); // Reload main table to get new balance
        } catch (e) {
            console.error(e);
            toast.error('Error guardando ajuste');
        } finally {
            setIsSaving(false);
        }
    };

    const exportMovementsExcel = () => {
        if (providerMovements.length === 0) return;
        const wb = XLSX.utils.book_new();
        const exportData = providerMovements.map(m => ({
            'Fecha': m.date,
            'Detalle': m.description,
            'Debe (Compras/Ajustes +)': (m.type === 'purchase' || (m.type === 'adjustment' && m.adjType === 'increase')) ? m.amount : '',
            'Haber (Pagos/Ajustes -)': (m.type === 'payment' || (m.type === 'adjustment' && m.adjType === 'decrease')) ? m.amount : '',
            'Saldo': m.runningBalance
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
        XLSX.writeFile(wb, `cta_cte_proveedor_${selectedProvider?.name}.xlsx`);
    };

    if (isLoading) {
        return <div style={{ padding: '20px' }}>Cargando proveedores...</div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Proveedores</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileUpload}
                    />
                    <button className="btn btn-secondary" onClick={downloadTemplate} title="Descargar plantilla para importar">
                        📄 Plantilla
                    </button>
                    <button className="btn btn-secondary" onClick={handleExportExcel} title="Exportar a Excel">
                        📊 Exportar
                    </button>
                    <button className="btn btn-secondary" onClick={handleImportClick} title="Importar desde Excel">
                        📤 Importar
                    </button>
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        + Nuevo Proveedor
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="card-body">
                    <DataTable
                        columns={columns}
                        data={providers.filter(provider => {
                            if (!searchTerm) return true;
                            const term = searchTerm.toLowerCase();
                            return (
                                provider.name?.toLowerCase().includes(term) ||
                                provider.cuit?.toLowerCase().includes(term)
                            );
                        })}
                    />
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {selectedProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Razón Social *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Granja del Sol S.A."
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">CUIT</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="cuit"
                                    value={formData.cuit}
                                    onChange={handleInputChange}
                                    placeholder="Ej: 30-12345678-9"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Dirección</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Calle Principal 123"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Teléfono</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    placeholder="Ej: 11-1234-5678"
                                />
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
                    </div>
                </div>
            )}

            {/* Detalles de Cuenta Corriente Modal */}
            {showDetailsModal && (
                <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
                    <div className="modal" style={{ maxWidth: '800px', width: '100%' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Cuenta Corriente: {selectedProvider?.name}</h3>
                            <button className="modal-close" onClick={() => setShowDetailsModal(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <button className="btn btn-primary" onClick={() => setShowAdjModal(true)}>+ Nuevo Ajuste</button>
                                <button className="btn btn-secondary" onClick={exportMovementsExcel}>📊 Exportar a Excel</button>
                            </div>
                            
                            {isMovementsLoading ? (
                                <div style={{ padding: '20px', textAlign: 'center' }}>Cargando movimientos...</div>
                            ) : providerMovements.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay movimientos registrados.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {providerMovements.map((mov, idx) => (
                                        <div key={idx} style={{
                                            display: 'flex', justifyContent: 'space-between', padding: '12px',
                                            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                                            borderLeft: `3px solid ${mov.type === 'purchase' ? 'var(--accent-warning)' : (mov.type === 'payment' ? 'var(--accent-success)' : 'var(--text-primary)')}`
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: '500' }}>{mov.description}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {new Date(mov.date + 'T12:00:00').toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ 
                                                    fontWeight: '600', 
                                                    color: (mov.type === 'purchase' || (mov.type === 'adjustment' && mov.adjType === 'increase')) ? 'var(--accent-warning)' : 'var(--accent-success)' 
                                                }}>
                                                    {mov.type === 'purchase' ? '+' : (mov.type === 'payment' ? '-' : (mov.adjType === 'increase' ? '+' : '-'))}{formatCurrency(mov.amount)}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                    Saldo: {formatCurrency(mov.runningBalance)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Ajuste de Proveedor */}
            {showAdjModal && (
                <div className="modal-overlay" onClick={() => setShowAdjModal(false)} style={{ zIndex: 1100 }}>
                    <div className="modal" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Ajuste de Saldo</h3>
                            <button className="modal-close" onClick={() => setShowAdjModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Tipo de Movimiento *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className={`btn ${adjData.type === 'increase' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setAdjData(p => ({ ...p, type: 'increase' }))}
                                    >Aumentar Deuda (+)</button>
                                    <button
                                        type="button"
                                        className={`btn ${adjData.type === 'decrease' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setAdjData(p => ({ ...p, type: 'decrease' }))}
                                    >Disminuir Deuda (-)</button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Monto *</label>
                                <input type="number" className="form-input" value={adjData.amount} onChange={e => setAdjData(p => ({ ...p, amount: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fecha</label>
                                <input type="date" className="form-input" value={adjData.date} onChange={e => setAdjData(p => ({ ...p, date: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Motivo *</label>
                                <input type="text" className="form-input" value={adjData.description} onChange={e => setAdjData(p => ({ ...p, description: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAdjModal(false)} disabled={isSaving}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleSaveAdjustment} disabled={isSaving}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Confirmación de Eliminación */}
            <ConfirmModal
                isOpen={!!providerToDelete}
                onClose={() => setProviderToDelete(null)}
                onConfirm={confirmDelete}
                title="¿SEGURO DESEAS ELIMINAR?"
                message="Esta acción no se puede deshacer y se perderá el historial de compras de este proveedor."
            />
        </div>
    );
}
