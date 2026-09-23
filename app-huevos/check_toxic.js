// Script para consultar movimientos de DRUGSTORE LA TOXIC
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kpcavxrjowmxavpioheb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwY2F2eHJqb3dteGF2cGlvaGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTgwODEsImV4cCI6MjA5NTU3NDA4MX0.t9fjAojsFj3ATNr4tRjzyUmkbMy-S7sjx_jmqozgWQ8'
);

async function investigar() {
  // 1. Buscar el cliente
  const { data: clientes, error: cErr } = await supabase
    .from('clients')
    .select('id, name, sale_condition, parent_id')
    .ilike('name', '%toxic%');
  
  if (cErr) { console.error('Error buscando cliente:', cErr.message); return; }
  
  if (!clientes || clientes.length === 0) {
    console.log('No se encontro cliente con "toxic" en el nombre');
    return;
  }
  
  console.log('=== CLIENTE ENCONTRADO ===');
  console.log(JSON.stringify(clientes, null, 2));
  
  const clienteId = clientes[0].id;
  
  // 2. Ventas
  const { data: ventas } = await supabase
    .from('sales')
    .select('id, date, total, is_delivered, client_id')
    .eq('client_id', clienteId);
  
  console.log('\n=== VENTAS ===');
  console.log(JSON.stringify(ventas, null, 2));
  
  // 3. Cobranzas
  const { data: cobranzas } = await supabase
    .from('collections')
    .select('id, date, amount, payment_method, client_id')
    .eq('client_id', clienteId);
  
  console.log('\n=== COBRANZAS ===');
  console.log(JSON.stringify(cobranzas, null, 2));
  
  // 4. Ajustes
  const { data: ajustes } = await supabase
    .from('client_adjustments')
    .select('id, date, amount, type, description, client_id')
    .eq('client_id', clienteId);
  
  console.log('\n=== AJUSTES ===');
  console.log(JSON.stringify(ajustes, null, 2));
  
  // Calcular saldo
  const totalVentas = (ventas || []).filter(v => v.is_delivered).reduce((s, v) => s + parseFloat(v.total || 0), 0);
  const totalCobranzas = (cobranzas || []).reduce((s, c) => s + parseFloat(c.amount || 0), 0);
  const totalAjustes = (ajustes || []).reduce((s, a) => s + (a.type === 'increase' ? parseFloat(a.amount || 0) : -parseFloat(a.amount || 0)), 0);
  
  console.log('\n=== RESUMEN ===');
  console.log('Total ventas entregadas:', totalVentas);
  console.log('Total cobranzas:', totalCobranzas);
  console.log('Total ajustes:', totalAjustes);
  console.log('SALDO FINAL:', totalVentas - totalCobranzas + totalAjustes);
}

investigar().catch(console.error);
