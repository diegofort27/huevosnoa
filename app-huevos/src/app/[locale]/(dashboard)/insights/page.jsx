'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function InsightsPage() {
    const t = useTranslations('nav');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [monthsFilter, setMonthsFilter] = useState(12);
    const [chartData, setChartData] = useState(null);

    useEffect(() => {
        loadData();
    }, [monthsFilter]);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            let data = [];
            
            if (monthsFilter === 0) { // Desde siempre
                const { data: allData, error: apiErr } = await supabase
                    .from('sales')
                    .select('date, total');
                if (apiErr) {
                    console.error("Supabase Error (all):", apiErr);
                    throw apiErr;
                }
                data = allData || [];
            } else {
                const start = new Date();
                start.setMonth(start.getMonth() - monthsFilter + 1);
                start.setDate(1);
                start.setHours(0,0,0,0);
                const startStr = start.toISOString().split('T')[0];

                const { data: rangeData, error: apiErr } = await supabase
                    .from('sales')
                    .select('date, total')
                    .gte('date', startStr);
                if (apiErr) {
                    console.error("Supabase Error (range):", apiErr);
                    throw apiErr;
                }
                data = rangeData || [];
            }

            // Agrupar por mes
            const grouped = {};
            
            if (monthsFilter > 0) {
                // Pre-rellenar meses para que salgan en orden aunque no haya ventas
                for (let i = monthsFilter - 1; i >= 0; i--) {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    grouped[key] = 0;
                }
            }

            data.forEach(sale => {
                if (!sale.date) return;
                
                const monthKey = sale.date.substring(0, 7); // YYYY-MM
                if (grouped[monthKey] === undefined && monthsFilter === 0) {
                    grouped[monthKey] = 0;
                }
                if (grouped[monthKey] !== undefined) {
                    grouped[monthKey] += parseFloat(sale.total || 0);
                }
            });

            const sortedKeys = Object.keys(grouped).sort();
            const labels = sortedKeys.map(k => {
                const [y, m] = k.split('-');
                const date = new Date(y, m - 1, 1);
                // Evitamos problemas de zona horaria formateando manualmente o con locale en UTC
                const monthName = date.toLocaleDateString('es-AR', { month: 'short' });
                return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${y}`;
            });
            const values = sortedKeys.map(k => grouped[k]);

            setChartData({
                labels,
                datasets: [
                    {
                        label: 'Ventas en Pesos (ARS)',
                        data: values,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#6366f1',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }
                ]
            });
            
        } catch (error) {
            console.error('Error loading insights:', error);
            setError('Error al cargar las estadísticas. Revisa tu conexión.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value, currency = 'ARS') => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0
        }).format(value);
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return formatCurrency(context.raw);
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return '$' + new Intl.NumberFormat('es-AR', { notation: 'compact' }).format(value);
                    }
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };

    return (
        <div style={{ paddingBottom: '40px' }}>
            <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: '600' }}>{t('insights')}</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                Análisis de ventas a lo largo del tiempo.
            </p>

            {error && (
                <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '24px' }}>
                    <p style={{ color: 'var(--accent-danger)' }}>{error}</p>
                    <button className="btn btn-primary" onClick={loadData} style={{ marginTop: '12px' }}>Reintentar</button>
                </div>
            )}

            <div className="card">
                <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <h3 className="card-title" style={{ margin: 0 }}>Historial de Ventas (Pesos)</h3>
                    <select 
                        className="form-select" 
                        style={{ width: 'auto', minWidth: '150px' }}
                        value={monthsFilter}
                        onChange={(e) => setMonthsFilter(Number(e.target.value))}
                        disabled={isLoading}
                    >
                        <option value={3}>Últimos 3 meses</option>
                        <option value={6}>Últimos 6 meses</option>
                        <option value={12}>Últimos 12 meses</option>
                        <option value={24}>Últimos 24 meses</option>
                        <option value={0}>Desde siempre</option>
                    </select>
                </div>
                <div className="card-body" style={{ padding: '32px', minHeight: '400px' }}>
                    {isLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                            <div className="spinner"></div>
                        </div>
                    ) : chartData ? (
                        <div style={{ height: '350px' }}>
                            <Line data={chartData} options={chartOptions} />
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                            No hay datos suficientes para mostrar el gráfico.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
