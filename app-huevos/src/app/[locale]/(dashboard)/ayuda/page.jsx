'use client';

import { useTranslations } from 'next-intl';

export default function ManualPage() {
    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                <span style={{ fontSize: '48px' }}>📖</span>
                <h1 style={{ fontSize: '28px', fontWeight: '700', marginTop: '12px' }}>Manual de Usuario y Centro de Ayuda</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
                    Guía completa de uso operativo del sistema para administradores, vendedores y repartidores.
                </p>
                <div style={{ marginTop: '16px' }}>
                    <a
                        href="/api/manual-instalacion-pdf"
                        download="Guia_Paso_a_Paso_Cliente_Nuevo.pdf"
                        className="btn btn-primary"
                        style={{ padding: '10px 20px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                        📄 Descargar PDF: Guía de Alta de Clientes Nuevos (Auto-actualizable)
                    </a>
                </div>
            </div>

            <div style={{ display: 'grid', gap: '24px' }}>
                
                {/* 1. Inicio Rápido */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">🚀 1. Primeros Pasos y Configuración Inicial</h3>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <p><strong>Configurar Identidad de Empresa:</strong> Ve a <code>Configuración (Settings)</code> para subir el logo, CUIT, teléfono y dirección fiscal de tu negocio. Estos datos aparecerán en todos los recibos y comprobantes.</p>
                        <p><strong>Crear Zonas de Reparto:</strong> En la sección <code>Zonas</code>, define los barrios o rutas de entrega (ej: Zona Norte, Centro, Ruta 1) para clasificar a tus clientes.</p>
                        <p><strong>Cargar Productos e Inventario:</strong> En <code>Productos</code>, agrega tu catálogo declarando el costo, precio de venta sugerido y stock inicial por bulto/cajón o unidad.</p>
                    </div>
                </div>

                {/* 2. Ventas y Reparto */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">🛒 2. Gestión de Ventas, Hojas de Ruta y Reparto</h3>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <p><strong>Cargar Nueva Venta:</strong> En <code>Ventas</code>, presiona <code>+ Nueva Venta</code>, selecciona el cliente, el medio de pago (Efectivo, Transferencia, Cta Cte) y los productos. El stock se descontará automáticamente.</p>
                        <p><strong>Hojas de Ruta de Reparto:</strong> Desde la pestaña <code>Reparto</code>, puedes filtrar las entregas del día por Zona, marcar pedidos como entregados y emitir comprobantes de entrega.</p>
                    </div>
                </div>

                {/* 3. Cuentas Corrientes y Cobranzas */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">💳 3. Cuentas Corrientes y Cobranzas</h3>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <p><strong>Registrar Cobros y Entrega de Dinero:</strong> En <code>Cobranzas</code>, registra los pagos parciales o totales de los clientes que compran a Cuenta Corriente.</p>
                        <p><strong>Estado de Cuentas:</strong> En <code>Cuentas Corrientes</code> puedes visualizar el saldo adeudado por cada cliente, aplicar bonificaciones o realizar ajustes de saldo.</p>
                    </div>
                </div>

                {/* 4. Arqueos de Caja y Gastos */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">💵 4. Control de Caja, Gastos y Compras</h3>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <p><strong>Arqueo de Caja Diario:</strong> En <code>Arqueo</code> puedes hacer el cierre de caja diario, registrar el conteo físico de billetes y detectar diferencias en efectivo, bancos o dólares.</p>
                        <p><strong>Registro de Gastos:</strong> En <code>Gastos</code>, ingresa todos los egresos operativos (combustible, sueldos, mantenimiento) para obtener un cálculo preciso de tu Ganancia Neta en el tablero.</p>
                    </div>
                </div>

                {/* 5. Respaldos y Exportación */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">💾 5. Copias de Respaldo y Portabilidad de Datos</h3>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <p><strong>Descargar Respaldo:</strong> En <code>Respaldo (Backup)</code>, haz clic en <code>Exportar 100% Datos (JSON Portable)</code> o <code>Descargar en Excel</code> para guardar un respaldo completo del negocio en tu computadora.</p>
                    </div>
                </div>

            </div>
        </div>
    );
}
