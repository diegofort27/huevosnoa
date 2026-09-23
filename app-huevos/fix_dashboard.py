import re

with open(r'src\lib\api.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select(`
                *,
                clients:client_id (name, zone_id, zones:zone_id (name)),
                sale_items (*)
            `)
            .gte('date', monthStartStr)
            .order('date', { ascending: false });

        if (salesError) {
            console.error('API Dashboard: Error fetching sales:', salesError);
            throw salesError;
        }

        const safeSales = sales || [];

        // Fetch products to map names if needed (though sale_items should have it or we can join)
        const { data: products } = await supabase.from('products').select('id, description');"""

new = """        const [salesResult, productsResult] = await Promise.all([
            supabase.from('sales').select('*, clients:client_id (name, zone_id, zones:zone_id (name)), sale_items (*)').gte('date', monthStartStr).order('date', { ascending: false }),
            supabase.from('products').select('id, description')
        ]);

        if (salesResult.error) {
            console.error('API Dashboard: Error fetching sales:', salesResult.error);
            throw salesResult.error;
        }

        const sales = salesResult.data;
        const products = productsResult.data;
        const safeSales = sales || [];"""

content = content.replace(old, new)

with open(r'src\lib\api.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('OK' if new in content else 'FAILED')
