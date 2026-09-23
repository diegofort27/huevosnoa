const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) acc[key.trim()] = rest.join('=').trim();
    return acc;
}, {});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;


const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Fetching data...');
    const { data: clients } = await supabase.from('clients').select('*');
    const { data: sales } = await supabase.from('sales').select('*');
    const { data: collections } = await supabase.from('collections').select('*');
    const { data: adjustments } = await supabase.from('client_adjustments').select('*');

    console.log(`Found ${clients.length} clients, ${sales.length} sales, ${collections.length} collections, ${adjustments.length} adjustments.`);

    for (const c of clients) {
        // Find children of this client
        const children = clients.filter(child => Number(child.parent_id) === Number(c.id));
        const childrenIds = children.map(ch => Number(ch.id));
        const allRelatedIds = [Number(c.id), ...childrenIds];

        // Movements for this client AND all its children
        const cSales = sales.filter(s => allRelatedIds.includes(Number(s.client_id)));
        const cCollections = collections.filter(col => allRelatedIds.includes(Number(col.client_id)));
        const cAdjustments = adjustments.filter(adj => allRelatedIds.includes(Number(adj.client_id)));

        const deliveredSalesTotal = cSales.reduce((sum, s) => sum + (s.is_delivered ? parseFloat(s.total || 0) : 0), 0);
        const collectionsTotal = cCollections.reduce((sum, col) => sum + parseFloat(col.amount || 0), 0);
        const adjustmentsTotal = cAdjustments.reduce((sum, adj) => {
            const val = parseFloat(adj.amount || 0);
            return sum + (adj.type === 'increase' ? val : -val);
        }, 0);

        let calculatedBalance = deliveredSalesTotal - collectionsTotal + adjustmentsTotal;

        // If it's a child, its balance should be 0, as movements go to parent
        // Wait, Cuentas Corrientes logic calculates it for the child too, but maybe it's just for display?
        // Actually, the app's Cuentas Corrientes page says:
        // "Si se asigna, todos los movimientos de este cliente impactarán en la cuenta corriente del padre."
        // Wait, if movements impact the parent, the child's balance should be 0.
        // Let's check `api.js`: resolveBalanceClientId returns the parent id.
        // So the child's balance column SHOULD be 0. The parent accumulates it.
        // If it's a child, we set its balance to 0, since the parent will sum the child's movements.
        if (c.parent_id) {
            calculatedBalance = 0;
        }

        const currentBalance = parseFloat(c.balance || 0);
        if (Math.abs(calculatedBalance - currentBalance) > 0.01) {
            console.log(`Updating client ${c.id} (${c.name}): ${currentBalance} -> ${calculatedBalance}`);
            await supabase.from('clients').update({ balance: calculatedBalance }).eq('id', c.id);
        }
    }

    console.log('Done!');
}

main().catch(console.error);
