'use client';

import { useState, useEffect } from 'react';
import { getArqueoStats, getProfiles, createTransfer, getArqueoCategories, getTransfers, deleteTransfer, getUserCategoryMovements, buyDollars } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import * as XLSX from 'xlsx';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { formatDateLocal } from '@/lib/utils';
import { toast } from 'sonner';


export default function ArqueoPage() {
    const [data, setData] = useState({ userStats: [], categories: [] });
    const [movements, setMovements] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showMovModal, setShowMovModal] = useState(false);
    const [showAdjModal, setShowAdjModal] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [adjType, setAdjType] = useState('ingreso'); // 'ingreso' or 'egreso'
    const [selectedCategoryUser, setSelectedCategoryUser] = useState(null);
    const [categoryMovements, setCategoryMovements] = useState([]);
    const [isLoadingCategoryMovements, setIsLoadingCategoryMovements] = useState(false);
    const [categoryDateFilter, setCategoryDateFilter] = useState('');
    const [cotizacion, setCotizacion] = useState(0);
    const [isFetchingDolar, setIsFetchingDolar] = useState(true);
    const [showBuyUsdModal, setShowBuyUsdModal] = useState(false);
    const [buyUsdData, setBuyUsdData] = useState({
        userId: '',
        fromCategoryId: '',
        amountArs: '',
        amountUsd: '',
        date: formatDateLocal(),
        description: '',
        cotizacion: 0
    });
    const { user, profile } = useAuth();

    const [movData, setMovData] = useState({
        fromUserId: '',
        fromCategoryId: '',
        toUserId: '',
        toCategoryId: '',
        amount: '',
        date: formatDateLocal(),
        description: ''
    });

    const [adjData, setAdjData] = useState({
        userId: '',
        categoryId: '',
        amount: '',
        date: formatDateLocal(),
        description: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const fetchDolar = async () => {
            setIsFetchingDolar(true);
            try {
                const response = await fetch('https://dolarapi.com/v1/dolares/blue');
                if (response.ok) {
                    const data = await response.json();
                    if (data.venta) {
                        setCotizacion(data.venta);
                    }
                } else {
                    setCotizacion(prev => prev === 0 ? 1405 : prev);
                }
            } catch (err) {
                console.error("Error fetching dolar:", err);
                setCotizacion(prev => prev === 0 ? 1405 : prev);
            } finally {
                setIsFetchingDolar(false);
            }
        };
        
        fetchDolar();
        
        // Actualizar cotización cada 5 minutos
        const interval = setInterval(fetchDolar, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [stats, profilesData, cats, transfersData] = await Promise.all([
                getArqueoStats(),
                getProfiles(),
                getArqueoCategories(),
                getTransfers()
            ]);
            setData(stats);
            setProfiles(profilesData);
            setCategories(cats);
            setMovements(transfersData);
        } catch (error) {
            console.error('Error loading arqueo:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value, currency = 'ARS') => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: currency === 'USD' ? 2 : 0
        }).format(value);
    };

    const openCategoryMovements = async (userStat, cat) => {
        setSelectedCategoryUser({ user: userStat, category: cat });
        setCategoryMovements([]);
        setIsLoadingCategoryMovements(true);
        setCategoryDateFilter('');
        
        try {
            const data = await getUserCategoryMovements(userStat.id, cat.categoryId);
            setCategoryMovements(data);
        } catch (error) {
            console.error("Error al cargar movimientos de la categoría:", error);
            toast.error("Error al cargar movimientos");
        } finally {
            setIsLoadingCategoryMovements(false);
        }
    };

    const handleMovimiento = async () => {
        const { fromUserId, fromCategoryId, toUserId, toCategoryId, amount, date, description } = movData;
        if (!fromUserId || !fromCategoryId || !toUserId || !toCategoryId || !amount) {
            toast.warning('Complete todos los campos requeridos');
            return;
        }
        if (parseFloat(amount) <= 0) {
            toast.warning('El monto debe ser mayor a 0');
            return;
        }
        try {
            await createTransfer({
                fromUserId,
                toUserId,
                amount: parseFloat(amount),
                currency: 'ARS',
                date,
                description,
                fromCategoryId: parseInt(fromCategoryId),
                toCategoryId: parseInt(toCategoryId)
            });
            setShowMovModal(false);
            setMovData({
                fromUserId: '',
                fromCategoryId: '',
                toUserId: '',
                toCategoryId: '',
                amount: '',
                date: formatDateLocal(),
                description: ''
            });
            await loadData();
        } catch (error) {
            console.error('Error creando movimiento:', error);
            toast.error('Error al crear el movimiento');
        }
    };

    const handleBuyUsd = async () => {
        const { userId, fromCategoryId, amountArs, amountUsd, date, description, cotizacion: cotiz } = buyUsdData;
        if (!userId || !fromCategoryId || !amountArs || !amountUsd || !cotiz) {
            toast.warning('Complete todos los campos requeridos');
            return;
        }
        
        const usdCategory = categories.find(c => c.name === 'Dólares');
        if (!usdCategory) {
            toast.warning('No se encontró la categoría "Dólares" en el sistema.');
            return;
        }

        try {
            await buyDollars({
                userId,
                fromCategoryId: parseInt(fromCategoryId),
                usdCategoryId: usdCategory.id,
                amountArs: parseFloat(amountArs),
                amountUsd: parseFloat(amountUsd),
                date,
                description,
                cotizacion: parseFloat(cotiz)
            });
            setShowBuyUsdModal(false);
            setBuyUsdData({
                userId: '',
                fromCategoryId: '',
                amountArs: '',
                amountUsd: '',
                date: formatDateLocal(),
                description: '',
                cotizacion: 0
            });
            await loadData();
        } catch (error) {
            console.error('Error al comprar dólares:', error);
            toast.error('Error al registrar la compra de dólares');
        }
    };

    const handleAmountArsChange = (val) => {
        const ars = parseFloat(val);
        const usd = (ars / parseFloat(buyUsdData.cotizacion)).toFixed(2);
        setBuyUsdData(p => ({ ...p, amountArs: val, amountUsd: isNaN(usd) ? '' : usd }));
    };

    const handleAmountUsdChange = (val) => {
        const usd = parseFloat(val);
        const ars = (usd * parseFloat(buyUsdData.cotizacion)).toFixed(2);
        setBuyUsdData(p => ({ ...p, amountUsd: val, amountArs: isNaN(ars) ? '' : ars }));
    };

    const handleCotizacionChange = (val) => {
        const cot = parseFloat(val);
        const ars = (parseFloat(buyUsdData.amountUsd) * cot).toFixed(2);
        setBuyUsdData(p => ({ ...p, cotizacion: val, amountArs: isNaN(ars) ? buyUsdData.amountArs : ars }));
    };

    const handleAdjustment = async () => {
        const { userId, categoryId, amount, date, description } = adjData;
        if (!userId || !categoryId || !amount || !description) {
            toast.warning('Complete todos los campos requeridos (incluyendo descripción)');
            return;
        }
        try {
            await createTransfer({
                fromUserId: adjType === 'egreso' ? userId : null,
                toUserId: adjType === 'ingreso' ? userId : null,
                amount: parseFloat(amount),
                currency: 'ARS',
                date,
                description: `${adjType === 'ingreso' ? 'INGRESÓ:' : 'EGRESÓ:'} ${description}`,
                fromCategoryId: adjType === 'egreso' ? parseInt(categoryId) : null,
                toCategoryId: adjType === 'ingreso' ? parseInt(categoryId) : null
            });
            setShowAdjModal(false);
            setAdjData({
                userId: '',
                categoryId: '',
                amount: '',
                date: formatDateLocal(),
                description: ''
            });
            await loadData();
        } catch (error) {
            console.error('Error creando ajuste:', error);
            toast.error('Error al procesar el ajuste');
        }
    };
    
    const handleDeleteTransfer = (id) => {
        setPendingDeleteId(id);
    };
    
    const confirmDelete = async () => {
        if (!pendingDeleteId) return;
        
        try {
            await deleteTransfer(pendingDeleteId);
            setPendingDeleteId(null);
            await loadData();
        } catch (error) {
            console.error('Error eliminando transferencia:', error);
            toast.error('Error al eliminar el movimiento');
        }
    };

    const handleExportExcel = () => {
        if (movements.length === 0) {
            toast.warning('No hay movimientos para exportar');
            return;
        }

        const wb = XLSX.utils.book_new();
        const exportData = movements.map(m => ({
            'Fecha': new Date(m.date + 'T12:00:00').toLocaleDateString(),
            'Usuario Origen': m.fromName,
            'Categoría Origen': m.fromCategoryName !== 'N/A' ? m.fromCategoryName : '-',
            'Usuario Destino': m.toName,
            'Categoría Destino': m.toCategoryName !== 'N/A' ? m.toCategoryName : '-',
            'Monto': m.amount,
            'Descripción': m.description,
            'ID': m.id
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);

        // Adjust column widths
        ws['!cols'] = [
            { wch: 12 }, // Fecha
            { wch: 20 }, // Usuario Origen
            { wch: 18 }, // Categoría Origen
            { wch: 20 }, // Usuario Destino
            { wch: 18 }, // Categoría Destino
            { wch: 12 }, // Monto
            { wch: 40 }, // Descripción
            { wch: 8 }   // ID
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Historial Arqueo');
        XLSX.writeFile(wb, `arqueo_export_${formatDateLocal()}.xlsx`);
    };

    const totalArs = data.userStats.reduce((sum, u) =>
        sum + u.categoryBalances.reduce((s, c) => 
            c.categoryName === 'Dólares' ? s : s + c.balance
        , 0), 0
    );

    const totalUsd = data.userStats.reduce((sum, u) =>
        sum + u.categoryBalances.reduce((s, c) => 
            c.categoryName === 'Dólares' ? s + c.balance : s
        , 0), 0
    );

    const totalConsolidado = totalArs + (totalUsd * cotizacion);

    return (
        <div style={{ paddingBottom: '40px' }}>
            {/* Header Section */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px', letterSpacing: '-0.5px' }}>Arqueo de Caja</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            Saldos acumulados por usuario y categoría
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => { setAdjType('ingreso'); setShowAdjModal(true); }}
                            style={{ color: 'var(--accent-success)', borderColor: 'rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.05)' }}
                        >
                            + Ingreso
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => { setAdjType('egreso'); setShowAdjModal(true); }}
                            style={{ color: 'var(--accent-danger)', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}
                        >
                            - Egreso
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => { 
                                setBuyUsdData(prev => ({ ...prev, cotizacion: cotizacion }));
                                setShowBuyUsdModal(true); 
                            }}
                            style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}
                        >
                            💵 Compra USD
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowMovModal(true)}
                            style={{ boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}
                        >
                            ⇄ Movimiento
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={loadData}
                            title="Actualizar"
                            style={{ width: '42px', padding: '0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                        >
                            ↻
                        </button>
                    </div>
                </div>

                {/* Totals & Exchange Rate Bar */}
                <div style={{ 
                    display: 'flex', 
                    gap: '16px', 
                    alignItems: 'stretch', 
                    flexWrap: 'wrap'
                }}>
                    {/* Multi-currency Totals */}
                    <div style={{
                        display: 'flex',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-lg, 12px)',
                        overflow: 'hidden',
                        flex: '1 1 auto',
                        minWidth: '300px',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <div style={{ padding: '12px 20px', borderRight: '1px solid var(--border-color)', flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pesos (ARS)</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: totalArs >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                {formatCurrency(totalArs)}
                            </div>
                        </div>
                        <div style={{ padding: '12px 20px', borderRight: '1px solid var(--border-color)', flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dólares (USD)</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: totalUsd >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                {formatCurrency(totalUsd, 'USD')}
                            </div>
                        </div>
                        <div style={{ padding: '12px 24px', background: 'var(--bg-secondary)', flex: 1.2, textAlign: 'center', borderLeft: '2px solid var(--accent-primary)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Consolidado</div>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: totalConsolidado >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                {formatCurrency(totalConsolidado)}
                            </div>
                        </div>
                    </div>

                    {/* Exchange Rate Card */}
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-lg, 12px)',
                        padding: '12px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        minWidth: '160px',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cotización USD</label>
                            <span style={{ fontSize: '9px', color: 'var(--accent-primary)', fontWeight: '700', background: 'rgba(99, 102, 241, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>BLUE VENTA</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-secondary)' }}>$</span>
                            {isFetchingDolar && cotizacion === 0 ? (
                                <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '500' }}>Cargando...</span>
                            ) : (
                                <input 
                                    type="number" 
                                    value={cotizacion}
                                    onChange={(e) => setCotizacion(parseFloat(e.target.value) || 0)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-primary)',
                                        fontSize: '22px',
                                        fontWeight: '800',
                                        width: '100%',
                                        outline: 'none',
                                        padding: 0
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Calculando arqueo...
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '20px'
                }}>
                    {data.userStats.map(userStat => {
                        const totalUser = userStat.categoryBalances.reduce((s, c) => s + c.balance, 0);
                        return (
                            <div key={userStat.id} className="card" style={{ overflow: 'hidden' }}>
                                {/* Card header */}
                                <div style={{
                                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary, #6366f1))',
                                    padding: '16px 20px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>
                                            Cobrador
                                        </div>
                                        <div style={{ color: 'white', fontWeight: '700', fontSize: '16px' }}>
                                            {userStat.name}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>
                                            TOTAL
                                        </div>
                                        <div style={{
                                            color: 'white',
                                            fontWeight: '800',
                                            fontSize: '18px'
                                        }}>
                                            {formatCurrency(userStat.categoryBalances.reduce((s, c) => c.categoryName === 'Dólares' ? s : s + c.balance, 0))}
                                            <div style={{ fontSize: '12px', opacity: 0.8, fontWeight: '500' }}>
                                                + {formatCurrency(userStat.categoryBalances.reduce((s, c) => c.categoryName === 'Dólares' ? s + c.balance : s, 0), 'USD')}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Category rows */}
                                <div className="card-body" style={{ padding: '0' }}>
                                    {userStat.categoryBalances.map((cat, idx) => (
                                        <div
                                            key={cat.categoryId}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '14px 20px',
                                                borderBottom: idx < userStat.categoryBalances.length - 1
                                                    ? '1px solid var(--border-color)' : 'none',
                                                transition: 'background 0.15s',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => openCategoryMovements(userStat, cat)}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: cat.balance > 0
                                                        ? 'var(--accent-success)'
                                                        : cat.balance < 0
                                                            ? 'var(--accent-danger)'
                                                            : 'var(--text-muted)'
                                                }} />
                                                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                                    {cat.categoryName}
                                                </span>
                                            </div>
                                            <span style={{
                                                fontWeight: '700',
                                                fontSize: '15px',
                                                color: cat.balance > 0
                                                    ? 'var(--accent-success)'
                                                    : cat.balance < 0
                                                        ? 'var(--accent-danger)'
                                                        : 'var(--text-muted)'
                                            }}>
                                                {formatCurrency(cat.balance, cat.categoryName === 'Dólares' ? 'USD' : 'ARS')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Historial de Movimientos */}
            <div style={{ marginTop: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Historial de Movimientos de Caja</h2>
                    <button className="btn btn-secondary" onClick={handleExportExcel} style={{ fontSize: '13px' }}>
                        📥 Exportar Excel
                    </button>
                </div>
                
                <div className="card" style={{ overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Origen</th>
                                    <th>Destino</th>
                                    <th>Monto</th>
                                    <th>Descripción</th>
                                    {profile?.role === 'admin' && <th style={{ textAlign: 'right' }}>Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {movements.length === 0 ? (
                                    <tr>
                                        <td colSpan={profile?.role === 'admin' ? 6 : 5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                            No hay movimientos registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    movements.map(mov => {
                                        const isIngreso = !mov.from_user_id;
                                        const isEgreso = !mov.to_user_id;
                                        const isTransfer = mov.from_user_id && mov.to_user_id;
                                        
                                        return (
                                            <tr key={mov.id}>
                                                <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                                                    {new Date(mov.date + 'T12:00:00').toLocaleDateString()}
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{mov.fromName}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{mov.fromCategoryName !== 'N/A' ? mov.fromCategoryName : ''}</div>
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{mov.toName}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{mov.toCategoryName !== 'N/A' ? mov.toCategoryName : ''}</div>
                                                </td>
                                                <td style={{ 
                                                    fontWeight: '700', 
                                                    color: isIngreso ? 'var(--accent-success)' : (isEgreso ? 'var(--accent-danger)' : 'var(--text-primary)')
                                                }}>
                                                    {isIngreso ? '+' : (isEgreso ? '-' : '')} {formatCurrency(mov.amount, (mov.fromCategoryName === 'Dólares' || mov.toCategoryName === 'Dólares') ? 'USD' : 'ARS')}
                                                </td>
                                                <td style={{ fontSize: '13px', maxWidth: '300px' }}>
                                                    {mov.description}
                                                </td>
                                                {profile?.role === 'admin' && (
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button 
                                                            className="btn-icon" 
                                                            onClick={() => handleDeleteTransfer(mov.id)}
                                                            style={{ color: 'var(--accent-danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                                            title="Eliminar"
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
                💡 <strong>Saldo</strong> = Cobranzas recibidas + Movimientos recibidos − Gastos realizados − Movimientos enviados
            </div>

            {/* Modal de Movimiento */}
            {showMovModal && (
                <div className="modal-overlay" onClick={() => setShowMovModal(false)}>
                    <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">⇄ Nuevo Movimiento</h3>
                            <button className="modal-close" onClick={() => setShowMovModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                Transferí saldo entre usuarios o entre categorías del mismo usuario.
                            </p>

                            {/* ORIGEN */}
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                padding: '14px',
                                marginBottom: '12px'
                            }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '0.5px' }}>
                                    ORIGEN
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Usuario *</label>
                                        <select className="form-select" value={movData.fromUserId}
                                            onChange={e => setMovData(p => ({ ...p, fromUserId: e.target.value, fromCategoryId: '' }))}>
                                            <option value="">Seleccionar...</option>
                                            {profiles.map(p => (
                                                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Categoría *</label>
                                        <select className="form-select" value={movData.fromCategoryId}
                                            onChange={e => setMovData(p => ({ ...p, fromCategoryId: e.target.value }))}>
                                            <option value="">Seleccionar...</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* DESTINO */}
                            <div style={{
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                padding: '14px',
                                marginBottom: '12px'
                            }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '0.5px' }}>
                                    DESTINO
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Usuario *</label>
                                        <select className="form-select" value={movData.toUserId}
                                            onChange={e => setMovData(p => ({ ...p, toUserId: e.target.value, toCategoryId: '' }))}>
                                            <option value="">Seleccionar...</option>
                                            {profiles.map(p => (
                                                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Categoría *</label>
                                        <select className="form-select" value={movData.toCategoryId}
                                            onChange={e => setMovData(p => ({ ...p, toCategoryId: e.target.value }))}>
                                            <option value="">Seleccionar...</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* MONTO Y FECHA */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">Monto *</label>
                                    <input type="number" className="form-input" min="0.01" step="0.01"
                                        value={movData.amount} placeholder="0.00"
                                        onChange={e => setMovData(p => ({ ...p, amount: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha</label>
                                    <input type="date" className="form-input"
                                        value={movData.date}
                                        onChange={e => setMovData(p => ({ ...p, date: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Descripción</label>
                                <input type="text" className="form-input"
                                    value={movData.description} placeholder="Opcional..."
                                    onChange={e => setMovData(p => ({ ...p, description: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowMovModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleMovimiento}>Confirmar Movimiento</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal Ajustes (Ingreso/Egreso) */}
            {showAdjModal && (
                <div className="modal-overlay" onClick={() => setShowAdjModal(false)}>
                    <div className="modal" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ color: adjType === 'ingreso' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                {adjType === 'ingreso' ? '+ Registrar Ingreso' : '- Registrar Egreso'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowAdjModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                {adjType === 'ingreso' 
                                    ? 'Carga dinero externo directamente a una categoría de un usuario.' 
                                    : 'Retira dinero del arqueo de un usuario para gastos externos o retiros.'}
                            </p>

                            <div className="form-group">
                                <label className="form-label">Usuario Responsable *</label>
                                <select className="form-select" value={adjData.userId}
                                    onChange={e => setAdjData(p => ({ ...p, userId: e.target.value }))}>
                                    <option value="">Seleccionar...</option>
                                    {profiles.map(p => (
                                        <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Categoría Destino/Origen *</label>
                                <select className="form-select" value={adjData.categoryId}
                                    onChange={e => setAdjData(p => ({ ...p, categoryId: e.target.value }))}>
                                    <option value="">Seleccionar...</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">Monto *</label>
                                    <input type="number" className="form-input" min="0.01" step="0.01"
                                        value={adjData.amount} placeholder="0.00"
                                        onChange={e => setAdjData(p => ({ ...p, amount: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha</label>
                                    <input type="date" className="form-input"
                                        value={adjData.date}
                                        onChange={e => setAdjData(p => ({ ...p, date: e.target.value }))} />
                                </div>
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Descripción / Motivo *</label>
                                <input type="text" className="form-input"
                                    value={adjData.description} placeholder="Ej: Saldo inicial, Ajuste, Compra insumos..."
                                    onChange={e => setAdjData(p => ({ ...p, description: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAdjModal(false)}>Cancelar</button>
                            <button 
                                className={`btn ${adjType === 'ingreso' ? 'btn-success' : 'btn-primary'}`} 
                                style={adjType === 'egreso' ? { background: 'var(--accent-danger)', border: 'none' } : {}}
                                onClick={handleAdjustment}
                            >
                                {adjType === 'ingreso' ? 'Confirmar Ingreso' : 'Confirmar Egreso'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Confirmación de Eliminación */}
            <ConfirmModal
                isOpen={!!pendingDeleteId}
                onClose={() => setPendingDeleteId(null)}
                onConfirm={confirmDelete}
                title="¿SEGURO DESEAS ELIMINAR?"
                message="Esta acción no se puede deshacer y los saldos de los usuarios se actualizarán inmediatamente."
            />

            {/* Modal de Detalle de Categoría */}
            {selectedCategoryUser && (
                <div className="modal-overlay" onClick={() => setSelectedCategoryUser(null)}>
                    <div className="modal" style={{ maxWidth: '800px', width: '95%' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                Movimientos: {selectedCategoryUser.category.categoryName} - {selectedCategoryUser.user.name}
                            </h3>
                            <button className="modal-close" onClick={() => setSelectedCategoryUser(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Filtrar por fecha:</label>
                                    <input 
                                        type="date" 
                                        className="form-input" 
                                        style={{ width: 'auto', padding: '6px 12px' }}
                                        value={categoryDateFilter}
                                        onChange={e => setCategoryDateFilter(e.target.value)}
                                    />
                                    {categoryDateFilter && (
                                        <button className="btn-icon" onClick={() => setCategoryDateFilter('')} title="Limpiar filtro">✕</button>
                                    )}
                                </div>
                                <button className="btn btn-secondary" onClick={() => {
                                    // Export logic
                                    const filtered = categoryMovements.filter(m => !categoryDateFilter || m.date === categoryDateFilter);
                                    if (filtered.length === 0) {
                                        toast.warning('No hay movimientos para exportar');
                                        return;
                                    }
                                    const wb = XLSX.utils.book_new();
                                    const exportData = filtered.map(m => ({
                                        'Fecha': new Date(m.date + 'T12:00:00').toLocaleDateString(),
                                        'Tipo': m.type.toUpperCase(),
                                        'Monto': m.amount,
                                        'Descripción': m.description,
                                        'Origen': m.source
                                    }));
                                    const ws = XLSX.utils.json_to_sheet(exportData);
                                    ws['!cols'] = [{wch: 12}, {wch: 10}, {wch: 12}, {wch: 40}, {wch: 15}];
                                    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
                                    XLSX.writeFile(wb, `movimientos_${selectedCategoryUser.user.name.replace(/\s+/g, '_')}_${selectedCategoryUser.category.categoryName.replace(/\s+/g, '_')}_${formatDateLocal()}.xlsx`);
                                }} style={{ fontSize: '13px' }}>
                                    📥 Exportar Excel
                                </button>
                            </div>
                            
                            <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                                <table className="table">
                                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Tipo</th>
                                            <th>Monto</th>
                                            <th>Descripción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoadingCategoryMovements ? (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                                    Cargando movimientos...
                                                </td>
                                            </tr>
                                        ) : categoryMovements.filter(m => !categoryDateFilter || m.date === categoryDateFilter).length === 0 ? (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                                    No hay movimientos registrados para esta categoría{categoryDateFilter ? ' en la fecha seleccionada' : ''}.
                                                </td>
                                            </tr>
                                        ) : (
                                            categoryMovements
                                                .filter(m => !categoryDateFilter || m.date === categoryDateFilter)
                                                .map(mov => (
                                                <tr key={mov.id}>
                                                    <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                                                        {new Date(mov.date + 'T12:00:00').toLocaleDateString()}
                                                    </td>
                                                    <td style={{ 
                                                        fontWeight: '700', 
                                                        fontSize: '12px',
                                                        color: mov.type === 'ingreso' ? 'var(--accent-success)' : 'var(--accent-danger)'
                                                    }}>
                                                        {mov.type.toUpperCase()}
                                                    </td>
                                                    <td style={{ 
                                                        fontWeight: '700', 
                                                        color: mov.type === 'ingreso' ? 'var(--accent-success)' : 'var(--accent-danger)'
                                                    }}>
                                                        {mov.type === 'ingreso' ? '+' : '-'} {formatCurrency(mov.amount, selectedCategoryUser.category.categoryName === 'Dólares' ? 'USD' : 'ARS')}
                                                    </td>
                                                    <td style={{ fontSize: '13px', maxWidth: '300px' }}>
                                                        {mov.description}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Compra de Dólares */}
            {showBuyUsdModal && (
                <div className="modal-overlay" onClick={() => setShowBuyUsdModal(false)}>
                    <div className="modal" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ color: '#10b981' }}>
                                💵 Compra de Dólares
                            </h3>
                            <button className="modal-close" onClick={() => setShowBuyUsdModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                Registra un egreso de pesos y un ingreso automático en tu categoría Dólares.
                            </p>

                            <div className="form-group">
                                <label className="form-label">Usuario Responsable *</label>
                                <select className="form-select" value={buyUsdData.userId}
                                    onChange={e => setBuyUsdData(p => ({ ...p, userId: e.target.value }))}>
                                    <option value="">Seleccionar...</option>
                                    {profiles.map(p => (
                                        <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">Categoría Origen (ARS) *</label>
                                    <select className="form-select" value={buyUsdData.fromCategoryId}
                                        onChange={e => setBuyUsdData(p => ({ ...p, fromCategoryId: e.target.value }))}>
                                        <option value="">Seleccionar...</option>
                                        {categories.filter(c => c.name !== 'Dólares').map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cotización Aplicada *</label>
                                    <input type="number" className="form-input" min="0.01" step="0.01"
                                        value={buyUsdData.cotizacion} placeholder="Cotización"
                                        onChange={e => handleCotizacionChange(e.target.value)} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">Total ARS a gastar *</label>
                                    <input type="number" className="form-input" min="0.01" step="0.01"
                                        value={buyUsdData.amountArs} placeholder="0.00"
                                        onChange={e => handleAmountArsChange(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Total USD a recibir *</label>
                                    <input type="number" className="form-input" min="0.01" step="0.01"
                                        value={buyUsdData.amountUsd} placeholder="0.00"
                                        onChange={e => handleAmountUsdChange(e.target.value)} />
                                </div>
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Fecha</label>
                                <input type="date" className="form-input"
                                    value={buyUsdData.date}
                                    onChange={e => setBuyUsdData(p => ({ ...p, date: e.target.value }))} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Descripción Opcional</label>
                                <input type="text" className="form-input"
                                    value={buyUsdData.description} placeholder="Detalles de la compra..."
                                    onChange={e => setBuyUsdData(p => ({ ...p, description: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowBuyUsdModal(false)}>Cancelar</button>
                            <button 
                                className="btn" 
                                style={{ background: '#10b981', color: 'white', border: 'none' }}
                                onClick={handleBuyUsd}
                            >
                                Confirmar Compra
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
