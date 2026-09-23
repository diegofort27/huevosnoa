'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import DataTable from '@/components/ui/DataTable';
import { getProfiles, updateProfile } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import { PageGuard } from '@/components/auth/RoleGuard';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';


const PERMISSIONS = [
    // Dashboard & Generales
    { key: 'dashboard.view', label: 'Tablero: Resumen y Estadísticas' },
    { key: 'settings.view', label: 'Configuración de Perfil' },

    // Ventas & Cobranzas
    { key: 'sales.view', label: 'Ventas (Ver/Listado)' },
    { key: 'sales.create', label: 'Ventas (Cargar)' },
    { key: 'sales.edit', label: 'Ventas (Modificar/Cancelar)' },
    { key: 'sales.delete', label: 'Ventas (Borrar/Eliminar)' },
    { key: 'collections.view', label: 'Cobranzas (Ver Histórico)' },
    { key: 'collections.create', label: 'Cobranzas (Cargar)' },
    { key: 'collections.delete', label: 'Cobranzas (Borrar/Eliminar)' },

    // Cuentas Corrientes
    { key: 'accounts.view', label: 'Cuentas Corrientes (Ver)' },
    { key: 'payments.apply', label: 'Cuentas Corrientes (Aplicar Pagos)' },
    { key: 'accounts.adjust', label: 'Cuentas Corrientes (Ajuste de Saldo)' },

    // Reparto
    { key: 'delivery.view', label: 'Reparto (Ver Hojas de Ruta)' },
    { key: 'delivery.confirm', label: 'Reparto (Confirmar Entregas)' },
    { key: 'delivery.edit', label: 'Reparto (Modificar Pedidos)' },

    // Productos & Precios
    { key: 'products.manage', label: 'Productos (Gestionar)' },
    { key: 'prices.manage', label: 'Precios (Gestionar)' },

    // Compras & Gastos
    { key: 'purchases.manage', label: 'Compras (Gestionar)' },
    { key: 'expenses.manage', label: 'Gastos (Gestionar)' },
    { key: 'suppliers.manage', label: 'Proveedores (Gestionar)' },

    // Administración
    { key: 'clients.manage', label: 'Clientes (Gestionar)' },
    { key: 'zones.manage', label: 'Zonas (Gestionar)' },
    { key: 'arqueo.view', label: 'Arqueo de Caja (Ver)' },
    { key: 'users.manage', label: 'Usuarios (Gestionar)' },

    // Fiscal & Reportes
    { key: 'fiscal.view', label: 'Fiscal (Ver)' },
    { key: 'fiscal.manage', label: 'Fiscal (Modificar)' },
    { key: 'reports.view', label: 'Reportes y Estadísticas (Ver)' },
    { key: 'reports.manage', label: 'Reportes y Estadísticas (Modificar)' }
];

