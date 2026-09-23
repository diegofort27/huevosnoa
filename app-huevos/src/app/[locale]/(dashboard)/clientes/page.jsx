'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import * as XLSX from 'xlsx';
import DataTable from '@/components/ui/DataTable';
import { getClients, createClient, updateClient, deleteClient, getPriceLists, getZones } from '@/lib/api';
import { getNextDeliveryDay, getGoogleMapsLink } from '@/lib/utils';
import { useSearch } from '@/components/providers/SearchProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';


export default function ClientesPage() {
    const t = useTranslations('clients');
    const tCommon = useTranslations('common');
    const [showModal, setShowModal] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [clients, setClients] = useState([]);
    const [priceLists, setPriceLists] = useState([]);
    const [zones, setZones] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const { searchTerm } = useSearch();

    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);


    // Form state
    const [formData, setFormData] = useState({
        name: '',
        legalName: '',
        fantasyName: '',
        cuit: '',
        address: '',
        phone: '',
        email: '',
        saleCondition: 'contado',
        priceListId: '',
        zoneId: '',
        googleMapsUrl: '',
        parentId: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log('Fetching data for ClientesPage...');
            const [clientsData, listsData, zonesData] = await Promise.all([
                getClients(),
                getPriceLists(),
                getZones()
            ]);
            console.log('Data fetched successfully:', { clientsCount: clientsData.length, listsCount: listsData.length, zonesCount: zonesData.length });
            setClients(clientsData);
            setPriceLists(listsData);
            setZones(zonesData);
        } catch (err) {
            console.error('Error loading data:', err);
            setError(err.message || 'Error desconocido al cargar datos');
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

    const getPriceListName = (id) => {
        const list = priceLists.find(l => l.id === id);
        return list ? list.name : '-';
    };

    const getZoneInfo = (id) => {
        const zone = zones.find(z => z.id === id);
        return zone || null;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const openModal = (client = null) => {
        if (client) {
            setSelectedClient(client);
            setFormData({
                name: client.name || '',
                legalName: client.legal_name || '',
                fantasyName: client.fantasy_name || '',
                cuit: client.cuit || '',
                address: client.address || '',
                phone: client.phone || '',
                email: client.email || '',
                saleCondition: client.sale_condition || 'contado',
                priceListId: client.price_list_id || '',
                zoneId: client.zone_id || '',
                googleMapsUrl: client.google_maps_url || '',
                parentId: client.parent_id || ''
            });
        } else {
            setSelectedClient(null);
            const ventaList = priceLists.find(l => l.name === 'VENTA');
            setFormData({
                name: '',
                legalName: '',
                fantasyName: '',
                cuit: '',
                address: '',
                phone: '',
                email: '',
                saleCondition: 'contado',
                priceListId: ventaList?.id || priceLists[0]?.id || '',
                zoneId: zones[0]?.id || '',
                googleMapsUrl: '',
                parentId: ''
            });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.legalName && !formData.fantasyName && !formData.name) {
            toast.warning('Por favor ingrese al menos la Razón Social o el Nombre de Fantasía');
            return;
        }

        try {
            const clientData = {
                name: formData.fantasyName || formData.legalName || formData.name,
                legal_name: formData.legalName,
                fantasy_name: formData.fantasyName,
                cuit: formData.cuit,
                address: formData.address,
                phone: formData.phone,
                email: formData.email,
                sale_condition: formData.saleCondition,
                price_list_id: (formData.priceListId && !isNaN(parseInt(formData.priceListId))) ? parseInt(formData.priceListId) : null,
                zone_id: (formData.zoneId && !isNaN(parseInt(formData.zoneId))) ? parseInt(formData.zoneId) : null,
                google_maps_url: formData.googleMapsUrl,
                parent_id: (formData.parentId && !isNaN(parseInt(formData.parentId))) ? parseInt(formData.parentId) : null
            };

            if (selectedClient) {
                await updateClient(selectedClient.id, clientData);
            } else {
                await createClient(clientData);
            }

            await loadData();
            setShowModal(false);
        } catch (error) {
            console.error('Error saving client:', error);
            toast.error('Error al guardar cliente');
        }
    };

    const handleDelete = () => {
        setShowConfirmDelete(true);
    };

    const confirmDelete = async () => {
        if (selectedClient) {
            try {
                await deleteClient(selectedClient.id);
                setShowConfirmDelete(false);
                await loadData();
                setShowModal(false);
            } catch (error) {
                console.error('Error deleting client:', error);
                toast.error('Error al eliminar cliente');
            }
        }
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'ID CLIENTE',
            'Razón Social',
            'Nombre de Fantasía',
            'CUIT',
            'Dirección',
            'Teléfono',
            'Email',
            'Zona',
            'Lista de Precios',
            'Condición (contado/cc)',
            'Ubicación Google Maps'
        ];

        // Example data
        const example = [
            '1', 'Empresa S.A.', 'Don José', '20-12345678-9', 'Av. Siempre Viva 123', '11-2222-3333', 'jose@mail.com',
            zones[0]?.name || 'Zona 1', priceLists[0]?.name || 'Lista General', 'contado', 'https://maps.google.com/...'
        ];

        const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Clientes');
        XLSX.writeFile(workbook, 'plantilla_clientes_app_huevos.xlsx');
    };

    const handleExportExcel = () => {
        if (clients.length === 0) {
            toast.warning('No hay clientes para exportar');
            return;
        }

        const wb = XLSX.utils.book_new();

        const exportData = clients.map(c => {
            const zone = getZoneInfo(c.zone_id);
            const priceList = priceLists.find(p => p.id === c.price_list_id);
            
            return {
                'ID CLIENTE': c.id,
                'Razón Social': c.legal_name || '',
                'Nombre de Fantasía': c.fantasy_name || '',
                'CUIT': c.cuit || '',
                'Dirección': c.address || '',
                'Teléfono': c.phone || '',
                'Email': c.email || '',
                'Zona': zone ? zone.name : '',
                'Lista de Precios': priceList ? priceList.name : '',
                'Condición (contado/cc)': c.sale_condition === 'cc' ? 'cc' : 'contado',
                'Ubicación Google Maps': c.google_maps_url || ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
        XLSX.writeFile(wb, 'clientes_export.xlsx');
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                toast.warning('El archivo está vacío');
                return;
            }

            const clientsToProcess = jsonData.map(row => {
                const clientData = {};
                
                // Capturar ID
                const id = row['ID CLIENTE'] || row['ID'] || row['id'];
                if (id) clientData.id = id;

                // Mapear campos solo si están presentes en la fila
                if (row['Razón Social'] !== undefined) clientData.legal_name = row['Razón Social'];
                if (row['Nombre de Fantasía'] !== undefined) clientData.fantasy_name = row['Nombre de Fantasía'];
                if (row['CUIT'] !== undefined) clientData.cuit = row['CUIT'];
                if (row['Dirección'] !== undefined) clientData.address = row['Dirección'];
                if (row['Teléfono'] !== undefined) clientData.phone = row['Teléfono'];
                if (row['Email'] !== undefined) clientData.email = row['Email'];
                if (row['Ubicación Google Maps'] !== undefined) clientData.google_maps_url = row['Ubicación Google Maps'];

                if (row['Condición (contado/cc)'] !== undefined) {
                    clientData.sale_condition = row['Condición (contado/cc)'].toString().toLowerCase().includes('cc') ? 'cc' : 'contado';
                }

                if (row['Zona'] !== undefined) {
                    const zoneName = row['Zona'].toString().trim().toLowerCase();
                    const zone = zones.find(z => z.name.toLowerCase() === zoneName);
                    if (zone) clientData.zone_id = zone.id;
                }

                if (row['Lista de Precios'] !== undefined) {
                    const listName = row['Lista de Precios'].toString().trim().toLowerCase();
                    const priceList = priceLists.find(p => p.name.toLowerCase() === listName);
                    if (priceList) clientData.price_list_id = priceList.id;
                }

                // Generar el nombre de búsqueda si se actualizó alguno de los nombres
                if (clientData.legal_name || clientData.fantasy_name) {
                    clientData.name = clientData.fantasy_name || clientData.legal_name;
                }

                return clientData;
            });

            let successCount = 0;
            let updateCount = 0;
            for (const clientData of clientsToProcess) {
                try {
                    const { id, ...dataToSave } = clientData;
                    
                    if (Object.keys(dataToSave).length === 0 && !id) continue;

                    if (id && clients.some(c => c.id == id)) {
                        // ACTUALIZACIÓN: solo enviamos lo que vino en el Excel
                        if (Object.keys(dataToSave).length > 0) {
                            await updateClient(id, dataToSave);
                            updateCount++;
                        }
                    } else {
                        // CREACIÓN: asegurar campos mínimos
                        const newClient = {
                            name: dataToSave.name || dataToSave.fantasy_name || dataToSave.legal_name || 'Sin nombre',
                            sale_condition: dataToSave.sale_condition || 'contado',
                            ...dataToSave
                        };
                        await createClient(newClient);
                        successCount++;
                    }
                } catch (err) {
                    console.error('Error processing client during import:', clientData.id || 'Nuevo', err);
                }
            }

            toast.success(`Importación completada: ${successCount} creados, ${updateCount} actualizados.`);
            loadData();
        } catch (error) {
            console.error('Error importing Excel:', error);
            toast.error('Error al importar el archivo. Verifique que los nombres de las zonas y listas de precios coincidan exactamente con los cargados en el sistema.');
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const columns = [
        {
            key: 'id',
            label: 'ID',
            render: (value) => <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>#{value}</span>
        },
        {
            key: 'name',
            label: t('name'),
            render: (value, row) => (
                <div>
                    <div style={{ fontWeight: '600' }}>{value}</div>
                    {row.fantasy_name && row.fantasy_name !== value && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.fantasy_name}</div>
                    )}
                </div>
            )
        },
        {
            key: 'cuit',
            label: t('cuit'),
            render: (value) => value || <span style={{ color: 'var(--text-muted)' }}>-</span>
        },
        {
            key: 'zone_id',
            label: 'Zona / Entrega',
            render: (value) => {
                const zone = getZoneInfo(value);
                if (!zone) return <span style={{ color: 'var(--text-muted)' }}>-</span>;

                const nextDelivery = getNextDeliveryDay(zone.delivery_days);
                const nextDeliveryText = nextDelivery
                    ? nextDelivery.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
                    : 'Sin días';

                return (
                    <div>
                        <div style={{ fontWeight: '500' }}>{zone.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--accent-info)' }}>
                            Prox: {nextDeliveryText}
                        </div>
                    </div>
                );
            }
        },
        {
            key: 'parent_id',
            label: 'Cuenta Madre',
            render: (value) => {
                const parent = clients.find(c => c.id === value);
                return parent ? (
                    <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: '500' }}>
                        🔗 {parent.name}
                    </span>
                ) : <span style={{ color: 'var(--text-muted)' }}>-</span>;
            }
        },
        { key: 'address', label: t('address') },
        {
            key: 'sale_condition',
            label: t('saleCondition'),
            render: (value) => (
                <span className={`badge ${value === 'cc' ? 'badge-info' : 'badge-success'}`}>
                    {value === 'cc' ? t('currentAccount') : t('cash')}
                </span>
            )
        },
        {
            key: 'balance',
            label: t('balance'),
            render: (value) => (
                <span style={{ color: value > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                    {formatCurrency(value || 0)}
                </span>
            )
        }
    ];

    if (isLoading) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando clientes...</div>;
    }

    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h3 style={{ color: 'var(--accent-danger)', marginBottom: '16px' }}>Error al cargar clientes</h3>
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
                        Total clientes: <span style={{ fontWeight: '600' }}>{clients.length}</span>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportExcel}
                        accept=".xlsx, .xls"
                        style={{ display: 'none' }}
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={handleDownloadTemplate}
                        title={t('downloadTemplate')}
                    >
                        📥 Plantilla
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleExportExcel}
                        title={t('exportExcel')}
                    >
                        📊 {t('exportExcel')}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                    >
                        {isImporting ? 'Importando...' : `📤 ${t('importExcel')}`}
                    </button>
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        + {t('addClient')}
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="card-body">
                    <DataTable
                        columns={columns}
                        data={clients.filter(client => {
                            if (!searchTerm) return true;
                            const term = searchTerm.toLowerCase();
                            return (
                                client.name?.toLowerCase().includes(term) ||
                                client.fantasy_name?.toLowerCase().includes(term) ||
                                client.legal_name?.toLowerCase().includes(term) ||
                                client.cuit?.toLowerCase().includes(term)
                            );
                        })}
                        onRowClick={(client) => openModal(client)}
                    />
                </div>
            </div>

            {/* Modal remains same... */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {selectedClient ? t('editClient') : t('addClient')}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {selectedClient && (
                                <div className="form-group">
                                    <label className="form-label" style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>ID CLIENTE: {selectedClient.id}</label>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">{t('legalName')}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        name="legalName"
                                        value={formData.legalName}
                                        onChange={handleInputChange}
                                        placeholder="Ej: Sociedad Anónima"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('fantasyName')}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        name="fantasyName"
                                        value={formData.fantasyName}
                                        onChange={handleInputChange}
                                        placeholder="Ej: Don José"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('cuit')}</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="cuit"
                                    value={formData.cuit}
                                    onChange={handleInputChange}
                                    placeholder="30-XXXXXXXX-X"
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Zona de Reparto</label>
                                    <select
                                        className="form-select"
                                        name="zoneId"
                                        value={formData.zoneId}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Sin zona asignada</option>
                                        {zones.map(zone => (
                                            <option key={zone.id} value={zone.id}>{zone.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('priceList')}</label>
                                    <select
                                        className="form-select"
                                        name="priceListId"
                                        value={formData.priceListId}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Seleccionar lista...</option>
                                        {priceLists.map(list => (
                                            <option key={list.id} value={list.id}>{list.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('address')}</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Av. San Martín 1234"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('phone')}</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    placeholder="Ej: 11-4567-8901"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('email')}</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="Ej: contacto@empresa.com"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('googleMapsUrl')}</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        name="googleMapsUrl"
                                        value={formData.googleMapsUrl}
                                        onChange={handleInputChange}
                                        placeholder="https://goo.gl/maps/..."
                                    />
                                    {(formData.googleMapsUrl || formData.address) && (
                                        <a
                                            href={getGoogleMapsLink(formData.googleMapsUrl || formData.address)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-secondary"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}
                                        >
                                            📍
                                        </a>
                                    )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('saleCondition')}</label>
                                <select
                                    className="form-select"
                                    name="saleCondition"
                                    value={formData.saleCondition}
                                    onChange={handleInputChange}
                                >
                                    <option value="contado">{t('cash')}</option>
                                    <option value="cc">{t('currentAccount')}</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
                                <label className="form-label">
                                    Cuenta Madre (Consolidación)
                                    <span style={{ display: 'block', fontSize: '11px', fontWeight: '400', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        Si se asigna, todos los movimientos de este cliente impactarán en la cuenta corriente del padre.
                                    </span>
                                </label>
                                <select
                                    className="form-select"
                                    name="parentId"
                                    value={formData.parentId}
                                    onChange={handleInputChange}
                                >
                                    <option value="">Ninguna (Cuenta Independiente)</option>
                                    {clients
                                        .filter(c => 
                                            // No puede ser su propio padre
                                            c.id !== selectedClient?.id && 
                                            // Solo permitimos un nivel: el padre NO puede tener padre a su vez
                                            !c.parent_id
                                        )
                                        .map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            {selectedClient && (
                                <button
                                    className="btn btn-danger"
                                    onClick={handleDelete}
                                    style={{ marginRight: 'auto' }}
                                >
                                    {tCommon('delete')}
                                </button>
                            )}
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                {tCommon('cancel')}
                            </button>
                            <button className="btn btn-primary" onClick={handleSave}>
                                {tCommon('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Confirmación de Eliminación */}
            <ConfirmModal
                isOpen={showConfirmDelete}
                onClose={() => setShowConfirmDelete(false)}
                onConfirm={confirmDelete}
                title="¿SEGURO DESEAS ELIMINAR?"
                message="Esta acción no se puede deshacer y se perderá el historial del cliente."
            />
        </div>
    );
}
