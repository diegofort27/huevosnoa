'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { getClients, getSales, getCollections, getClientAdjustments, createClientAdjustment } from '@/lib/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSearch } from '@/components/providers/SearchProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';

export default function CuentasPage() {
    const t = useTranslations('accounts');
    const { searchTerm, setSearchTerm } = useSearch();
    const { hasPermission, profile } = useAuth();
    
    const canAdjustAccounts = profile?.role === 'admin' || hasPermission('accounts.adjust');

    const [selectedClientId, setSelectedClientId] = useState(null);
    const [mobileView, setMobileView] = useState('list'); // 'list' | 'detail'
    const [clients, setClients] = useState([]); // Sidebar clients
    const [allClients, setAllClients] = useState([]); // ALL enriched clients
    const [sales, setSales] = useState([]);
    const [collections, setCollections] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [adjustments, setAdjustments] = useState([]);

    // Modal state
    const [showAdjModal, setShowAdjModal] = useState(false);
    const [adjData, setAdjData] = useState({
        type: 'increase',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [showExportDropdown, setShowExportDropdown] = useState(false);
    const [dateRange, setDateRange] = useState({
        start: '',
        end: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log('Cuentas: Cargando datos...');
            const clientsData = await getClients();

            // 1. Identify which clients are "parents", "children" or "independent"
            const enrichedClients = clientsData.map(c => {
                // Find children of this client
                const children = clientsData.filter(child => Number(child.parent_id) === Number(c.id));
                const childrenIds = children.map(ch => Number(ch.id));
                
                // Sumar los balances reales de la DB para el cliente y sus hijos
                const childrenBalances = childrenIds.reduce((sum, id) => {
                    const child = clientsData.find(cl => Number(cl.id) === id);
                    return sum + parseFloat(child?.balance || 0);
                }, 0);
                
                const rawBalance = parseFloat(c.balance || 0) + childrenBalances;
                const roundedBalance = Math.round(rawBalance * 100) / 100;

                return {
                    ...c,
                    calculatedBalance: roundedBalance,
                    isParent: children.length > 0,
                    isChild: !!c.parent_id
                };
            });

            // 2. Solo mostrar clientes con saldo real (>= $0.01). Si deben $0, no aparecen.
            const ccClients = enrichedClients.filter(c =>
                !c.isChild && Math.abs(c.calculatedBalance || 0) >= 0.01
            );
            
            // 3. Prepare sidebar list: Parent followed by its children
            const sidebarList = [];
            ccClients.forEach(parent => {
                sidebarList.push(parent);
                const children = enrichedClients.filter(c => Number(c.parent_id) === Number(parent.id));
                children.forEach(child => {
                    sidebarList.push(child);
                });
            });

            setClients(sidebarList);
            setAllClients(enrichedClients);

            if (ccClients.length > 0 && !selectedClientId) {
                setSelectedClientId(ccClients[0].id);
                // On desktop pre-select; on mobile keep list view
            }
        } catch (err) {
            console.error('Cuentas: Error cargando datos:', err);
            setError('Error al cargar los datos de las cuentas corrientes.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value) => {
        const num = parseFloat(value || 0);
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(num);
    };

    const formatQuantity = (value) => {
        return Number(value).toLocaleString('es-AR', {
            maximumFractionDigits: 4
        });
    };

    const selectedClient = allClients.find(c => c.id === selectedClientId);

    // Fetch movements for selected client
    useEffect(() => {
        if (selectedClientId) {
            loadClientMovements(selectedClientId);
        }
    }, [selectedClientId, allClients]);

    const loadClientMovements = async (clientId) => {
        const client = allClients.find(c => c.id === clientId);
        if (!client) return;
        
        setIsLoading(true);
        try {
            const childrenIds = client.isParent 
                ? allClients.filter(c => Number(c.parent_id) === Number(clientId)).map(c => Number(c.id))
                : [];
            const allRelevantIds = [Number(clientId), ...childrenIds];

            const [sData, cData, aData] = await Promise.all([
                getSales(allRelevantIds),
                getCollections(allRelevantIds),
                getClientAdjustments(allRelevantIds)
            ]);

            setSales(sData);
            setCollections(cData);
            setAdjustments(aData);
        } catch (err) {
            console.error('Error fetching client movements:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const selectedClientChildrenIds = selectedClient?.isParent 
        ? allClients.filter(c => Number(c.parent_id) === Number(selectedClientId)).map(c => Number(c.id))
        : [];
    const allRelevantIds = [Number(selectedClientId), ...selectedClientChildrenIds];

    // Get movements for selected client PLUS children (ONLY IF it's a parent)
    const clientSales = sales;
    const clientCollections = collections;
    const clientAdjustments = adjustments;

    // Combine, sort by date (oldest first for balance calculation)
    const rawMovements = [
        ...clientSales.map(s => ({
            id: s.id,
            date: s.date,
            createdAt: s.createdAt,
            amount: parseFloat(s.total || 0),
            type: 'sale',
            isDelivered: s.isDelivered,
            description: `Venta #${s.id}`,
            clientName: s.clientName,
            items: s.items
        })),
        ...clientCollections.map(c => ({
            id: c.id,
            date: c.date,
            createdAt: c.created_at,
            amount: parseFloat(c.amount || 0),
            type: 'collection',
            description: `Cobranza #${c.id} - ${c.payment_method || 'Efectivo'}`,
            clientName: c.clientName
        })),
        ...clientAdjustments.map(a => ({
            id: a.id,
            date: a.date,
            createdAt: a.created_at || a.date,
            amount: parseFloat(a.amount || 0),
            type: 'adjustment',
            adjType: a.type,
            description: `Ajuste: ${a.description || (a.type === 'increase' ? 'Aumento de deuda' : 'Disminución de deuda')}`,
            clientName: allClients.find(c => c.id === a.client_id)?.name || 'Cliente desconocido'
        }))
    ].sort((a, b) => {
        const dateA = new Date(a.date + 'T12:00:00');
        const dateB = new Date(b.date + 'T12:00:00');
        if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
        // Fallback to createdAt if dates are the same
        return new Date(a.createdAt) - new Date(b.createdAt);
    });


    // Calculate running balance starting from ZERO as requested by the user
    let currentRunningBalance = 0;

    const movementsWithBalance = rawMovements.map(mov => {
        if (mov.type === 'sale') {
            if (mov.isDelivered) currentRunningBalance += mov.amount;
        } else if (mov.type === 'collection') {
            currentRunningBalance -= mov.amount;
        } else if (mov.type === 'adjustment') {
            currentRunningBalance += (mov.adjType === 'increase' ? mov.amount : -mov.amount);
        }
        return { ...mov, runningBalance: currentRunningBalance };
    });

    // Final list for display (newest first)
    const movements = [...movementsWithBalance].sort((a, b) => {
        const dateA = new Date(a.date + 'T12:00:00');
        const dateB = new Date(b.date + 'T12:00:00');
        if (dateA.getTime() !== dateB.getTime()) return dateB - dateA;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const handleSaveAdjustment = async () => {
        if (!selectedClientId) return;
        if (!adjData.amount || parseFloat(adjData.amount) <= 0) {
            toast.warning('Ingrese un monto válido');
            return;
        }
        if (!adjData.description) {
            toast.warning('Ingrese una descripción/observación');
            return;
        }

        setIsSaving(true);
        try {
            await createClientAdjustment({
                clientId: selectedClientId,
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
            await loadData();
        } catch (err) {
            console.error('Error guardando ajuste:', err);
            toast.error('Error al guardar el ajuste.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportMovementsExcel = () => {
        if (!selectedClient || movementsWithBalance.length === 0) {
            toast.warning('No hay movimientos para exportar');
            return;
        }

        let filtered = [...movementsWithBalance];
        if (dateRange.start) {
            filtered = filtered.filter(m => m.date >= dateRange.start);
        }
        if (dateRange.end) {
            filtered = filtered.filter(m => m.date <= dateRange.end);
        }

        if (filtered.length === 0) {
            toast.warning('No hay movimientos en el rango de fechas seleccionado');
            return;
        }

        const exportData = filtered.map(mov => ({
            'Fecha': new Date(mov.date + 'T12:00:00').toLocaleDateString(),
            'Descripción': mov.description,
            'Sucursal': mov.clientName || '-',
            'Monto': mov.amount * (mov.type === 'sale' || (mov.type === 'adjustment' && mov.adjType === 'increase') ? 1 : -1),
            'Saldo Acumulado': mov.runningBalance
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
        XLSX.writeFile(wb, `movimientos_${selectedClient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportMovementsPDF = () => {
        if (!selectedClient || movementsWithBalance.length === 0) {
            toast.warning('No hay movimientos para exportar');
            return;
        }

        let filtered = [...movementsWithBalance];
        if (dateRange.start) {
            filtered = filtered.filter(m => m.date >= dateRange.start);
        }
        if (dateRange.end) {
            filtered = filtered.filter(m => m.date <= dateRange.end);
        }

        if (filtered.length === 0) {
            toast.warning('No hay movimientos en el rango de fechas seleccionado');
            return;
        }

        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text(`Estado de Cuenta: ${selectedClient.name}`, 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        const dateInfo = dateRange.start || dateRange.end 
            ? `Rango: ${dateRange.start || '...'} hasta ${dateRange.end || 'Hoy'}`
            : `Fecha de exportación: ${new Date().toLocaleDateString()}`;
        doc.text(dateInfo, 14, 28);
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Saldo al ${new Date().toLocaleDateString()}: ${formatCurrency(movementsWithBalance[movementsWithBalance.length - 1].runningBalance)}`, 14, 36);

        const tableColumn = ["Fecha", "Descripción", "Sucursal", "Monto", "Saldo"];
        const tableRows = filtered.map(mov => [
            new Date(mov.date + 'T12:00:00').toLocaleDateString(),
            mov.description,
            mov.clientName || '-',
            `${mov.type === 'sale' || (mov.type === 'adjustment' && mov.adjType === 'increase') ? '+' : '-'}${formatCurrency(mov.amount)}`,
            formatCurrency(mov.runningBalance)
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 42,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] },
            styles: { fontSize: 9 }
        });

        doc.save(`cuenta_${selectedClient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleExportExcel = () => {
        if (allClients.length === 0) {
            toast.warning('No hay clientes para exportar');
            return;
        }

        const wb = XLSX.utils.book_new();
        
        // Export only mother accounts with non-zero balances to avoid doubling and clean up the report
        const exportData = allClients
            .filter(c => !c.isChild && Math.abs(c.calculatedBalance || 0) >= 0.01)
            .map(c => ({
                'ID': c.id,
                'Cliente': c.name,
                'Condición': c.sale_condition === 'cc' ? 'Cuenta Corriente' : 'Contado',
                'Saldo': c.calculatedBalance
            }));

        const ws = XLSX.utils.json_to_sheet(exportData);

        // Adjust column widths
        ws['!cols'] = [
            { wch: 8 },  // ID
            { wch: 35 }, // Cliente
            { wch: 20 }, // Condición
            { wch: 15 }  // Saldo
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Saldos Clientes');
        XLSX.writeFile(wb, `saldos_clientes_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const totalDebt = clients.filter(c => !c.isChild).reduce((sum, c) => sum + (c.calculatedBalance || 0), 0);

    // Filtro del panel lateral: si hay búsqueda, mostrar todos los que coincidan. Si no, solo los de saldo > 0.
    const filteredSidebarClients = (searchTerm ? allClients : clients).filter(c => {
        if (searchTerm) {
            // Si está buscando por nombre, ignorar el filtro de saldo
            return c.name.toLowerCase().includes(searchTerm.toLowerCase());
        }
        // Si no busca, solo mostrar con saldo real
        const hasRealBalance = Math.abs(c.calculatedBalance || 0) >= 0.01;
        return hasRealBalance;
    });

    if (isLoading) {
        return (
            <div style={{ padding: '80px 40px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '24px' }}>⏳</div>
                <h3>Cargando cuentas corrientes...</h3>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>❌</div>
                <h3>{error}</h3>
                <button onClick={loadData} className="btn btn-primary" style={{ marginTop: '16px' }}>
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div>
            <style>{`
                @media (max-width: 768px) {
                    .cuentas-grid { display: block !important; }
                    .cuentas-panel-list.mobile-hidden { display: none !important; }
                    .cuentas-panel-detail.mobile-hidden { display: none !important; }
                    .cuentas-header { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
                    .cuentas-total-badge { width: 100% !important; box-sizing: border-box; }
                    .cuentas-card-header-actions { flex-wrap: wrap !important; gap: 8px !important; }
                    .cuentas-date-filters { flex-direction: column !important; }
                    .cuentas-back-btn { display: flex !important; }
                }
                .cuentas-back-btn { display: none; }
            `}</style>
            <div className="cuentas-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '600' }}>{t('title')}</h1>
                <div className="cuentas-total-badge" style={{
                    background: 'var(--bg-card)',
                    padding: '12px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)'
                }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>{t('totalOwed')}:</span>
                    <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-warning)' }}>
                        {formatCurrency(totalDebt)}
                    </span>
                </div>
            </div>

            <div className="cuentas-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 0.7fr) 2.3fr', gap: '20px' }}>
                {/* Client List */}
                <div className={`card cuentas-panel-list${mobileView === 'detail' ? ' mobile-hidden' : ''}`}>
                    <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="card-title">Clientes</h3>
                            <button className="btn btn-secondary" onClick={handleExportExcel} style={{ fontSize: '12px', padding: '6px 12px' }}>
                                📥 Exportar Saldos
                            </button>
                        </div>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ fontSize: '14px' }}
                        />
                    </div>
                    <div style={{ maxHeight: 'calc(100vh - 360px)', overflow: 'auto' }}>
                        {filteredSidebarClients.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                {searchTerm ? 'No se encontraron clientes' : 'No hay clientes con saldos pendientes'}
                            </div>
                        ) : (
                            filteredSidebarClients.map(client => (
                                <div
                                    key={client.id}
                                    onClick={() => { setSelectedClientId(client.id); setMobileView('detail'); }}
                                    style={{
                                        padding: `12px 16px 12px ${client.isChild ? '32px' : '16px'}`,
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        background: selectedClientId === client.id ? 'var(--bg-hover)' : 'transparent',
                                        transition: 'all var(--transition-fast)',
                                        borderLeft: client.isChild ? '2px solid var(--border-color)' : 'none'
                                    }}
                                >
                                    <div style={{ fontWeight: '500', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {client.isChild && <span style={{ color: 'var(--text-muted)' }}>↳</span>}
                                        {client.name} {client.isParent && <span title="Cuenta Madre">👑</span>}
                                    </div>
                                    <div style={{
                                        fontSize: '13px',
                                        color: (client.calculatedBalance) > 0 ? 'var(--accent-warning)' : ((client.calculatedBalance) < 0 ? 'var(--accent-success)' : 'var(--text-muted)')
                                    }}>
                                        Saldo Total: {formatCurrency(client.calculatedBalance)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Account Details */}
                <div className={`card cuentas-panel-detail${mobileView === 'list' ? ' mobile-hidden' : ''}`}>
                    <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
                        {/* Back button - only visible on mobile via CSS */}
                        <button
                            className="btn btn-secondary cuentas-back-btn"
                            onClick={() => setMobileView('list')}
                            style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            ← Volver
                        </button>
                        <h3 className="card-title">
                            {t('clientAccount')}: {selectedClient?.name || 'Seleccione un cliente'}
                        </h3>
                        {selectedClient && (
                            <div className="cuentas-card-header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                {canAdjustAccounts && (
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setShowAdjModal(true)}
                                        style={{ padding: '8px 16px', fontSize: '13px' }}
                                    >
                                        + Nuevo Ajuste
                                    </button>
                                )}
                                <div className="cuentas-date-filters" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        background: 'var(--bg-tertiary)', 
                                        padding: '6px 12px', 
                                        borderRadius: 'var(--radius-md)', 
                                        border: '1px solid var(--border-color)',
                                        minWidth: '180px',
                                        justifyContent: 'space-between'
                                    }}>
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Desde</span>
                                        <input 
                                            type="date" 
                                            value={dateRange.start} 
                                            onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', width: '110px' }}
                                        />
                                    </div>
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        background: 'var(--bg-tertiary)', 
                                        padding: '6px 12px', 
                                        borderRadius: 'var(--radius-md)', 
                                        border: '1px solid var(--border-color)',
                                        minWidth: '180px',
                                        justifyContent: 'space-between'
                                    }}>
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Hasta</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <input 
                                                type="date" 
                                                value={dateRange.end} 
                                                onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', width: '110px' }}
                                            />
                                            {(dateRange.start || dateRange.end) && (
                                                <button 
                                                    onClick={() => setDateRange({ start: '', end: '' })}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '12px', padding: '0 4px' }}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="dropdown" style={{ position: 'relative' }}>
                                    <button 
                                        className="btn btn-secondary" 
                                        onClick={() => setShowExportDropdown(!showExportDropdown)}
                                        style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        📥 Exportar Historial ▾
                                    </button>
                                    {showExportDropdown && (
                                        <div 
                                            className="dropdown-content" 
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                right: 0,
                                                background: 'var(--bg-card)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                                boxShadow: 'var(--shadow-lg)',
                                                zIndex: 10,
                                                minWidth: '160px',
                                                marginTop: '4px'
                                            }}
                                            onMouseLeave={() => setShowExportDropdown(false)}
                                        >
                                            <button 
                                                onClick={() => {
                                                    handleExportMovementsExcel();
                                                    setShowExportDropdown(false);
                                                }} 
                                                style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                            >
                                                📊 Formato Excel (.xlsx)
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    handleExportMovementsPDF();
                                                    setShowExportDropdown(false);
                                                }} 
                                                style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}
                                            >
                                                📄 Formato PDF (.pdf)
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div style={{
                                    padding: '8px 16px',
                                    background: (movements.length > 0 ? movements[0].runningBalance : (selectedClient.calculatedBalance || 0)) > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                    borderRadius: 'var(--radius-md)',
                                    color: (movements.length > 0 ? movements[0].runningBalance : (selectedClient.calculatedBalance || 0)) > 0 ? 'var(--accent-warning)' : 'var(--accent-success)',
                                    fontWeight: '600'
                                }}>
                                    {t('currentBalance')}: {formatCurrency(movements.length > 0 ? movements[0].runningBalance : selectedClient.calculatedBalance)}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="card-body">
                        <h4 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>{t('movements')}</h4>
                        {!selectedClientId ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">👈</div>
                                <h3 className="empty-state-title">Seleccione un cliente</h3>
                                <p className="empty-state-text">Para ver el detalle de movimientos de su cuenta corriente.</p>
                            </div>
                        ) : movements.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📭</div>
                                <h3 className="empty-state-title">Sin movimientos</h3>
                                <p className="empty-state-text">Este cliente no registra ventas ni cobranzas.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {movements.map((mov, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px 16px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            borderLeft: `3px solid ${mov.type === 'sale' ? 'var(--accent-warning)' : 'var(--accent-success)'}`
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {mov.description}
                                                {mov.type === 'sale' && !mov.isDelivered && (
                                                    <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                                        Pendiente de Entrega
                                                    </span>
                                                )}
                                            </div>
                                            {mov.items && mov.items.length > 0 && (
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                    {mov.items.map((it, idx) => (
                                                        <span key={idx} style={{ marginRight: '8px' }}>
                                                            • {it.productName} (x{formatQuantity(it.quantity)})
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: mov.items ? '4px' : '0' }}>
                                                {new Date(mov.date + 'T12:00:00').toLocaleDateString()}
                                                {mov.type === 'adjustment' && mov.date && (
                                                    <span style={{ marginLeft: '4px', fontSize: '10px' }}>
                                                        (Ajuste manual)
                                                    </span>
                                                )}
                                                {selectedClient?.isParent && mov.clientName && (
                                                    <span style={{ color: 'var(--accent-primary)', marginLeft: '8px', fontWeight: '500' }}>
                                                        👤 {mov.clientName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{
                                            textAlign: 'right'
                                        }}>
                                            <div style={{
                                                fontWeight: '600',
                                                color: mov.type === 'adjustment' ? 'var(--text-primary)' : (mov.type === 'sale'
                                                    ? (mov.isDelivered ? 'var(--accent-warning)' : 'var(--text-muted)')
                                                    : 'var(--accent-success)'),
                                                textDecoration: mov.type === 'sale' && !mov.isDelivered ? 'line-through' : 'none'
                                            }}>
                                                {mov.type === 'adjustment' ? '' : (mov.type === 'sale' ? '+' : '-')}{formatCurrency(mov.amount)}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
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

            {/* Modal de Ajuste Contable */}
            {showAdjModal && (
                <div className="modal-overlay" onClick={() => setShowAdjModal(false)}>
                    <div className="modal" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">📉 Nuevo Ajuste Contable</h3>
                            <button className="modal-close" onClick={() => setShowAdjModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                Realice ajustes al saldo del cliente <strong>{selectedClient?.name}</strong>.
                                No afecta la caja del cobrador.
                            </p>

                            <div className="form-group">
                                <label className="form-label">Tipo de Movimiento *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className={`btn ${adjData.type === 'increase' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setAdjData(p => ({ ...p, type: 'increase' }))}
                                        style={{ fontSize: '13px' }}
                                    >
                                        Aumentar Deuda (+)
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn ${adjData.type === 'decrease' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setAdjData(p => ({ ...p, type: 'decrease' }))}
                                        style={{ fontSize: '13px' }}
                                    >
                                        Disminuir Deuda (-)
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">Monto *</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="0.00"
                                        value={adjData.amount}
                                        onChange={e => setAdjData(p => ({ ...p, amount: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={adjData.date}
                                        onChange={e => setAdjData(p => ({ ...p, date: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Observación / Motivo *</label>
                                <textarea
                                    className="form-input"
                                    placeholder="Ej: Bonificación por mercadería dañada, Error en carga anterior..."
                                    rows="3"
                                    value={adjData.description}
                                    onChange={e => setAdjData(p => ({ ...p, description: e.target.value }))}
                                    style={{ resize: 'none' }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAdjModal(false)} disabled={isSaving}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveAdjustment} disabled={isSaving}>
                                {isSaving ? 'Guardando...' : 'Confirmar Ajuste'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