export default function UsuariosPage() {
    const { user: currentUser, profile: currentProfile } = useAuth();
    const [profiles, setProfiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // New User Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '' });
    const [userToDelete, setUserToDelete] = useState(null);


    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getProfiles();
            setProfiles(data);
        } catch (error) {
            console.error('Error loading profiles:', error);
            toast.error('Error al cargar usuarios');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleChange = (e) => {
        const role = e.target.value;
        setSelectedProfile(prev => ({ ...prev, role }));
    };

    const handlePermissionToggle = (key) => {
        setSelectedProfile(prev => {
            const currentPerms = prev.permissions || {};
            return {
                ...prev,
                permissions: {
                    ...currentPerms,
                    [key]: !currentPerms[key]
                }
            };
        });
    };

    const handleSave = async () => {
        try {
            await updateProfile(selectedProfile.id, {
                role: selectedProfile.role,
                permissions: selectedProfile.permissions
            });
            await loadData();
            setShowModal(false);
        } catch (error) {
            console.error('Error updating user:', error);
            toast.error('Error al actualizar usuario');
        }
    };

    const handleCreateUser = async () => {
        if (!newUser.username || !newUser.password) {
            toast.warning('Complete usuario y contraseña');
            return;
        }

        try {
            const res = await fetch('/api/auth/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error creando usuario');
            }

            toast.success('Usuario creado correctamente');
            setNewUser({ username: '', password: '' });
            setShowCreateModal(false);
            await loadData(); // Reload to see new user in list (via profiles trigger)
        } catch (error) {
            console.error(error);
            toast.error(error.message);
        }
    };

    const handleDeleteUser = (id, email, rowAuthRole) => {
        if (currentUser?.id === id) {
            toast.error('No puedes eliminarte a ti mismo.');
            return;
        }

        if (rowAuthRole === 'admin' && currentProfile?.role !== 'admin') {
            toast.error('No tienes permisos para eliminar a un administrador.');
            return;
        }

        setUserToDelete({ id, email });
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        const { id } = userToDelete;
        try {
            const res = await fetch('/api/auth/delete-user', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al eliminar usuario');
            }

            toast.success('Usuario eliminado correctamente');
            setUserToDelete(null);
            await loadData();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error(error.message);
        }
    };

    const handleApprove = async (id, approve = true) => {
        try {
            await updateProfile(id, { is_approved: approve });
            await loadData();
        } catch (error) {
            console.error('Error updating approval status:', error);
            toast.error('Error al actualizar estado de aprobación');
        }
    };

    const handleDisable = async (id, disable = true) => {
        try {
            await updateProfile(id, { is_disabled: disable });
            await loadData();
        } catch (error) {
            console.error('Error updating disabled status:', error);
            toast.error('Error al actualizar estado del usuario');
        }
    };

    const openModal = (profile) => {
        const safeProfile = {
            ...profile,
            permissions: profile.permissions || {}
        };
        setSelectedProfile(safeProfile);
        setShowModal(true);
    };

    const columns = useMemo(() => [
        { key: 'email', label: 'Usuario/Email' },
        {
            key: 'role',
            label: 'Rol',
            render: (value) => (
                <span className={`badge ${value === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
                    {value === 'admin' ? 'Maestro' : 'Usuario'}
                </span>
            )
        },
        {
            key: 'permissions',
            label: 'Permisos',
            render: (value, row) => {
                if (row.role === 'admin') return <span style={{ fontSize: '12px', color: 'var(--accent-success)' }}>Acceso Total</span>;
                const active = Object.entries(value || {})
                    .filter(([_, val]) => val)
                    .map(([key]) => PERMISSIONS.find(p => p.key === key)?.label || key);

                if (active.length === 0) return <span style={{ color: 'var(--text-muted)' }}>Sin permisos</span>;
                return (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {active.join(', ')}
                    </div>
                );
            }
        },
        {
            key: 'is_approved',
            label: 'Estado',
            render: (value, row) => (
                <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                    {!value ? (
                        <span className="badge" style={{ background: 'var(--accent-warning)', color: 'black' }}>
                            Pendiente
                        </span>
                    ) : row.is_disabled ? (
                        <span className="badge" style={{ background: 'var(--accent-danger)' }}>
                            Deshabilitado
                        </span>
                    ) : (
                        <span className="badge" style={{ background: 'var(--accent-success)' }}>
                            Activo
                        </span>
                    )}
                </div>
            )
        },
        {
            key: 'action',
            label: 'Acciones',
            render: (_, row) => (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!row.is_approved && (
                        <button
                            className="btn btn-primary"
                            style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--accent-success)', borderColor: 'var(--accent-success)' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(row.id, true);
                            }}
                        >
                            Aprobar
                        </button>
                    )}
                    <button
                        className="btn btn-secondary"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            openModal(row);
                        }}
                    >
                        Permisos
                    </button>
                    {row.id !== currentUser?.id && (
                        <>
                            <button
                                className="btn btn-secondary"
                                style={{
                                    fontSize: '11px',
                                    padding: '4px 8px',
                                    color: row.is_disabled ? 'var(--accent-success)' : 'var(--accent-warning)',
                                    borderColor: row.is_disabled ? 'var(--accent-success)' : 'var(--accent-warning)'
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDisable(row.id, !row.is_disabled);
                                }}
                            >
                                {row.is_disabled ? 'Habilitar' : 'Deshabilitar'}
                            </button>
                            {(currentProfile?.role === 'admin' || currentProfile?.permissions?.['users.manage']) && (
                                <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--accent-danger)', borderColor: 'var(--accent-danger)' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteUser(row.id, row.email, row.role);
                                    }}
                                    title="Eliminar"
                                >
                                    ✕
                                </button>
                            )}
                        </>
                    )}
                </div>
            )
        }
    ], [currentProfile, currentUser]);

    if (isLoading) return <div style={{ padding: '20px' }}>Cargando usuarios...</div>;

    return (
        <PageGuard permission="users.manage">
            <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Gestión de Usuarios</h1>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    + Nuevo Usuario
                </button>
            </div>

            <div className="card">
                <div className="card-body">
                    <DataTable columns={columns} data={profiles} />
                </div>
            </div>

            {/* Edit Modal */}
            {showModal && selectedProfile && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Editar: {selectedProfile.email}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Rol</label>
                                <select
                                    className="form-select"
                                    value={selectedProfile.role}
                                    onChange={handleRoleChange}
                                >
                                    <option value="user">Usuario Estándar</option>
                                    <option value="admin">Maestro (Admin)</option>
                                </select>
                            </div>

                            {selectedProfile.role === 'user' && (
                                <div className="form-group">
                                    <label className="form-label">Permisos Específicos</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {PERMISSIONS.map(perm => (
                                            <label
                                                key={perm.key}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    cursor: 'pointer',
                                                    padding: '8px',
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-sm)'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProfile.permissions?.[perm.key] === true}
                                                    onChange={() => handlePermissionToggle(perm.key)}
                                                />
                                                <span style={{ fontSize: '14px' }}>{perm.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleSave}>
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Crear Nuevo Usuario</h3>
                            <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--accent-warning)' }}>
                                El usuario será creado pero <strong>deberá ser aprobado</strong> antes de poder ingresar.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Nombre de Usuario</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newUser.username}
                                    onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                                    placeholder="Ej: vendedor1"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Contraseña Temporal</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder="Ej: 123456"
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleCreateUser}>
                                Crear Usuario
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Confirmación de Eliminación de Usuario */}
            <ConfirmModal
                isOpen={!!userToDelete}
                onClose={() => setUserToDelete(null)}
                onConfirm={confirmDeleteUser}
                title="¿SEGURO DESEAS ELIMINAR?"
                message={`Estás por eliminar permanentemente al usuario ${userToDelete?.email}. Esta acción no se puede deshacer.`}
            />
        </div>
        </PageGuard>
    );
}
