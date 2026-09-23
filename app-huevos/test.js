const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if(k && v.length) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const start = Date.now();
supabase.from('sales').select('*, clients:client_id(name, zone_id), sale_items(id, product_id, quantity, unit_price, total, discount_applied, products:product_id(description))').order('id', {ascending: false}).limit(1500).then(res => {
  try {
        const sales = res.data;
        const processed = (sales || []).map(sale => {
            const client = Array.isArray(sale.clients) ? sale.clients[0] : sale.clients;
            
            const items = (sale.sale_items || []).map(item => {
                const product = Array.isArray(item.products) ? item.products[0] : item.products;
                return {
                    id: item.id,
                    productId: item.product_id,
                    quantity: parseFloat(item.quantity || 0),
                    unitPrice: parseFloat(item.unit_price || 0),
                    total: parseFloat(item.total || 0),
                    productName: product?.description,
                    discount_applied: item.discount_applied
                };
            });

            return {
                id: sale.id,
                clientId: sale.client_id,
                clientName: client?.name,
                zoneId: client?.zone_id,
                date: sale.date,
                total: parseFloat(sale.total || 0),
                saleType: sale.sale_type,
                status: sale.status,
                isDelivered: sale.is_delivered,
                createdAt: sale.created_at,
                items
            };
        });
        console.log('Processed successfully!');
  } catch(e) {
      console.error("MAPPING ERROR:", e);
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
