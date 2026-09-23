/**
 * fiscal.js — Lógica de cálculo fiscal argentino (ARCA/AFIP)
 * Funciones puras sin dependencias de Supabase.
 */

// ============================================================
// VALIDACIÓN DE CUIT
// ============================================================

/**
 * Valida el dígito verificador de un CUIT argentino.
 * Acepta formatos: XX-XXXXXXXX-X, XXXXXXXXXXX, XX XXXXXXXX X
 */
export function validarCuit(cuit) {
    if (!cuit) return false;
    const clean = cuit.replace(/[-\s]/g, '');
    if (!/^\d{11}$/.test(clean)) return false;

    const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let total = 0;
    for (let i = 0; i < 10; i++) {
        total += parseInt(clean[i]) * mult[i];
    }
    const resto = total % 11;
    const dvCalculado = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
    return dvCalculado === parseInt(clean[10]);
}

/**
 * Formatea un CUIT al formato estándar XX-XXXXXXXX-X
 */
export function formatearCuit(cuit) {
    if (!cuit) return '';
    const clean = cuit.replace(/[-\s]/g, '');
    if (clean.length !== 11) return cuit;
    return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean[10]}`;
}

/**
 * Limpia el CUIT (solo números)
 */
export function limpiarCuit(cuit) {
    return (cuit || '').replace(/[-\s]/g, '');
}

// ============================================================
// DETERMINACIÓN DE TIPO DE COMPROBANTE
// ============================================================

/**
 * Determina el tipo de comprobante a emitir según condiciones fiscales.
 * @param {string} condicionEmisor - codigo: 'RI', 'MO', 'EX', etc.
 * @param {string} condicionReceptor - codigo: 'RI', 'MO', 'CF', 'EX', etc.
 * @param {string} tipoOperacion - 'nacional' | 'exportacion'
 * @returns {string} codigo del tipo de comprobante: 'FA', 'FB', 'FC', 'FE'
 */
export function determinarTipoComprobante(condicionEmisor, condicionReceptor, tipoOperacion = 'nacional') {
    if (tipoOperacion === 'exportacion') return 'FE';

    const emisorRI = ['RI', 'SRL', 'SA'].includes(condicionEmisor);
    const receptorRI = ['RI', 'SRL', 'SA'].includes(condicionReceptor);

    if (!emisorRI) {
        // Monotributista o exento: siempre Factura C
        return 'FC';
    }

    if (receptorRI) {
        return 'FA'; // RI a RI: Factura A (IVA discriminado)
    }

    return 'FB'; // RI a consumidor final / monotributista / exento: Factura B
}

/**
 * Determina el tipo de nota de débito/crédito según el tipo de factura original
 */
export function determinarTipoNota(tipoFacturaOriginal, esDebito = true) {
    const map = {
        FA: esDebito ? 'NDA' : 'NCA',
        FB: esDebito ? 'NDB' : 'NCB',
        FC: esDebito ? 'NDC' : 'NCC',
        FCEA: esDebito ? 'NDA' : 'NCA',
        FCEB: esDebito ? 'NDB' : 'NCB',
    };
    return map[tipoFacturaOriginal] || (esDebito ? 'NDB' : 'NCB');
}

// ============================================================
// CÁLCULOS DE IVA
// ============================================================

/**
 * Calcula el importe de IVA sobre el neto.
 * SIEMPRE sobre el neto, nunca sobre el total.
 * @param {number} neto - Precio neto (sin IVA)
 * @param {number} alicuota - Porcentaje: 0, 10.5, 21, 27
 * @returns {number} Importe de IVA redondeado a 2 decimales
 */
export function calcularIva(neto, alicuota) {
    return round2(parseFloat(neto || 0) * (parseFloat(alicuota || 0) / 100));
}

/**
 * Convierte precio con IVA incluido a neto.
 * @param {number} precioConIva
 * @param {number} alicuota
 * @returns {number} precio neto
 */
export function precioConIvaANeto(precioConIva, alicuota) {
    const factor = 1 + parseFloat(alicuota || 0) / 100;
    return round2(parseFloat(precioConIva || 0) / factor);
}

/**
 * Calcula los totales fiscales de una lista de ítems de comprobante.
 * @param {Array} items - Cada item: { precioUnitarioNeto, cantidad, alicuotaPorcentaje, tipoGravamen }
 * @param {boolean} discriminaIva - Si el tipo de comprobante discrimina IVA
 * @returns {Object} Totales desglosados por alícuota
 */
export function calcularTotalesComprobante(items, discriminaIva = true) {
    const totales = {
        neto_gravado_27: 0,
        neto_gravado_21: 0,
        neto_gravado_105: 0,
        neto_gravado_0: 0,
        neto_no_gravado: 0,
        neto_exento: 0,
        iva_27: 0,
        iva_21: 0,
        iva_105: 0,
        total_otros_tributos: 0,
        subtotal_neto: 0,
        total_iva: 0,
        total_comprobante: 0,
    };

    for (const item of items) {
        const neto = round2(parseFloat(item.precioUnitarioNeto || 0) * parseFloat(item.cantidad || 1));
        const alicuota = parseFloat(item.alicuotaPorcentaje || 0);
        const tipo = item.tipoGravamen || 'gravado';

        if (tipo === 'no_gravado') {
            totales.neto_no_gravado += neto;
        } else if (tipo === 'exento') {
            totales.neto_exento += neto;
        } else if (tipo === 'iva_cero' || alicuota === 0) {
            totales.neto_gravado_0 += neto;
        } else if (alicuota === 27) {
            totales.neto_gravado_27 += neto;
            if (discriminaIva) totales.iva_27 += calcularIva(neto, 27);
        } else if (alicuota === 21) {
            totales.neto_gravado_21 += neto;
            if (discriminaIva) totales.iva_21 += calcularIva(neto, 21);
        } else if (alicuota === 10.5) {
            totales.neto_gravado_105 += neto;
            if (discriminaIva) totales.iva_105 += calcularIva(neto, 10.5);
        }
    }

    // Redondear todo a 2 decimales
    for (const key of Object.keys(totales)) {
        totales[key] = round2(totales[key]);
    }

    totales.subtotal_neto = round2(
        totales.neto_gravado_27 +
        totales.neto_gravado_21 +
        totales.neto_gravado_105 +
        totales.neto_gravado_0 +
        totales.neto_no_gravado +
        totales.neto_exento
    );

    totales.total_iva = round2(totales.iva_27 + totales.iva_21 + totales.iva_105);

    // En facturas B/C el IVA está incluido en el precio unitario
    if (!discriminaIva) {
        totales.total_comprobante = totales.subtotal_neto;
    } else {
        totales.total_comprobante = round2(totales.subtotal_neto + totales.total_iva + totales.total_otros_tributos);
    }

    return totales;
}

// ============================================================
// CÁLCULO DE RETENCIONES
// ============================================================

/**
 * Calcula el importe de una retención o percepción.
 * @param {number} baseImponible
 * @param {number} alicuota - porcentaje
 * @param {number} montoMinimo - si la base no supera este mínimo, no se retiene
 * @returns {number} importe de retención
 */
export function calcularRetencion(baseImponible, alicuota, montoMinimo = 0) {
    const base = parseFloat(baseImponible || 0);
    if (base <= parseFloat(montoMinimo || 0)) return 0;
    return round2(base * parseFloat(alicuota || 0) / 100);
}

// ============================================================
// PERÍODO FISCAL
// ============================================================

/**
 * Obtiene el período fiscal actual en formato AAAAMM
 */
export function getPeriodoActual() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Convierte fecha a período fiscal AAAAMM
 */
export function fechaAPeriodo(fecha) {
    const d = new Date(fecha + 'T12:00:00');
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Formatea período AAAAMM a texto legible: "Enero 2025"
 */
export function formatearPeriodo(periodo) {
    if (!periodo || periodo.length !== 6) return periodo;
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const anio = parseInt(periodo.slice(0, 4));
    const mes = parseInt(periodo.slice(4, 6)) - 1;
    return `${meses[mes]} ${anio}`;
}

/**
 * Retorna lista de períodos de los últimos N meses
 */
export function getUltimosPeriodos(n = 12) {
    const periodos = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const p = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
        periodos.push({ valor: p, label: formatearPeriodo(p) });
    }
    return periodos;
}

// ============================================================
// EXPORTACIÓN LIBRO IVA DIGITAL (formato ARCA)
// ============================================================

/**
 * Genera el contenido CSV del Libro IVA Digital compatible con ARCA.
 * Sin cabecera, separado por punto y coma.
 * @param {Array} comprobantes - lista de comprobantes del período
 * @param {string} tipo - 'ventas' | 'compras'
 * @returns {string} contenido CSV
 */
export function generarLibroIvaCSV(comprobantes, tipo = 'ventas') {
    const lines = [];

    for (const c of comprobantes) {
        if (c.anulado) continue;

        const fecha = (c.fecha_emision || '').replace(/-/g, '');
        const tipoCmp = c.tipo_comprobante_codigo || '';
        const pventa = String(c.punto_venta || 1).padStart(5, '0');
        const numero = String(c.numero || 0).padStart(8, '0');
        const cuit = limpiarCuit(c.cuit_receptor || c.cuit_emisor || '');
        const rs = (c.razon_social_receptor || c.razon_social_emisor || '').substring(0, 40);
        const condicion = c.condicion_iva_receptor || '';

        const neto21 = fmtImporte(c.neto_gravado_21);
        const neto105 = fmtImporte(c.neto_gravado_105);
        const neto27 = fmtImporte(c.neto_gravado_27);
        const netoNoGrav = fmtImporte(c.neto_no_gravado);
        const exento = fmtImporte(c.neto_exento);
        const iva21 = fmtImporte(c.iva_21);
        const iva105 = fmtImporte(c.iva_105);
        const iva27 = fmtImporte(c.iva_27);
        const total = fmtImporte(c.total_comprobante);

        lines.push([
            fecha,
            tipoCmp,
            pventa,
            numero,
            cuit,
            rs,
            condicion,
            neto21,
            neto105,
            neto27,
            netoNoGrav,
            exento,
            iva21,
            iva105,
            iva27,
            total
        ].join(';'));
    }

    return lines.join('\n');
}

/**
 * Genera el contenido TXT del SICORE (retenciones practicadas)
 * Formato ARCA: sin cabecera, separado por punto y coma
 */
export function generarSicoreTXT(retenciones, cuitAgente) {
    const lines = [];
    for (const r of retenciones) {
        lines.push([
            limpiarCuit(cuitAgente),
            r.periodo_fiscal,
            r.codigo_impuesto || '217',  // 217 = IVA
            r.codigo_regimen || '01',
            (r.fecha || '').replace(/-/g, ''),
            limpiarCuit(r.cuit_retenido || r.cuit_agente),
            fmtImporte(r.base_imponible),
            fmtImporte(r.importe),
            r.tipo_comprobante || 'F',
            r.nro_certificado || ''
        ].join(';'));
    }
    return lines.join('\n');
}

// ============================================================
// QR OBLIGATORIO ARCA (para PDF de factura electrónica)
// ============================================================

/**
 * Genera los datos del QR obligatorio de ARCA
 * URL: https://www.afip.gob.ar/fe/qr/?p={base64(json)}
 */
export function generarDatosQR(comprobante, cotizacion = 1) {
    const data = {
        ver: 1,
        fecha: comprobante.fecha_emision,
        cuit: parseInt(limpiarCuit(comprobante.cuit_emisor)),
        ptoVta: comprobante.punto_venta,
        tipoCmp: comprobante.codigo_afip_comprobante,
        nroCmp: comprobante.numero,
        importe: comprobante.total_comprobante,
        moneda: comprobante.moneda || 'PES',
        ctz: cotizacion,
        tipoDocRec: 80,  // 80 = CUIT, 96 = DNI
        nroDocRec: parseInt(limpiarCuit(comprobante.cuit_receptor)) || 0,
        tipoCodAut: 'E',  // E = CAE
        codAut: parseInt(comprobante.cae || 0)
    };

    const json = JSON.stringify(data);
    const base64 = Buffer.from(json).toString('base64');
    return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
}

// ============================================================
// HELPERS INTERNOS
// ============================================================

function round2(n) {
    return Math.round((parseFloat(n) || 0) * 100) / 100;
}

function fmtImporte(n) {
    return (parseFloat(n) || 0).toFixed(2);
}
