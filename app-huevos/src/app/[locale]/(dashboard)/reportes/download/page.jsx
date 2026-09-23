'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';
import { formatDateLocal } from '@/lib/utils';
import AnimatedModal from '@/components/ui/AnimatedModal';
import AnimatedButton from '@/components/ui/AnimatedButton';
import { toast } from 'sonner';
import { 
    Download, 
    FileSpreadsheet, 
    FileText, 
    Plus, 
    Calendar, 
    Users, 
    Package, 
    TrendingUp, 
    DollarSign, 
    ShoppingCart, 
    Wallet 
} from 'lucide-react';

export default function DownloadPage() {
    const locale = useLocale();
    const [showModal, setShowModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Form state
    const todayStr = formatDateLocal();
    const firstDayStr = `${todayStr.slice(0, 7)}-01`;

    const [reportType, setReportType] = useState('sales_by_client');
    const [startDate, setStartDate] = useState(firstDayStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [format, setFormat] = useState('excel'); // 'excel' or 'pdf'

    const reportOptions = [
        { id: 'sales_by_client', label: 'Ventas por Cliente', icon: Users, desc: 'Ranking de facturación y número de compras por cliente' },
        { id: 'sales_by_product', label: 'Ventas por Producto', icon: Package, desc: 'Unidades vendidas y facturación por tipo de producto' },
        { id: 'sales_daily', label: 'Ventas Diarias (Detalle entre Fechas)', icon: Calendar, desc: 'Comprobantes día a día con forma de pago' },
        { id: 'sales_monthly', label: 'Ventas Mensuales Comparativas', icon: TrendingUp, desc: 'Evolución comparativa acumulada por mes' },
        { id: 'debtors', label: 'Clientes Deudores (Cuentas Corrientes)', icon: DollarSign, desc: 'Saldos exigibles, teléfono y dirección' },
        { id: 'purchases', label: 'Compras a Proveedores', icon: ShoppingCart, desc: 'Facturas recibidas de proveedores' },
        { id: 'arqueo_summary', label: 'Movimientos de Caja y Arqueo', icon: Wallet, desc: 'Transferencias y movimientos de caja' }
    ];

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(val || 0);
    };

    // Generic Report Generator Handler
    const handleGenerateReport = async (type = reportType, start = startDate, end = endDate, exportFormat = format) => {
        setIsGenerating(true);
        try {
            if (type === 'sales_by_client') {
                await generateSalesByClientReport(start, end, exportFormat);
            } else if (type === 'sales_by_product') {
                await generateSalesByProductReport(start, end, exportFormat);
            } else if (type === 'sales_daily') {
                await generateDailySalesReport(start, end, exportFormat);
            } else if (type === 'sales_monthly') {
                await generateMonthlySalesReport(exportFormat);
            } else if (type === 'debtors') {
                await generateDebtorsReport(exportFormat);
            } else if (type === 'purchases') {
                await generatePurchasesReport(start, end, exportFormat);
            } else if (type === 'arqueo_summary') {
                await generateArqueoReport(start, end, exportFormat);
            }
            setShowModal(false);
            toast.success('Reporte generado y descargado con éxito');
        } catch (error) {
            console.error('Error generando reporte:', error);
            toast.error('Error al generar el reporte: ' + (error.message || 'Error de datos'));
        } finally {
            setIsGenerating(false);
        }
    };

    // Helper to fetch all records handling Supabase 1000 limit pagination
    const fetchAllPaginated = async (table, selectClause, buildQuery = (q) => q) => {
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            let query = supabase.from(table).select(selectClause);
            query = buildQuery(query);
            const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
            if (error) throw error;
            if (data && data.length > 0) {
                allData = allData.concat(data);
                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }
        }
        return allData;
    };

    // 1. Ventas por Cliente
    const generateSalesByClientReport = async (start, end, exportFormat) => {
        const sales = await fetchAllPaginated('sales', 'id, total, date, clients:client_id(name)', q => q.gte('date', start).lte('date', end));

        const clientMap = {};
        (sales || []).forEach(s => {
            const name = s.clients?.name || 'Consumidor Final';
            const amount = parseFloat(s.total || 0);
            if (!clientMap[name]) {
                clientMap[name] = { name, count: 0, total: 0 };
            }
            clientMap[name].count += 1;
            clientMap[name].total += amount;
        });

        const rows = Object.values(clientMap).sort((a, b) => b.total - a.total);
        const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

        if (exportFormat === 'pdf') {
            exportToPDF({
                title: 'Reporte de Ventas por Cliente',
                subtitle: `Período: ${start} al ${end} | Total: ${formatCurrency(grandTotal)}`,
                columns: [
                    { header: 'Cliente', dataKey: 'name' },
                    { header: 'Operaciones', dataKey: 'count', align: 'center' },
                    { header: 'Facturación ($)', dataKey: 'totalFormatted', align: 'right' }
                ],
                data: rows.map(r => ({ ...r, totalFormatted: formatCurrency(r.total) })),
                filename: `ventas_por_cliente_${start}_${end}.pdf`,
                totals: { name: 'TOTAL GENERAL', count: sales.length, totalFormatted: formatCurrency(grandTotal) }
            });
        } else {
            exportToExcel({
                title: 'Reporte de Ventas por Cliente',
                columns: [
                    { header: 'Cliente', dataKey: 'name', width: 35 },
                    { header: 'Operaciones', dataKey: 'count', width: 15 },
                    { header: 'Facturación ($)', dataKey: 'total', width: 20 }
                ],
                data: rows,
                filename: `ventas_por_cliente_${start}_${end}.xlsx`,
                totals: { name: 'TOTAL GENERAL', count: sales.length, total: grandTotal }
            });
        }
    };

    // 2. Ventas por Producto
    const generateSalesByProductReport = async (start, end, exportFormat) => {
        const sales = await fetchAllPaginated('sales', `
            id,
            date,
            sale_items (
                quantity,
                total,
                unit_price,
                products:product_id (
                    description
                )
            )
        `, q => q.gte('date', start).lte('date', end));

        const prodMap = {};
        (sales || []).forEach(s => {
            const items = s.sale_items || [];
            items.forEach(item => {
                const desc = item.products?.description || 'Producto';
                const qty = parseFloat(item.quantity || 0);
                const total = parseFloat(item.total || (qty * parseFloat(item.unit_price || 0)) || 0);

                if (!prodMap[desc]) {
                    prodMap[desc] = { description: desc, qty: 0, total: 0 };
                }
                prodMap[desc].qty += qty;
                prodMap[desc].total += total;
            });
        });

        const rows = Object.values(prodMap).sort((a, b) => b.total - a.total);
        const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
        const grandQty = rows.reduce((sum, r) => sum + r.qty, 0);

        if (exportFormat === 'pdf') {
            exportToPDF({
                title: 'Reporte de Ventas por Producto',
                subtitle: `Período: ${start} al ${end} | Total: ${formatCurrency(grandTotal)}`,
                columns: [
                    { header: 'Producto / Descripción', dataKey: 'description' },
                    { header: 'Unidades Vendidas', dataKey: 'qty', align: 'center' },
                    { header: 'Monto Total ($)', dataKey: 'totalFormatted', align: 'right' }
                ],
                data: rows.map(r => ({ ...r, totalFormatted: formatCurrency(r.total) })),
                filename: `ventas_por_producto_${start}_${end}.pdf`,
                totals: { description: 'TOTAL GENERAL', qty: grandQty, totalFormatted: formatCurrency(grandTotal) }
            });
        } else {
            exportToExcel({
                title: 'Reporte de Ventas por Producto',
                columns: [
                    { header: 'Producto', dataKey: 'description', width: 40 },
                    { header: 'Unidades', dataKey: 'qty', width: 15 },
                    { header: 'Monto Total ($)', dataKey: 'total', width: 20 }
                ],
                data: rows,
                filename: `ventas_por_producto_${start}_${end}.xlsx`,
                totals: { description: 'TOTAL GENERAL', qty: grandQty, total: grandTotal }
            });
        }
    };

    // 3. Ventas Diarias entre Fechas
    const generateDailySalesReport = async (start, end, exportFormat) => {
        const sales = await fetchAllPaginated('sales', 'id, date, payment_method, total, clients:client_id(name)', q => q.gte('date', start).lte('date', end).order('date', { ascending: true }));

        const rows = (sales || []).map(s => ({
            date: s.date,
            client: s.clients?.name || 'Consumidor Final',
            method: s.payment_method || 'Efectivo',
            amount: parseFloat(s.total || 0)
        }));

        const grandTotal = rows.reduce((sum, r) => sum + r.amount, 0);

        if (exportFormat === 'pdf') {
            exportToPDF({
                title: 'Reporte Diarios de Ventas',
                subtitle: `Período: ${start} al ${end} | Total: ${formatCurrency(grandTotal)}`,
                columns: [
                    { header: 'Fecha', dataKey: 'date' },
                    { header: 'Cliente', dataKey: 'client' },
                    { header: 'Forma de Pago', dataKey: 'method' },
                    { header: 'Monto ($)', dataKey: 'amountFormatted', align: 'right' }
                ],
                data: rows.map(r => ({ ...r, amountFormatted: formatCurrency(r.amount) })),
                filename: `ventas_diarias_${start}_${end}.pdf`,
                totals: { date: 'TOTAL', client: `${rows.length} comprobantes`, method: '', amountFormatted: formatCurrency(grandTotal) }
            });
        } else {
            exportToExcel({
                title: 'Reporte Diarios de Ventas',
                columns: [
                    { header: 'Fecha', dataKey: 'date', width: 15 },
                    { header: 'Cliente', dataKey: 'client', width: 30 },
                    { header: 'Forma de Pago', dataKey: 'method', width: 20 },
                    { header: 'Monto ($)', dataKey: 'amount', width: 18 }
                ],
                data: rows,
                filename: `ventas_diarias_${start}_${end}.xlsx`,
                totals: { date: 'TOTAL', client: `${rows.length} comprobantes`, method: '', amount: grandTotal }
            });
        }
    };

    // 4. Ventas Mensuales Comparativas
    const generateMonthlySalesReport = async (exportFormat) => {
        const sales = await fetchAllPaginated('sales', 'id, date, total');

        const monthMap = {};
        (sales || []).forEach(s => {
            const monthKey = s.date ? s.date.slice(0, 7) : 'Sin fecha';
            const amount = parseFloat(s.total || 0);
            if (!monthMap[monthKey]) {
                monthMap[monthKey] = { month: monthKey, count: 0, total: 0 };
            }
            monthMap[monthKey].count += 1;
            monthMap[monthKey].total += amount;
        });

        const rows = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
        const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

        if (exportFormat === 'pdf') {
            exportToPDF({
                title: 'Reporte de Ventas Mensuales Comparativas',
                subtitle: `Evolución Histórica por Mes | Total: ${formatCurrency(grandTotal)}`,
                columns: [
                    { header: 'Año - Mes', dataKey: 'month' },
                    { header: 'Comprobantes', dataKey: 'count', align: 'center' },
                    { header: 'Facturación ($)', dataKey: 'totalFormatted', align: 'right' }
                ],
                data: rows.map(r => ({ ...r, totalFormatted: formatCurrency(r.total) })),
                filename: `ventas_mensuales_comparativo.pdf`,
                totals: { month: 'TOTAL ACUMULADO', count: sales.length, totalFormatted: formatCurrency(grandTotal) }
            });
        } else {
            exportToExcel({
                title: 'Reporte de Ventas Mensuales Comparativas',
                columns: [
                    { header: 'Año - Mes', dataKey: 'month', width: 20 },
                    { header: 'Comprobantes', dataKey: 'count', width: 15 },
                    { header: 'Facturación ($)', dataKey: 'total', width: 20 }
                ],
                data: rows,
                filename: `ventas_mensuales_comparativo.xlsx`,
                totals: { month: 'TOTAL ACUMULADO', count: sales.length, total: grandTotal }
            });
        }
    };

    // 5. Clientes Deudores
    const generateDebtorsReport = async (exportFormat) => {
        const clients = await fetchAllPaginated('clients', 'name, phone, address, balance', q => q.gt('balance', 0).order('balance', { ascending: false }));

        const rows = (clients || []).map(c => ({
            name: c.name,
            phone: c.phone || 'S/D',
            address: c.address || 'S/D',
            balance: parseFloat(c.balance || 0)
        }));

        const grandTotal = rows.reduce((sum, r) => sum + r.balance, 0);

        if (exportFormat === 'pdf') {
            exportToPDF({
                title: 'Listado de Clientes Deudores (Cuentas Corrientes)',
                subtitle: `Total Deuda Exigible: ${formatCurrency(grandTotal)} | Clientes: ${rows.length}`,
                columns: [
                    { header: 'Cliente', dataKey: 'name' },
                    { header: 'Teléfono', dataKey: 'phone' },
                    { header: 'Dirección', dataKey: 'address' },
                    { header: 'Saldo Deudor ($)', dataKey: 'balanceFormatted', align: 'right' }
                ],
                data: rows.map(r => ({ ...r, balanceFormatted: formatCurrency(r.balance) })),
                filename: `deudores_${todayStr}.pdf`,
                totals: { name: 'TOTAL DEUDA', phone: '', address: '', balanceFormatted: formatCurrency(grandTotal) }
            });
        } else {
            exportToExcel({
                title: 'Listado de Clientes Deudores',
                columns: [
                    { header: 'Cliente', dataKey: 'name', width: 30 },
                    { header: 'Teléfono', dataKey: 'phone', width: 18 },
                    { header: 'Dirección', dataKey: 'address', width: 30 },
                    { header: 'Saldo Deudor ($)', dataKey: 'balance', width: 20 }
                ],
                data: rows,
                filename: `deudores_${todayStr}.xlsx`,
                totals: { name: 'TOTAL DEUDA', phone: '', address: '', balance: grandTotal }
            });
        }
    };

    // 6. Compras a Proveedores
    const generatePurchasesReport = async (start, end, exportFormat) => {
        const purchases = await fetchAllPaginated('purchases', 'id, date, invoice_number, total, providers:provider_id(name)', q => q.gte('date', start).lte('date', end).order('date', { ascending: false }));

        const rows = (purchases || []).map(p => ({
            date: p.date,
            provider: p.providers?.name || 'Proveedor',
            invoice: p.invoice_number || 'S/N',
            amount: parseFloat(p.total || 0)
        }));

        const grandTotal = rows.reduce((sum, r) => sum + r.amount, 0);

        if (exportFormat === 'pdf') {
            exportToPDF({
                title: 'Reporte de Compras a Proveedores',
                subtitle: `Período: ${start} al ${end} | Total Compras: ${formatCurrency(grandTotal)}`,
                columns: [
                    { header: 'Fecha', dataKey: 'date' },
                    { header: 'Proveedor', dataKey: 'provider' },
                    { header: 'Comprobante', dataKey: 'invoice' },
                    { header: 'Monto Total ($)', dataKey: 'amountFormatted', align: 'right' }
                ],
                data: rows.map(r => ({ ...r, amountFormatted: formatCurrency(r.amount) })),
                filename: `compras_${start}_${end}.pdf`,
                totals: { date: 'TOTAL COMPRAS', provider: `${rows.length} facturas`, invoice: '', amountFormatted: formatCurrency(grandTotal) }
            });
        } else {
            exportToExcel({
                title: 'Reporte de Compras a Proveedores',
                columns: [
                    { header: 'Fecha', dataKey: 'date', width: 15 },
                    { header: 'Proveedor', dataKey: 'provider', width: 30 },
                    { header: 'Comprobante', dataKey: 'invoice', width: 20 },
                    { header: 'Monto Total ($)', dataKey: 'amount', width: 18 }
                ],
                data: rows,
                filename: `compras_${start}_${end}.xlsx`,
                totals: { date: 'TOTAL COMPRAS', provider: `${rows.length} facturas`, invoice: '', amount: grandTotal }
            });
        }
    };

    // 7. Arqueo y Movimientos
    const generateArqueoReport = async (start, end, exportFormat) => {
        const transfers = await fetchAllPaginated('transfers', 'id, date, description, amount', q => q.gte('date', start).lte('date', end).order('date', { ascending: false }));

        const rows = (transfers || []).map(t => ({
            date: t.date,
            description: t.description || 'Movimiento de Caja',
            amount: parseFloat(t.amount || 0)
        }));

        const grandTotal = rows.reduce((sum, r) => sum + r.amount, 0);

        if (exportFormat === 'pdf') {
            exportToPDF({
                title: 'Reporte de Movimientos de Caja y Arqueo',
                subtitle: `Período: ${start} al ${end} | Total Movido: ${formatCurrency(grandTotal)}`,
                columns: [
                    { header: 'Fecha', dataKey: 'date' },
                    { header: 'Descripción / Concepto', dataKey: 'description' },
                    { header: 'Monto ($)', dataKey: 'amountFormatted', align: 'right' }
                ],
                data: rows.map(r => ({ ...r, amountFormatted: formatCurrency(r.amount) })),
                filename: `arqueo_movimientos_${start}_${end}.pdf`,
                totals: { date: 'TOTAL MOVIMIENTOS', description: `${rows.length} registros`, amountFormatted: formatCurrency(grandTotal) }
            });
        } else {
            exportToExcel({
                title: 'Reporte de Movimientos de Caja y Arqueo',
                columns: [
                    { header: 'Fecha', dataKey: 'date', width: 15 },
                    { header: 'Descripción', dataKey: 'description', width: 40 },
                    { header: 'Monto ($)', dataKey: 'amount', width: 18 }
                ],
                data: rows,
                filename: `arqueo_movimientos_${start}_${end}.xlsx`,
                totals: { date: 'TOTAL MOVIMIENTOS', description: `${rows.length} registros`, amount: grandTotal }
            });
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>Centro de Descargas</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        Generación instantánea de reportes comerciales, financieros e inventario en PDF y Excel
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={18} />
                    <span>Generar Nuevo Reporte</span>
                </button>
            </div>

            {/* Quick Preset Downloads Grid */}
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '8px' }}>
                🚀 Accesos Directos a Reportes Frecuentes
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Preset 1 */}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)', borderRadius: '10px' }}>
                            <Users size={24} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Ventas por Cliente (Mes Actual)</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Total facturado y número de pedidos por cliente en los últimos 30 días.
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                        <button className="btn btn-secondary" style={{ flex: 1, fontSize: '13px' }} onClick={() => handleGenerateReport('sales_by_client', firstDayStr, todayStr, 'pdf')}>
                            <FileText size={16} color="#ef4444" /> PDF
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, fontSize: '13px' }} onClick={() => handleGenerateReport('sales_by_client', firstDayStr, todayStr, 'excel')}>
                            <FileSpreadsheet size={16} color="#10b981" /> Excel
                        </button>
                    </div>
                </div>

                {/* Preset 2 */}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)', borderRadius: '10px' }}>
                            <Package size={24} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Ranking de Productos (Mes)</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Unidades vendidas y monto acumulado por cada tipo de producto.
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                        <button className="btn btn-secondary" style={{ flex: 1, fontSize: '13px' }} onClick={() => handleGenerateReport('sales_by_product', firstDayStr, todayStr, 'pdf')}>
                            <FileText size={16} color="#ef4444" /> PDF
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, fontSize: '13px' }} onClick={() => handleGenerateReport('sales_by_product', firstDayStr, todayStr, 'excel')}>
                            <FileSpreadsheet size={16} color="#10b981" /> Excel
                        </button>
                    </div>
                </div>

                {/* Preset 3 */}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-danger)', borderRadius: '10px' }}>
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Listado de Deudores</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Cuentas corrientes exigibles con teléfono y dirección del cliente.
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                        <button className="btn btn-secondary" style={{ flex: 1, fontSize: '13px' }} onClick={() => handleGenerateReport('debtors', firstDayStr, todayStr, 'pdf')}>
                            <FileText size={16} color="#ef4444" /> PDF
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, fontSize: '13px' }} onClick={() => handleGenerateReport('debtors', firstDayStr, todayStr, 'excel')}>
                            <FileSpreadsheet size={16} color="#10b981" /> Excel
                        </button>
                    </div>
                </div>

                {/* Preset 4 */}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                        <div style={{ padding: '12px', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple, #a855f7)', borderRadius: '10px' }}>
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Comparativo Mensual de Ventas</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Evolución mes a mes del total facturado y cantidad de ventas.
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                        <button className="btn btn-secondary" style={{ flex: 1, fontSize: '13px' }} onClick={() => handleGenerateReport('sales_monthly', firstDayStr, todayStr, 'pdf')}>
                            <FileText size={16} color="#ef4444" /> PDF
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, fontSize: '13px' }} onClick={() => handleGenerateReport('sales_monthly', firstDayStr, todayStr, 'excel')}>
                            <FileSpreadsheet size={16} color="#10b981" /> Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Interactive Generator Modal */}
            <AnimatedModal isOpen={showModal} onClose={() => setShowModal(false)} maxWidth="640px">
                <div style={{ padding: '8px 0' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        ⚙️ Generador de Reportes a Medida
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                        Selecciona el tipo de reporte, rango de fechas y formato deseado.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Custom Card Selector Grid for Report Types */}
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                Seleccionar Tipo de Reporte
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                                {reportOptions.map(opt => {
                                    const Icon = opt.icon;
                                    const isSelected = reportType === opt.id;
                                    return (
                                        <div
                                            key={opt.id}
                                            onClick={() => setReportType(opt.id)}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '10px',
                                                border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                                background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-tertiary)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '12px',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <div style={{
                                                padding: '8px',
                                                borderRadius: '8px',
                                                background: isSelected ? 'var(--accent-primary)' : 'var(--bg-card)',
                                                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <Icon size={18} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: '600', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                                    {opt.label}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.3' }}>
                                                    {opt.desc}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Rango de Fechas */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    Fecha Desde
                                </label>
                                <input 
                                    type="date" 
                                    className="input" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)}
                                    style={{ width: '100%', padding: '9px 12px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    Fecha Hasta
                                </label>
                                <input 
                                    type="date" 
                                    className="input" 
                                    value={endDate} 
                                    onChange={(e) => setEndDate(e.target.value)}
                                    style={{ width: '100%', padding: '9px 12px' }}
                                />
                            </div>
                        </div>

                        {/* Formato de Descarga */}
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                Formato de Salida
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button 
                                    type="button" 
                                    className={`btn ${format === 'excel' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setFormat('excel')}
                                    style={{ justifyContent: 'center' }}
                                >
                                    <FileSpreadsheet size={18} /> Excel (.xlsx)
                                </button>
                                <button 
                                    type="button" 
                                    className={`btn ${format === 'pdf' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setFormat('pdf')}
                                    style={{ justifyContent: 'center' }}
                                >
                                    <FileText size={18} /> Documento PDF (.pdf)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                        <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={isGenerating}>
                            Cancelar
                        </button>
                        <AnimatedButton 
                            className="btn btn-primary" 
                            isLoading={isGenerating} 
                            onClick={() => handleGenerateReport()}
                            icon={Download}
                        >
                            Generar y Descargar
                        </AnimatedButton>
                    </div>
                </div>
            </AnimatedModal>
        </div>
    );
}
