'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import DataTable from '@/components/ui/DataTable';
import { getAuditLogs, getProfiles } from '@/lib/api';
import { useSearch } from '@/components/providers/SearchProvider';
import { PageGuard } from '@/components/auth/RoleGuard';
import * as XLSX from 'xlsx';

export default function AuditoriaPage() {
    const t = useTranslations('audit');
    const { searchTerm } = useSearch();
    const [logs, setLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterUser, setFilterUser] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [dateRange, setDateRange] = useState({
        start: new Date().toLocaleDateString('en-CA'),
        end: new Date().toLocaleDateString('en-CA')
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [logsData, usersData] = await Promise.all([
                getAuditLogs(),
                getProfiles()
            ]);
            setLogs(logsData);
            setUsers(usersData);
        } catch (error) {
            console.error('Error loading audit data:', error);
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

    const getTypeLabel = (type) => {
        const types = {
            'sale': 'Venta',
            'purchase': 'Compra',
            'expense': 'Gasto/Egreso',
            'collection': 'Cobranza',
            'client_adjustment': 'Ajuste Cliente',
            'provider_adjustment': 'Ajuste Proveedor'
        };
        return types[type] || type;
    };

    const getTypeColor = (type) => {
        const colors = {
            'sale': 'var(--accent-primary)',
            'purchase': 'var(--accent-warning)',
            'expense': 'var(--accent-danger)',
            'collection': 'var(--accent-success)',
            'client_adjustment': '#8b5cf6',
            'provider_adjustment': '#ec4899'
        };
        return colors[type] || 'var(--text-secondary)';
    };

    const filteredLogs = logs.filter(log => {
        // Search term
        const matchesSearch = log.movement_id?.toString().includes(searchTerm) || 
                             log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             log.editorName?.toLowerCase().includes(searchTerm.toLowerCase());
        
        // User filter (matches either responsible or editor)
        const matchesUser = filterUser === 'all' || log.responsible_id === filterUser || log.editor_id === filterUser;
        
        // Type filter
        const matchesType = filterType === 'all' || log.type === filterType;
        
        // Date range
        const matchesDate = (!dateRange.start || log.date >= dateRange.start) && 
                           (!dateRange.end || log.date <= dateRange.end);
        
        return matchesSearch && matchesUser && matchesType && matchesDate;
    });

    const handleExportExcel = () => {
        const exportData = filteredLogs.map(log => ({
            'Fecha': log.date,
            'Tipo': getTypeLabel(log.type),
            'ID Movimiento': log.movement_id,
            'Monto': log.amount,
            'Responsable': log.userName,
            'Editor': log.editorName,
            'Fecha Registro': new Date(log.created_at).toLocaleString()
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Auditoria');
        XLSX.writeFile(wb, `auditoria_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const columns = [
        { 
            key: 'date', 
            label: 'Fecha',
            render: (val) => new Date(val + 'T12:00:00').toLocaleDateString()
        },
        { 
            key: 'type', 
            label: 'Tipo',
            render: (val) => (
                <span style={{ 
                    color: getTypeColor(val), 
                    fontWeight: '600',
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: `${getTypeColor(val)}15`,
                    border: `1px solid ${getTypeColor(val)}30`
                }}>
                    {getTypeLabel(val)}
                </span>
            )
        },
        { 
            key: 'movement_id', 
            label: 'ID Mov.',
            render: (val) => <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>#{val}</span>
        },
        { 
            key: 'amount', 
            label: 'Monto',
            render: (val) => <span style={{ fontWeight: '500' }}>{formatCurrency(val)}</span>
        },
        { 
            key: 'userName', 
            label: 'Responsable',
            render: (val) => <span style={{ fontWeight: '500', color: 'var(--accent-primary)' }}>{val}</span>
        },
        { 
            key: 'editorName', 
            label: 'Editor',
            render: (val) => <span style={{ fontWeight: '500', color: 'var(--accent-info)' }}>{val}</span>
        },
        {
            key: 'created_at',
            label: 'Registro',
            render: (val) => (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(val).toLocaleString()}
                </span>
            )
        }
    ];

    return (
        <PageGuard permission="users.manage">
            <div style={{ padding: '0 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>{t('title')}</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('description')}</p>
                    </div>
                    <button className="btn btn-secondary" onClick={handleExportExcel}>
                        📊 {t('exportAll')}
                    </button>
                </div>

                <div className="card" style={{ marginBottom: '20px' }}>
                    <div className="card-body" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
                            <label className="form-label">{t('responsible')}</label>
                            <select className="form-select" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                                <option value="all">{t('allUsers')}</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
                            <label className="form-label">{t('type')}</label>
                            <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                                <option value="all">{t('allTypes')}</option>
                                <option value="sale">Ventas</option>
                                <option value="purchase">Compras</option>
                                <option value="expense">Gastos</option>
                                <option value="collection">Cobranzas</option>
                                <option value="client_adjustment">Ajustes Clientes</option>
                                <option value="provider_adjustment">Ajustes Prov.</option>
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Desde</label>
                            <input 
                                type="date" 
                                className="form-input" 
                                value={dateRange.start} 
                                onChange={e => setDateRange({...dateRange, start: e.target.value})} 
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Hasta</label>
                            <input 
                                type="date" 
                                className="form-input" 
                                value={dateRange.end} 
                                onChange={e => setDateRange({...dateRange, end: e.target.value})} 
                            />
                        </div>

                        <button className="btn btn-secondary" onClick={loadData} style={{ height: '38px' }}>
                            🔄
                        </button>
                    </div>
                </div>

                <div className="card">
                    <div className="card-body">
                        {isLoading ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}>Cargando logs de auditoría...</div>
                        ) : filteredLogs.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No se encontraron movimientos con los filtros seleccionados.
                            </div>
                        ) : (
                            <DataTable columns={columns} data={filteredLogs} />
                        )}
                    </div>
                </div>
            </div>
        </PageGuard>
    );
}
