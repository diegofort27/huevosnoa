'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import DataTable from '@/components/ui/DataTable';
import { getZones, createZone, updateZone, deleteZone } from '@/lib/api';
import { useSearch } from '@/components/providers/SearchProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';


const DAYS = [
    { id: 1, label: 'Lunes' },
    { id: 2, label: 'Martes' },
    { id: 3, label: 'Miércoles' },
    { id: 4, label: 'Jueves' },
    { id: 5, label: 'Viernes' },
    { id: 6, label: 'Sábado' },
    { id: 7, label: 'Domingo' }
];

export default function ZonasPage() {
    // const t = useTranslations('zones'); // If exists
    const tCommon = useTranslations('common');
    const { searchTerm } = useSearch();
    const [zones, setZones] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedZone, setSelectedZone] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);


    const [formData, setFormData] = useState({
        name: '',
        deliveryDays: []
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getZones();
            setZones(data);
        } catch (error) {
            console.error('Error loading zones:', error);
            setError('No se pudieron cargar las zonas. Verifique su conexión.');
        } finally {
            setIsLoading(false);
        }
    };

    const openModal = (zone = null) => {
        if (zone) {
            setSelectedZone(zone);
            setFormData({
                name: zone.name,
                deliveryDays: zone.delivery_days || []
            });
        } else {
            setSelectedZone(null);
            setFormData({
                name: '',
                deliveryDays: []
            });
        }
        setShowModal(true);
    };

    const handleDayToggle = (dayId) => {
        setFormData(prev => {
            const currentDays = prev.deliveryDays;
            if (currentDays.includes(dayId)) {
                return { ...prev, deliveryDays: currentDays.filter(d => d !== dayId) };
            } else {
                return { ...prev, deliveryDays: [...currentDays, dayId].sort((a, b) => a - b) };
            }
        });
    };

    const handleSave = async () => {
        if (!formData.name) {
            toast.warning('Por favor ingrese el nombre de la zona');
            return;
        }

        try {
            if (selectedZone) {
                await updateZone(selectedZone.id, formData);
            } else {
                await createZone(formData);
            }
            await loadData();
            setShowModal(false);
        } catch (error) {
            console.error('Error saving zone:', error);
            toast.error('Error al guardar zona');
        }
    };

    const handleDelete = () => {
        setShowConfirmDelete(true);
    };

    const confirmDelete = async () => {
        if (selectedZone) {
            try {
                await deleteZone(selectedZone.id);
                setShowConfirmDelete(false);
                await loadData();
                setShowModal(false);
            } catch (error) {
                console.error('Error deleting zone:', error);
                toast.error('Error al eliminar zona');
            }
        }
    };

    const columns = [
        { key: 'name', label: 'Nombre' },
        {
            key: 'delivery_days',
            label: 'Días de Reparto',
            render: (value) => {
                if (!value || value.length === 0) return <span style={{ color: 'var(--text-muted)' }}>Sin días asignados</span>;
                return (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {value.map(dayId => {
                            const day = DAYS.find(d => d.id === dayId);
                            return (
                                <span key={dayId} className="badge badge-info">
                                    {day?.label.substring(0, 3)}
                                </span>
                            );
                        })}
                    </div>
                );
            }
        },
        {
            key: 'id',
            label: 'Acciones',
            render: (_, row) => (
                <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={(e) => {
                    e.stopPropagation();
                    openModal(row);
                }}>
                    Editar
                </button>
            )
        }
    ];

    if (isLoading) return <div style={{ padding: '20px' }}>Cargando zonas...</div>;

    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h3 style={{ color: 'var(--accent-danger)', marginBottom: '16px' }}>Error</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{error}</p>
                <button className="btn btn-primary" onClick={loadData}>Reintentar</button>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Zonas de Reparto</h1>
                <button className="btn btn-primary" onClick={() => openModal()}>
                    + Nueva Zona
                </button>
            </div>

            <div className="card">
                <div className="card-body">
                    <DataTable
                        columns={columns}
                        data={zones.filter(zone => {
                            if (!searchTerm) return true;
                            return zone.name.toLowerCase().includes(searchTerm.toLowerCase());
                        })}
                        onRowClick={(zone) => openModal(zone)} // Row click also opens modal
                    />
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {selectedZone ? 'Editar Zona' : 'Nueva Zona'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nombre</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ej: Zona Norte"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Días de Reparto</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                    {DAYS.map(day => (
                                        <label
                                            key={day.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                cursor: 'pointer',
                                                padding: '8px',
                                                background: formData.deliveryDays.includes(day.id) ? 'var(--bg-hover)' : 'transparent',
                                                borderRadius: 'var(--radius-sm)',
                                                border: '1px solid var(--border-color)'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.deliveryDays.includes(day.id)}
                                                onChange={() => handleDayToggle(day.id)}
                                            />
                                            <span style={{ fontSize: '14px' }}>{day.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            {selectedZone && (
                                <button className="btn btn-danger" onClick={handleDelete} style={{ marginRight: 'auto' }}>
                                    Eliminar
                                </button>
                            )}
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleSave}>
                                Guardar
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
                message="Esta acción no se puede deshacer y puede afectar a los clientes asociados a esta zona."
            />
        </div>
    );
}
