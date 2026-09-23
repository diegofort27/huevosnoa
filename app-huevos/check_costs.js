require('dotenv').config({ path: './.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCosts() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'maestro@example.com',
        password: 'usuario'
    });

    if (authError) {
        console.error("Auth error:", authError);
        return;
    }

    console.log("Logged in!");

    const { data: products } = await supabase
        .from('products')
        .select('id, description, cost');
    
    console.log("Current product costs:", products);

    // Let's find historical prices.
    const { data: scheduled } = await supabase
        .from('scheduled_price_changes')
        .select('*')
        .order('effective_date', { ascending: false });

    console.log("Scheduled price changes count:", scheduled?.length);
    console.log("Price history:", scheduled);

    // Get all sales from August
    const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select(`
            id, date, total,
            sale_items (id, product_id, quantity, unit_price, unit_cost)
        `)
        .gte('date', '2026-08-01')
        .lte('date', '2026-08-31');

    const fs = require('fs');
    fs.writeFileSync('sales_august.json', JSON.stringify({ sales, scheduled, products }, null, 2));
    console.log("Wrote data to sales_august.json");
}

checkCosts();
