import { NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function GET() {
    try {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Colores y diseño
        const primaryColor = [79, 70, 229]; // Indigo
        const secondaryColor = [30, 41, 59]; // Slate

        // Título Principal
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 24, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('GUIA DE INSTALACION PASO A PASO: CLIENTE NUEVO', 14, 15);

        doc.setTextColor(...secondaryColor);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Explicación súper sencilla para conectar Supabase y Vercel en 2 minutos.', 14, 32);

        // --- OPCIÓN 1 ---
        doc.setFillColor(241, 245, 249);
        doc.rect(14, 38, 182, 10, 'F');
        doc.setTextColor(...primaryColor);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('OPCION 1: El cliente te envía sus 2 Claves (Tokens de Acceso)', 18, 44);

        const op1Steps = [
            ['Paso 1', 'El cliente entra a Vercel.com -> Settings -> Tokens -> "Create Token" y te manda la clave.'],
            ['Paso 2', 'El cliente entra a Supabase.com -> Account -> Access Tokens -> "Generate New Token" y te lo manda.'],
            ['Paso 3', 'Tú ejecutas en tu computadora: npm run deploy-cliente -- --custom-tokens'],
            ['Paso 4', 'Pegas sus 2 claves, escribes el nombre del negocio y presionas Enter. ¡Listo! URL entregada.']
        ];

        autoTable(doc, {
            startY: 50,
            head: [['Paso', 'Instrucción Ultra Sencilla']],
            body: op1Steps,
            theme: 'striped',
            headStyles: { fillColor: primaryColor }
        });

        // --- OPCIÓN 2 ---
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFillColor(241, 245, 249);
        doc.rect(14, finalY, 182, 10, 'F');
        doc.setTextColor(...primaryColor);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('OPCION 2: Invitación de Equipo (El cliente te agrega como Administrador)', 18, finalY + 6);

        const op2Steps = [
            ['Paso 1', 'El cliente entra a Vercel.com -> Members -> "Invite Member" y pone tu email.'],
            ['Paso 2', 'El cliente entra a Supabase.com -> Organization -> Members -> "Invite" y pone tu email.'],
            ['Paso 3', 'Aceptas la invitación en tu mail.'],
            ['Paso 4', 'Ejecutas npm run deploy-cliente desde tu consola. ¡Se crea directamente en la cuenta de él!']
        ];

        autoTable(doc, {
            startY: finalY + 12,
            head: [['Paso', 'Instrucción Ultra Sencilla']],
            body: op2Steps,
            theme: 'striped',
            headStyles: { fillColor: primaryColor }
        });

        // Pie de página
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('Este documento PDF se genera dinámicamente en tiempo real desde la API del sistema.', 14, 285);

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="Guia_Paso_a_Paso_Cliente_Nuevo.pdf"'
            }
        });

    } catch (err) {
        console.error('Error generando PDF:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
