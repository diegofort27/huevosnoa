import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

export async function GET(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Faltan credenciales de Supabase' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'App Huevos';
    workbook.created = new Date();

    const tablesToExport = [
      'profiles',
      'clients',
      'products',
      'price_lists',
      'price_list_items',
      'sales',
      'sale_items',
      'collections',
      'client_adjustments',
      'providers',
      'expenses',
      'purchases',
      'purchase_items',
      'provider_adjustments',
      'transfers',
      'arqueo_categories',
      'scheduled_price_changes',
      'comprobantes',
      'comprobante_items',
      'zones'
    ];

    for (const tableName of tablesToExport) {
      const { data, error } = await supabase.from(tableName).select('*');

      if (error) {
        console.error(`Error al leer tabla ${tableName}:`, error.message);
        continue;
      }

      if (!data || data.length === 0) {
        continue; // Omitir tabla si no hay datos
      }

      const worksheet = workbook.addWorksheet(tableName);

      const columns = Object.keys(data[0]).map(key => ({
        header: key.toUpperCase(),
        key: key,
        width: 20
      }));
      worksheet.columns = columns;

      data.forEach(row => {
        worksheet.addRow(row);
      });

      worksheet.getRow(1).font = { bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    // Si el usuario solicita formato JSON
    const url = new URL(request.url);
    if (url.searchParams.get('format') === 'json') {
      const fullBackup = {};
      for (const tableName of tablesToExport) {
        const { data } = await supabase.from(tableName).select('*');
        fullBackup[tableName] = data || [];
      }
      return new NextResponse(JSON.stringify(fullBackup, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="Backup_Portabilidad_Completa_${timestamp}.json"`
        }
      });
    }

    // Configurar headers para descarga Excel por defecto
    const headers = new Headers();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    headers.append('Content-Disposition', `attachment; filename="Backup_App_Huevos_${timestamp}.xlsx"`);
    headers.append('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    return new NextResponse(buffer, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('Error generando backup:', error);
    return NextResponse.json({ error: 'Error interno generando el backup' }, { status: 500 });
  }
}
