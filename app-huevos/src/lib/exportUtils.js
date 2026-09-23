import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

/**
 * Standardized PDF exporter for tabular reports
 */
export const exportToPDF = ({
    title = 'Reporte',
    subtitle = '',
    columns = [], // Array of { header: string, dataKey: string, align?: string }
    data = [],    // Array of objects
    filename = 'reporte.pdf',
    companyInfo = { name: 'Distribuidora de Huevos', subtitle: 'Gestión Comercial & Logística' },
    totals = null  // Object matching data keys or summary key-values
}) => {
    const doc = new jsPDF({
        orientation: columns.length > 6 ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Header background bar
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(0, 0, pageWidth, 24, 'F');

    // Company Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(companyInfo.name, 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225); // Slate-300
    doc.text(companyInfo.subtitle, 14, 18);

    // Date
    const today = new Date().toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    doc.text(`Fecha: ${today}`, pageWidth - 14, 15, { align: 'right' });

    // 2. Report Title & Subtitle
    let startY = 32;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text(title, 14, startY);

    if (subtitle) {
        startY += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // Slate-500
        doc.text(subtitle, 14, startY);
    }

    startY += 8;

    // 3. Prepare Table Headers and Rows
    const head = [columns.map(col => col.header)];
    const body = data.map(item =>
        columns.map(col => {
            const val = item[col.dataKey];
            return val !== undefined && val !== null ? String(val) : '';
        })
    );

    // If totals exist, add a totals row
    if (totals) {
        const totalRow = columns.map((col, idx) => {
            if (idx === 0) return 'TOTAL';
            const totalVal = totals[col.dataKey];
            return totalVal !== undefined && totalVal !== null ? String(totalVal) : '';
        });
        body.push(totalRow);
    }

    // Column alignment styling
    const columnStyles = {};
    columns.forEach((col, idx) => {
        if (col.align) {
            columnStyles[idx] = { halign: col.align };
        }
    });

    // 4. Generate AutoTable
    autoTable(doc, {
        startY: startY,
        head: head,
        body: body,
        theme: 'striped',
        headStyles: {
            fillColor: [51, 65, 85], // Slate-700
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
        },
        bodyStyles: {
            fontSize: 8.5,
            textColor: [51, 65, 85]
        },
        columnStyles: columnStyles,
        didParseCell: (cellData) => {
            // Style totals row
            if (totals && cellData.section === 'body' && cellData.rowIndex === body.length - 1) {
                cellData.cell.styles.fontStyle = 'bold';
                cellData.cell.styles.fillColor = [241, 245, 249]; // Slate-100
                cellData.cell.styles.textColor = [15, 23, 42];
            }
        },
        didDrawPage: (dataPage) => {
            // Footer page numbering
            const totalPages = doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(
                `Página ${dataPage.pageNumber} de ${totalPages}`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        },
        margin: { top: 30, left: 14, right: 14, bottom: 15 }
    });

    // Save File
    doc.save(filename);
};

/**
 * Standardized Excel Exporter using ExcelJS
 */
export const exportToExcel = async ({
    title = 'Reporte',
    columns = [], // Array of { header: string, dataKey: string, width?: number }
    data = [],
    filename = 'reporte.xlsx',
    sheetName = 'Datos',
    totals = null
}) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Title Block
    worksheet.mergeCells('A1', `${String.fromCharCode(64 + Math.max(columns.length, 1))}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title.toUpperCase();
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(1).height = 30;

    // Blank row
    worksheet.addRow([]);

    // Headers
    const headerRow = worksheet.addRow(columns.map(c => c.header));
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Data rows
    data.forEach(item => {
        const rowValues = columns.map(c => item[c.dataKey] ?? '');
        const row = worksheet.addRow(rowValues);
        row.height = 20;
        row.eachCell((cell) => {
            cell.font = { name: 'Arial', size: 9 };
            cell.alignment = { vertical: 'middle' };
        });
    });

    // Totals row if provided
    if (totals) {
        const totalValues = columns.map((c, idx) => idx === 0 ? 'TOTAL' : totals[c.dataKey] ?? '');
        const totalRow = worksheet.addRow(totalValues);
        totalRow.height = 22;
        totalRow.eachCell((cell) => {
            cell.font = { name: 'Arial', size: 10, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.alignment = { vertical: 'middle' };
        });
    }

    // Auto-fit column widths
    worksheet.columns.forEach((col, idx) => {
        const columnDef = columns[idx];
        if (columnDef && columnDef.width) {
            col.width = columnDef.width;
        } else {
            let maxLen = columnDef?.header ? columnDef.header.length : 12;
            col.eachCell({ includeEmpty: false }, (cell) => {
                const len = cell.value ? String(cell.value).length : 0;
                if (len > maxLen) maxLen = len;
            });
            col.width = Math.min(Math.max(maxLen + 4, 12), 40);
        }
    });

    // Generate buffer and trigger download in browser
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
};
