import { supabase } from './supabase';
import { formatDateLocal } from './utils';

/**
 * Robust data fetch with timeout protection.
 * No retries - fails fast and lets the UI show a retry button.
 */
const robustFetch = async (operation, context = 'API') => {
    let timeoutId;
    try {
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Timeout: ${context} tardó más de 30s`));
            }, 30000); // Aumentado a 30s para conexiones móviles inestables
        });

        const result = await Promise.race([operation(), timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
    } catch (error) {
        clearTimeout(timeoutId);
        console.error(`${context}: Error.`, error.message);
        throw error;
    }
};

// --- HELPERS ---
const resolveBalanceClientId = async (clientId) => {
    const { data: client } = await supabase
        .from('clients')
        .select('id, parent_id')
        .eq('id', clientId)
        .single();
    
    // Si tiene padre, devolvemos el ID del padre. Si no, su propio ID.
    return client?.parent_id || clientId;
};

// --- CLIENTS ---
export const getClients = async () => {
    return robustFetch(async () => {
        console.log('API Clients: Fetching clients...');
        const { data, error } = await supabase.from('clients').select('*').order('name');
        console.log('API Clients: Clients fetched. Count:', (data || []).length);
        if (error) throw error;
        return data || [];
    }, 'getClients');
};

export const createClient = async (client) => {
    const { data, error } = await supabase.from('clients').insert([client]).select();
    if (error) throw error;
    return data[0];
};

export const updateClient = async (id, updates) => {
    const { data, error } = await supabase.from('clients').update(updates).eq('id', id).select();
    if (error) throw error;
    return data[0];
};

export const deleteClient = async (id) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    return true;
};

export const getClientAdjustments = async (clientId = null) => {
    return robustFetch(async () => {
        let query = supabase.from('client_adjustments').select('*').order('date', { ascending: false });
        if (clientId) {
            query = query.in('client_id', Array.isArray(clientId) ? clientId : [clientId]);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }, 'getClientAdjustments');
};

export const createClientAdjustment = async (adj) => {
    try {
        const { data, error } = await supabase.from('client_adjustments').insert([{
            client_id: adj.clientId,
            amount: adj.amount,
            type: adj.type,
            description: adj.description,
            date: adj.date,
            created_by: adj.editorId || adj.userId
        }]).select();
        if (error) throw error;

        return data[0];
    } catch (e) {
        console.error('API: Error creando ajuste:', e);
        throw e;
    }
};

// --- PRODUCTS ---
export const getProducts = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase.from('products').select('*, scheduled_price_changes(*)').order('description');
        if (error) throw error;
        return data || [];
    }, 'getProducts');
};

export const createProduct = async (product) => {
    try {
        const { data, error } = await supabase.from('products').insert([product]).select();
        if (error) throw error;
        return data[0];
    } catch (e) {
        console.error('API: Error creando producto:', e);
        throw e;
    }
};

export const updateProduct = async (id, updates) => {
    try {
        console.log(`API: Actualizando producto ${id}:`, updates);
        const { data, error } = await supabase.from('products').update(updates).eq('id', id).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No se encontró el producto para actualizar');

        // Update custom price lists to track the new base price
        if (updates.base_price !== undefined) {
            console.log(`API: Sincronizando nuevo precio base (${updates.base_price}) para el producto ${id} en las listas de precios`);
            await supabase.from('price_list_items').update({ price: updates.base_price }).eq('product_id', id);
        }

        return data[0];
    } catch (e) {
        console.error('API: Error actualizando producto:', e);
        throw e;
    }
};

export const deleteProduct = async (id) => {
    try {
        console.log(`API: Eliminando producto ${id}`);
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('API: Error eliminando producto:', e);
        throw e;
    }
};

export const schedulePriceChange = async (productId, newCost, newBasePrice, effectiveDate) => {
    try {
        console.log(`API: Programando cambio de precio para producto ${productId} a partir de ${effectiveDate}`);
        const { data, error } = await supabase.from('scheduled_price_changes').insert([{
            product_id: productId,
            new_cost: newCost,
            new_base_price: newBasePrice,
            effective_date: effectiveDate
        }]).select();
        if (error) throw error;
        return data[0];
    } catch (e) {
        console.error('API: Error programando cambio de precio:', e);
        throw e;
    }
};

export const uploadProductImage = async (file) => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('products')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('products')
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (e) {
        console.error('API: Error subiendo imagen:', e);
        throw e;
    }
};

// --- PRICE LISTS ---
export const getPriceLists = async () => {
    return robustFetch(async () => {
        console.log('API Clients: Fetching price lists...');
        const { data: lists, error } = await supabase
            .from('price_lists')
            .select(`
                *,
                price_list_items (
                    product_id,
                    price,
                    discounts
                )
            `)
            .order('id');
            
        console.log('API Clients: Price lists fetched. Count:', (lists || []).length);
        if (error) throw error;

        return (lists || []).map(list => ({
            ...list,
            products: (list.price_list_items || []).map(item => ({
                productId: item.product_id,
                price: item.price,
                discounts: item.discounts
            }))
        }));
    }, 'getPriceLists');
};

export const createPriceList = async (name) => {
    const { data, error } = await supabase.from('price_lists').insert([{ name }]).select();
    if (error) throw error;
    return data[0];
};

export const updatePriceList = async (id, name) => {
    const { data, error } = await supabase.from('price_lists').update({ name }).eq('id', id).select();
    if (error) throw error;
    return data[0];
};

export const deletePriceList = async (id) => {
    // 1. Find VENTA list to reassign clients
    const { data: ventaList } = await supabase.from('price_lists').select('id').eq('name', 'VENTA').single();
    const fallbackId = ventaList?.id;

    if (fallbackId && parseInt(id) === fallbackId) {
        throw new Error('No se puede eliminar la lista base VENTA');
    }

    // 2. Reassign clients
    if (fallbackId) {
        await supabase.from('clients').update({ price_list_id: fallbackId }).eq('price_list_id', id);
    }

    // 3. Delete items
    await supabase.from('price_list_items').delete().eq('price_list_id', id);

    // 4. Delete list
    const { error } = await supabase.from('price_lists').delete().eq('id', id);
    if (error) throw error;
    return true;
};

export const updatePriceListItem = async (priceListId, productId, price, discounts) => {
    return robustFetch(async () => {
        const { data, error } = await supabase
            .from('price_list_items')
            .upsert({
                price_list_id: priceListId,
                product_id: productId,
                price: price,
                discounts: discounts
            }, { onConflict: 'price_list_id, product_id' })
            .select();

        if (error) throw error;
        return data[0];
    }, 'updatePriceListItem');
};

// --- SALES ---
export const getSales = async (clientIds = null) => {
    return robustFetch(async () => {
        // Fetch sales with client info and items in a single query
        let query = supabase
            .from('sales')
            .select(`
                *,
                clients:client_id (
                    name,
                    zone_id
                ),
                sale_items (
                    id,
                    product_id,
                    quantity,
                    unit_price,
                    total,
                    discount_applied,
                    products:product_id (
                        description
                    )
                )
            `)
            .order('id', { ascending: false });

        if (clientIds) {
            query = query.in('client_id', Array.isArray(clientIds) ? clientIds : [clientIds]);
        } else {
            query = query.limit(1500);
        }

        const { data: sales, error: salesError } = await query;

        if (salesError) throw salesError;

        // Combine data
        return (sales || []).map(sale => {
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
    }, 'getSales');
};

export const createSale = async (saleData) => {
    // 1. OBTENER COSTOS DE PRODUCTOS Y STOCK
    const productIds = saleData.items.map(i => i.productId);
    const { data: products, error: productsError } = await supabase.from('products').select('id, cost, current_stock').in('id', productIds);
    
    if (productsError) throw productsError;
    
    const costMap = (products || []).reduce((acc, p) => ({ ...acc, [p.id]: parseFloat(p.cost || 0) }), {});
    const stockMap = (products || []).reduce((acc, p) => ({ ...acc, [p.id]: parseFloat(p.current_stock || 0) }), {});

    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{
            client_id: saleData.clientId,
            date: saleData.date,
            sale_type: saleData.saleType,
            status: saleData.status,
            total: saleData.total,
            is_delivered: saleData.isDelivered || false,
            user_id: saleData.userId,
            created_by: saleData.editorId || saleData.userId
        }])
        .select()
        .single();

    if (saleError) throw saleError;

    const itemsToInsert = saleData.items.map(item => {
        const productCost = costMap[item.productId] || 0;
        return {
            sale_id: sale.id,
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            unit_cost: productCost,
            total: item.total,
            discount_applied: item.discount ? [item.discount] : null
        };
    });

    const { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert);
    if (itemsError) throw itemsError;

    // 2. DESCONTAR STOCK DE LOS PRODUCTOS VENDIDOS
    for (const item of saleData.items) {
        const currentStock = stockMap[item.productId] || 0;
        const newStock = currentStock - parseFloat(item.quantity);
        await supabase.from('products').update({ current_stock: newStock }).eq('id', item.productId);
    }

    logAuditEvent({
        tableName: 'sales',
        type: 'sale',
        operation: 'create',
        recordId: sale.id,
        amount: saleData.total,
        newData: saleData,
        description: `Venta creada #${sale.id}`
    });

    return sale;
};

export const updateSaleDeliveryStatus = async (saleIds, isDelivered) => {
    try {
        console.log(`API: Actualizando estado de entrega para:`, saleIds, isDelivered);

        // If we are confirming delivery, we need to update balances
        for (const id of saleIds) {
            // 1. Get sale details
            const { data: sale, error: fetchError } = await supabase
                .from('sales')
                .select('id, total, client_id, is_delivered, status')
                .eq('id', id)
                .single();

            if (fetchError) continue;

            // Only act if the state is actually changing
            if (sale && sale.is_delivered !== isDelivered) {
                console.log(`API: Cambiando estado de entrega. Impactando saldo para cliente ${sale.client_id}`);

                // FIRST update the sale status to prevent race conditions
                const newStatus = sale.status === 'venta_rapida' ? 'venta_rapida' : (isDelivered ? 'success' : 'pending');
                const { error: saleUpdateError } = await supabase
                    .from('sales')
                    .update({ 
                        is_delivered: isDelivered,
                        status: newStatus
                    })
                    .eq('id', id);
                
                if (saleUpdateError) {
                    console.error('API: Error al actualizar estado de venta:', saleUpdateError);
                    continue;
                }

                // El saldo se actualiza automáticamente vía trigger en la DB
            }
        }

        return { success: true };
    } catch (e) {
        console.error('API: Error en updateSaleDeliveryStatus:', e);
        throw e;
    }
};

export const deleteSale = async (id) => {
    try {
        // First check if it was delivered to reverse balance
        const { data: sale, error: fetchError } = await supabase
            .from('sales')
            .select('client_id, total, is_delivered')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // El saldo se revierte automáticamente vía trigger en la DB

        // Obtener los items para revertir el stock
        const { data: saleItems } = await supabase.from('sale_items').select('product_id, quantity').eq('sale_id', id);

        // Delete items first (due to FK)
        await supabase.from('sale_items').delete().eq('sale_id', id);

        // Delete sale
        const { error } = await supabase.from('sales').delete().eq('id', id);
        if (error) throw error;

        // Revertir stock
        if (saleItems && saleItems.length > 0) {
            for (const item of saleItems) {
                const { data: product } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
                if (product) {
                    const newStock = parseFloat(product.current_stock || 0) + parseFloat(item.quantity);
                    await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
                }
            }
        }

        logAuditEvent({
            tableName: 'sales',
            type: 'sale',
            operation: 'delete',
            recordId: id,
            amount: sale?.total || 0,
            oldData: sale,
            description: `Venta eliminada #${id}`
        });

        return true;
    } catch (e) {
        console.error('API: Error eliminando venta:', e);
        throw e;
    }
};

export const updateSale = async (id, saleData) => {
    console.log(`API: Iniciando actualización de venta ${id}`, saleData);

    const { data: oldSale, error: fetchError } = await supabase
        .from('sales')
        .select('client_id, total, is_delivered')
        .eq('id', id)
        .single();

    if (fetchError) {
        console.error('API: Error al buscar venta previa:', fetchError);
        throw fetchError;
    }

    // Obtener los items viejos para revertir el stock y mantener el costo original
    const { data: oldItems } = await supabase.from('sale_items').select('product_id, quantity, unit_cost').eq('sale_id', id);

    // El saldo se ajusta automáticamente vía trigger en la DB al actualizar la venta

    console.log('API: Actualizando cabecera de venta...');
    const { error: saleError } = await supabase
        .from('sales')
        .update({
            date: saleData.date,
            sale_type: saleData.saleType || saleData.sale_type,
            status: saleData.status,
            total: saleData.total
        })
        .eq('id', id);

    if (saleError) {
        console.error('API: Error al actualizar cabecera:', saleError);
        throw saleError;
    }

    console.log('API: Reemplazando items de venta...');
    const { error: deleteError } = await supabase.from('sale_items').delete().eq('sale_id', id);
    if (deleteError) {
        console.error('API: Error al eliminar items antiguos:', deleteError);
        throw deleteError;
    }

    // Revertir el stock de los items viejos
    if (oldItems && oldItems.length > 0) {
        for (const item of oldItems) {
            const { data: product } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
            if (product) {
                const newStock = parseFloat(product.current_stock || 0) + parseFloat(item.quantity);
                await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
            }
        }
    }

    // OBTENER COSTOS DE PRODUCTOS Y STOCK ACTUAL
    const productIds = saleData.items.map(i => i.productId);
    const { data: products, error: productsError } = await supabase.from('products').select('id, cost, current_stock').in('id', productIds);
    
    if (productsError) throw productsError;
    
    const costMap = (products || []).reduce((acc, p) => ({ ...acc, [p.id]: parseFloat(p.cost || 0) }), {});
    const stockMap = (products || []).reduce((acc, p) => ({ ...acc, [p.id]: parseFloat(p.current_stock || 0) }), {});

    const oldItemsMap = (oldItems || []).reduce((acc, item) => {
        acc[item.product_id] = item;
        return acc;
    }, {});

    const itemsToInsert = saleData.items.map(item => ({
        sale_id: id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        unit_cost: oldItemsMap[item.productId] ? oldItemsMap[item.productId].unit_cost : (costMap[item.productId] || 0),
        total: item.total,
        discount_applied: item.discount_applied || (item.discount ? [item.discount] : null)
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert);
    if (itemsError) {
        console.error('API: Error al insertar nuevos items:', itemsError);
        throw itemsError;
    }

    // Reducir el stock por los nuevos items
    for (const item of saleData.items) {
        const currentStock = stockMap[item.productId] || 0;
        const newStock = currentStock - parseFloat(item.quantity);
        await supabase.from('products').update({ current_stock: newStock }).eq('id', item.productId);
    }

    console.log('API: Actualización de venta completada con éxito.');
    return true;
};

// --- COLLECTIONS ---
export const getCollections = async (clientIds = null) => {
    return robustFetch(async () => {
        let query = supabase
            .from('collections')
            .select(`
                *,
                clients (name),
                profiles:collector_id (full_name, email)
            `)
            .order('id', { ascending: false });

        if (clientIds) {
            query = query.in('client_id', Array.isArray(clientIds) ? clientIds : [clientIds]);
        } else {
            query = query.limit(1500);
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data || []).map(c => {
            const client = Array.isArray(c.clients) ? c.clients[0] : c.clients;
            const collector = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
            return {
                ...c,
                amount: parseFloat(c.amount || 0),
                currency: c.currency || 'ARS',
                clientName: client?.name,
                collectorName: collector?.full_name || collector?.email || 'N/A'
            };
        });
    }, 'getCollections');
};

export const createCollection = async (collection) => {
    // 1. Resolve arqueo_category_id: use provided or fallback to 'Efectivo'
    let arqueo_category_id = collection.arqueo_category_id || null;
    if (!arqueo_category_id) {
        const { data: cat } = await supabase.from('arqueo_categories').select('id').eq('name', 'Efectivo').single();
        arqueo_category_id = cat?.id || null;
    }

    // 2. Insert collection
    const { data, error } = await supabase.from('collections').insert([{
        client_id: collection.clientId,
        date: collection.date,
        amount: collection.amount,
        payment_method: collection.paymentMethod,
        observations: collection.observations,
        collector_id: collection.collectorId,
        currency: collection.currency || 'ARS',
        arqueo_category_id,
        created_by: collection.editorId || collection.collectorId
    }]).select();

    if (error) throw error;

    const newColl = data[0];

    logAuditEvent({
        tableName: 'collections',
        type: 'collection',
        operation: 'create',
        recordId: newColl?.id,
        amount: collection.amount,
        newData: collection,
        description: `Cobranza registrada por $${collection.amount}`
    });

    return newColl;
};

export const deleteCollection = async (id) => {
    try {
        // 1. Fetch collection to get client_id and amount
        const { data: collection, error: fetchError } = await supabase
            .from('collections')
            .select('client_id, amount, currency')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // El saldo se revierte automáticamente vía trigger en la DB

        // 3. Delete the collection record
        const { error } = await supabase.from('collections').delete().eq('id', id);
        if (error) throw error;

        logAuditEvent({
            tableName: 'collections',
            type: 'collection',
            operation: 'delete',
            recordId: id,
            amount: collection?.amount || 0,
            oldData: collection,
            description: `Cobranza eliminada #${id}`
        });

        return true;
    } catch (e) {
        console.error('API: Error eliminando cobranza:', e);
        throw e;
    }
};

// --- ZONES ---
export const getZones = async () => {
    return robustFetch(async () => {
        console.log('API Clients: Fetching zones...');
        const { data, error } = await supabase.from('zones').select('*').order('name');
        console.log('API Clients: Zones fetched. Count:', (data || []).length);
        if (error) throw error;
        return data || [];
    }, 'getZones');
};

export const createZone = async (zone) => {
    const { data, error } = await supabase.from('zones').insert([{
        name: zone.name,
        delivery_days: zone.deliveryDays
    }]).select();
    if (error) throw error;
    return data[0];
};

export const updateZone = async (id, updates) => {
    const { data, error } = await supabase.from('zones').update({
        name: updates.name,
        delivery_days: updates.deliveryDays
    }).eq('id', id).select();
    if (error) throw error;
    return data[0];
};

export const deleteZone = async (id) => {
    const { error } = await supabase.from('zones').delete().eq('id', id);
    if (error) throw error;
    return true;
};

// --- USERS / PROFILES ---
export const getProfiles = async () => {
    return robustFetch(async () => {
        console.log('API: Fetching profiles...');
        const { data, error } = await supabase.from('profiles').select('*').order('email');
        if (error) {
            console.error('API: Error fetching profiles:', error);
            throw error;
        }
        console.log('API: Profiles fetched:', data?.length);
        return data || [];
    }, 'getProfiles');
};

export const updateProfile = async (id, updates) => {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select();
    if (error) throw error;
    return data[0];
};

// --- PROVIDERS ---
export const getProviders = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase.from('providers').select('*').order('name');
        if (error) throw error;
        return data || [];
    }, 'getProviders');
};

export const createProvider = async (provider) => {
    const { data, error } = await supabase.from('providers').insert([provider]).select();
    if (error) throw error;
    return data[0];
};

export const updateProvider = async (id, updates) => {
    const { data, error } = await supabase.from('providers').update(updates).eq('id', id).select();
    if (error) throw error;
    return data[0];
};

export const deleteProvider = async (id) => {
    const { error } = await supabase.from('providers').delete().eq('id', id);
    if (error) throw error;
    return true;
};

// --- EXPENSES ---
export const getExpenses = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase
            .from('expenses')
            .select(`
                *,
                profiles:user_id (email, full_name),
                arqueo_categories (name),
                providers:provider_id (name)
            `)
            .order('date', { ascending: false })
            .limit(1500);
        if (error) throw error;

        return (data || []).map(e => {
            const user = (Array.isArray(e.profiles) ? e.profiles[0] : e.profiles) || {};
            const categoryObj = (Array.isArray(e.arqueo_categories) ? e.arqueo_categories[0] : e.arqueo_categories) || {};
            const provider = (Array.isArray(e.providers) ? e.providers[0] : e.providers) || {};
            return {
                ...e,
                amount: parseFloat(e.amount || 0),
                currency: e.currency || 'ARS',
                userName: user.full_name || user.email || 'N/A',
                arqueoCategoryName: categoryObj.name || 'N/A',
                providerName: provider.name || null,
                providerId: e.provider_id
            };
        });
    }, 'getExpenses');
};

export const createExpense = async (expense) => {
    try {
        const { data, error } = await supabase.from('expenses').insert([{
            description: expense.description,
            amount: parseFloat(expense.amount),
            date: expense.date,
            category: expense.category,
            user_id: expense.userId,
            currency: expense.currency || 'ARS',
            arqueo_category_id: expense.arqueoCategoryId || null,
            provider_id: expense.providerId || null,
            created_by: expense.editorId || expense.userId
        }]).select();

        if (error) throw error;

        const newExp = data[0];

        logAuditEvent({
            tableName: 'expenses',
            type: 'expense',
            operation: 'create',
            recordId: newExp?.id,
            amount: expense.amount,
            newData: expense,
            description: `Gasto/Egreso registrado por $${expense.amount}`
        });

        return newExp;
    } catch (e) {
        console.error('API: Error creando gasto:', e);
        throw e;
    }
};

export const deleteExpense = async (id) => {
    const { data: expense } = await supabase.from('expenses').select('provider_id, amount').eq('id', id).single();
    
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;

    logAuditEvent({
        tableName: 'expenses',
        type: 'expense',
        operation: 'delete',
        recordId: id,
        amount: expense?.amount || 0,
        oldData: expense,
        description: `Gasto/Egreso eliminado #${id}`
    });

    return true;
};

// --- PURCHASES ---
export const getPurchases = async () => {
    return robustFetch(async () => {
        const { data: purchases, error: purchasesError } = await supabase
            .from('purchases')
            .select(`
                *,
                providers:provider_id (name),
                purchase_items (
                    id,
                    product_id,
                    quantity,
                    unit_price,
                    total,
                    products:product_id (description)
                )
            `)
            .order('date', { ascending: false })
            .limit(1500);

        if (purchasesError) throw purchasesError;

        return (purchases || []).map(purchase => {
            const provider = Array.isArray(purchase.providers) ? purchase.providers[0] : purchase.providers;
            
            const items = (purchase.purchase_items || []).map(item => {
                const product = Array.isArray(item.products) ? item.products[0] : item.products;
                return {
                    id: item.id,
                    productId: item.product_id,
                    quantity: parseFloat(item.quantity || 0),
                    unitPrice: parseFloat(item.unit_price || 0),
                    total: parseFloat(item.total || 0),
                    productName: product?.description
                };
            });

            return {
                id: purchase.id,
                providerId: purchase.provider_id,
                providerName: provider?.name,
                date: purchase.date,
                total: parseFloat(purchase.total || 0),
                status: purchase.status,
                createdAt: purchase.created_at,
                items
            };
        });
    }, 'getPurchases');
};

export const createPurchase = async (purchaseData) => {
    try {
        const { data: purchase, error: purchaseError } = await supabase
            .from('purchases')
            .insert([{
                provider_id: purchaseData.providerId,
                date: purchaseData.date,
                status: purchaseData.status || 'completed',
                total: purchaseData.total,
                user_id: purchaseData.userId,
                created_by: purchaseData.editorId || purchaseData.userId
            }])
            .select()
            .single();

        if (purchaseError) throw purchaseError;

        const itemsToInsert = purchaseData.items.map(item => ({
            purchase_id: purchase.id,
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total: item.total
        }));

        const { error: itemsError } = await supabase.from('purchase_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;

        // Aumentar stock de los productos
        for (const item of purchaseData.items) {
            const { data: product } = await supabase.from('products').select('current_stock').eq('id', item.productId).single();
            if (product) {
                const newStock = (parseFloat(product.current_stock || 0) + parseFloat(item.quantity));
                await supabase.from('products').update({ current_stock: newStock }).eq('id', item.productId);
            }
        }

        return purchase;
    } catch (e) {
        console.error('API: Error creando compra:', e);
        throw e;
    }
};

export const deletePurchase = async (id) => {
    try {
        const { data: purchase, error: fetchError } = await supabase
            .from('purchases')
            .select('provider_id, total')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        const { data: items } = await supabase.from('purchase_items').select('product_id, quantity').eq('purchase_id', id);

        if (items) {
            // Revertir stock
            for (const item of items) {
                const { data: product } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
                if (product) {
                    const newStock = (parseFloat(product.current_stock || 0) - parseFloat(item.quantity));
                    await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
                }
            }
        }

        await supabase.from('purchase_items').delete().eq('purchase_id', id);
        const { error } = await supabase.from('purchases').delete().eq('id', id);
        if (error) throw error;
        
        return true;
    } catch (e) {
        console.error('API: Error eliminando compra:', e);
        throw e;
    }
};

// --- PROVIDER ADJUSTMENTS ---
export const getProviderAdjustments = async (providerId = null) => {
    return robustFetch(async () => {
        let query = supabase.from('provider_adjustments').select('*').order('date', { ascending: false });
        if (providerId) query = query.eq('provider_id', providerId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }, 'getProviderAdjustments');
};

export const createProviderAdjustment = async (adj) => {
    try {
        const { data, error } = await supabase.from('provider_adjustments').insert([{
            provider_id: adj.providerId,
            amount: adj.amount,
            type: adj.type,
            description: adj.description,
            date: adj.date,
            created_by: adj.editorId || adj.userId
        }]).select();
        
        if (error) throw error;

        return data[0];
    } catch (e) {
        console.error('API: Error creando ajuste de proveedor:', e);
        throw e;
    }
};

// --- Transfers ---

export const getTransfers = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase
            .from('transfers')
            .select(`
                *,
                from:from_user_id (full_name, email),
                to:to_user_id (full_name, email),
                from_cat:from_category_id (name),
                to_cat:to_category_id (name)
            `)
            .order('date', { ascending: false });

        if (error) throw error;

        return (data || []).map(t => ({
            ...t,
            amount: parseFloat(t.amount || 0),
            fromName: (Array.isArray(t.from) ? t.from[0] : t.from)?.full_name || (Array.isArray(t.from) ? t.from[0] : t.from)?.email || 'Sistema/Externo',
            toName: (Array.isArray(t.to) ? t.to[0] : t.to)?.full_name || (Array.isArray(t.to) ? t.to[0] : t.to)?.email || 'Sistema/Externo',
            fromCategoryName: (Array.isArray(t.from_cat) ? t.from_cat[0] : t.from_cat)?.name || 'N/A',
            toCategoryName: (Array.isArray(t.to_cat) ? t.to_cat[0] : t.to_cat)?.name || 'N/A'
        }));
    }, 'getTransfers');
};

export const createTransfer = async (transfer) => {
    try {
        const { data, error } = await supabase.from('transfers').insert([{
            from_user_id: transfer.fromUserId,
            to_user_id: transfer.toUserId,
            amount: parseFloat(transfer.amount),
            currency: transfer.currency || 'ARS',
            date: transfer.date,
            description: transfer.description,
            from_category_id: transfer.fromCategoryId || null,
            to_category_id: transfer.toCategoryId || null
        }]).select();

        if (error) throw error;
        return data[0];
    } catch (e) {
        console.error('API: Error creando transferencia:', e);
        throw e;
    }
};

export const deleteTransfer = async (id) => {
    try {
        const { error } = await supabase.from('transfers').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('API: Error eliminando transferencia:', e);
        throw e;
    }
};

export const buyDollars = async (buyData) => {
    try {
        const { userId, fromCategoryId, usdCategoryId, amountArs, amountUsd, date, description, cotizacion } = buyData;
        const desc = description || `Compra de USD (Cotización: $${cotizacion})`;
        
        // 1. Egreso de ARS
        const { error: err1 } = await supabase.from('transfers').insert([{
            from_user_id: userId,
            to_user_id: null,
            amount: parseFloat(amountArs),
            currency: 'ARS',
            date: date,
            description: `Egreso: ${desc}`,
            from_category_id: fromCategoryId,
            to_category_id: null
        }]);
        if (err1) throw err1;

        // 2. Ingreso de USD
        const { error: err2 } = await supabase.from('transfers').insert([{
            from_user_id: null,
            to_user_id: userId,
            amount: parseFloat(amountUsd),
            currency: 'USD',
            date: date,
            description: `Ingreso: ${desc}`,
            from_category_id: null,
            to_category_id: usdCategoryId
        }]);
        if (err2) throw err2;

        return true;
    } catch (e) {
        console.error('API: Error en buyDollars:', e);
        throw e;
    }
};

// --- ARQUEO CATEGORIES ---
export const getArqueoCategories = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase.from('arqueo_categories').select('*').order('sort_order');
        if (error) throw error;
        return data || [];
    }, 'getArqueoCategories');
};

export const createArqueoCategory = async (name, description = '') => {
    const { data, error } = await supabase.from('arqueo_categories')
        .insert([{ name, description, is_default: false }]).select();
    if (error) throw error;
    return data[0];
};

export const updateArqueoCategory = async (id, name, description = '') => {
    const { data, error } = await supabase.from('arqueo_categories')
        .update({ name, description }).eq('id', id).select();
    if (error) throw error;
    return data[0];
};

export const deleteArqueoCategory = async (id) => {
    // Check if it's a default category
    const { data: cat } = await supabase.from('arqueo_categories').select('is_default').eq('id', id).single();
    if (cat?.is_default) throw new Error('No se puede eliminar una categoría por defecto');
    const { error } = await supabase.from('arqueo_categories').delete().eq('id', id);
    if (error) throw error;
    return true;
};

export const getArqueoStats = async () => {
    return robustFetch(async () => {
        // Fetch all reference data in parallel
        const [catRes, profRes, colRes, expRes, transRes] = await Promise.all([
            supabase.from('arqueo_categories').select('*').order('sort_order'),
            supabase.from('profiles').select('*').order('email'),
            supabase.from('collections').select('collector_id, amount, currency, arqueo_category_id'),
            supabase.from('expenses').select('user_id, amount, currency, arqueo_category_id'),
            supabase.from('transfers').select('from_user_id, to_user_id, amount, currency, from_category_id, to_category_id')
        ]);

        if (catRes.error) throw catRes.error;
        if (profRes.error) throw profRes.error;

        const categories = catRes.data || [];
        const profiles = profRes.data || [];
        const collections = colRes.data || [];
        const expenses = expRes.data || [];
        const transfers = transRes.data || [];

        // Find default category IDs
        const efectivoId = categories.find(c => c.name === 'Efectivo')?.id;
        const dolaresId  = categories.find(c => c.name === 'Dólares')?.id;

        const userStats = profiles.map(profile => {
            const categoryBalances = categories.map(cat => {
                // Collections → entrada para este usuario en esta categoría
                const collectionIn = collections
                    .filter(c => c.collector_id === profile.id && c.arqueo_category_id === cat.id)
                    .reduce((s, c) => s + parseFloat(c.amount || 0), 0);

                // Cobranzas legacy (sin categoría) → van a Efectivo (ARS) o Dólares (USD)
                const legacyCollectionIn = (() => {
                    const legacy = collections.filter(c => c.collector_id === profile.id && !c.arqueo_category_id);
                    if (cat.id === efectivoId) return legacy.filter(c => !c.currency || c.currency === 'ARS').reduce((s, c) => s + parseFloat(c.amount || 0), 0);
                    if (cat.id === dolaresId)  return legacy.filter(c => c.currency === 'USD').reduce((s, c) => s + parseFloat(c.amount || 0), 0);
                    return 0;
                })();

                // Gastos → salen del usuario que los registra (prioridad a arqueo_category_id)
                const expenseOut = (() => {
                    const userExp = expenses.filter(e => e.user_id === profile.id);
                    
                    // Categorizado explícitamente
                    const categorizedOut = userExp
                        .filter(e => e.arqueo_category_id === cat.id)
                        .reduce((s, e) => s + parseFloat(e.amount || 0), 0);
                    
                    // Fallback para legacy si no tiene arqueo_category_id
                    const legacyOut = (() => {
                        const legacy = userExp.filter(e => !e.arqueo_category_id);
                        if (cat.id === efectivoId) return legacy.filter(e => !e.currency || e.currency === 'ARS').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
                        if (cat.id === dolaresId)  return legacy.filter(e => e.currency === 'USD').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
                        return 0;
                    })();

                    return categorizedOut + legacyOut;
                })();

                // Transferencias salientes desde esta categoría
                const transferOut = transfers
                    .filter(t => t.from_user_id === profile.id && t.from_category_id === cat.id)
                    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

                // Transferencias entrantes a esta categoría
                const transferIn = transfers
                    .filter(t => t.to_user_id === profile.id && t.to_category_id === cat.id)
                    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

                // Transferencias legacy (sin categoría) → van a Efectivo (ARS) o Dólares (USD)
                const legacyTransferOut = (() => {
                    const leg = transfers.filter(t => t.from_user_id === profile.id && !t.from_category_id);
                    if (cat.id === efectivoId) return leg.filter(t => !t.currency || t.currency === 'ARS').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
                    if (cat.id === dolaresId)  return leg.filter(t => t.currency === 'USD').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
                    return 0;
                })();

                const legacyTransferIn = (() => {
                    const leg = transfers.filter(t => t.to_user_id === profile.id && !t.to_category_id);
                    if (cat.id === efectivoId) return leg.filter(t => !t.currency || t.currency === 'ARS').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
                    if (cat.id === dolaresId)  return leg.filter(t => t.currency === 'USD').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
                    return 0;
                })();

                const balance = collectionIn + legacyCollectionIn + transferIn + legacyTransferIn
                              - expenseOut - transferOut - legacyTransferOut;

                return { categoryId: cat.id, categoryName: cat.name, balance };
            });

            return {
                id: profile.id,
                name: profile.full_name || profile.email,
                categoryBalances
            };
        });

        return { userStats, categories };
    }, 'getArqueoStats');
};

export const getUserCategoryMovements = async (userId, categoryId) => {
    return robustFetch(async () => {
        // Find default category IDs just in case
        const { data: categories } = await supabase.from('arqueo_categories').select('id, name');
        const cat = categories.find(c => c.id === categoryId);
        if (!cat) throw new Error("Category not found");
        
        const efectivoId = categories.find(c => c.name === 'Efectivo')?.id;
        const dolaresId  = categories.find(c => c.name === 'Dólares')?.id;

        // Fetch collections (ingresos)
        const { data: collections } = await supabase
            .from('collections')
            .select(`
                id, date, amount, currency, arqueo_category_id, observations, created_at,
                clients(name)
            `)
            .eq('collector_id', userId);

        // Fetch expenses (egresos)
        const { data: expenses } = await supabase
            .from('expenses')
            .select(`
                id, date, amount, currency, arqueo_category_id, description, created_at,
                providers(name)
            `)
            .eq('user_id', userId);

        // Fetch transfers (both directions)
        const { data: transfersOut } = await supabase
            .from('transfers')
            .select(`
                id, date, amount, currency, from_category_id, description, created_at,
                to:to_user_id (full_name, email)
            `)
            .eq('from_user_id', userId);

        const { data: transfersIn } = await supabase
            .from('transfers')
            .select(`
                id, date, amount, currency, to_category_id, description, created_at,
                from:from_user_id (full_name, email)
            `)
            .eq('to_user_id', userId);

        let movements = [];

        // Add collections
        (collections || []).forEach(c => {
            let isIncluded = false;
            if (c.arqueo_category_id === categoryId) {
                isIncluded = true;
            } else if (!c.arqueo_category_id) { // Legacy
                if (categoryId === efectivoId && (!c.currency || c.currency === 'ARS')) isIncluded = true;
                if (categoryId === dolaresId && c.currency === 'USD') isIncluded = true;
            }

            if (isIncluded) {
                const clientName = Array.isArray(c.clients) ? c.clients[0]?.name : c.clients?.name;
                movements.push({
                    id: `col_${c.id}`,
                    realId: c.id,
                    date: c.date,
                    createdAt: c.created_at,
                    type: 'ingreso',
                    amount: parseFloat(c.amount || 0),
                    description: `Cobranza a ${clientName || 'Cliente'} - ${c.observations || ''}`,
                    source: 'collection'
                });
            }
        });

        // Add expenses
        (expenses || []).forEach(e => {
            let isIncluded = false;
            if (e.arqueo_category_id === categoryId) {
                isIncluded = true;
            } else if (!e.arqueo_category_id) {
                if (categoryId === efectivoId && (!e.currency || e.currency === 'ARS')) isIncluded = true;
                if (categoryId === dolaresId && e.currency === 'USD') isIncluded = true;
            }

            if (isIncluded) {
                const providerName = Array.isArray(e.providers) ? e.providers[0]?.name : e.providers?.name;
                movements.push({
                    id: `exp_${e.id}`,
                    realId: e.id,
                    date: e.date,
                    createdAt: e.created_at,
                    type: 'egreso',
                    amount: parseFloat(e.amount || 0),
                    description: `Gasto: ${e.description || ''} ${providerName ? `(${providerName})` : ''}`,
                    source: 'expense'
                });
            }
        });

        // Add transfers out
        (transfersOut || []).forEach(t => {
            let isIncluded = false;
            if (t.from_category_id === categoryId) {
                isIncluded = true;
            } else if (!t.from_category_id) {
                if (categoryId === efectivoId && (!t.currency || t.currency === 'ARS')) isIncluded = true;
                if (categoryId === dolaresId && t.currency === 'USD') isIncluded = true;
            }

            if (isIncluded) {
                const toUser = Array.isArray(t.to) ? t.to[0] : t.to;
                movements.push({
                    id: `tout_${t.id}`,
                    realId: t.id,
                    date: t.date,
                    createdAt: t.created_at,
                    type: 'egreso',
                    amount: parseFloat(t.amount || 0),
                    description: `Transferencia enviada a ${toUser?.full_name || toUser?.email || 'Desconocido'}${t.description ? ` - ${t.description}` : ''}`,
                    source: 'transfer_out'
                });
            }
        });

        // Add transfers in
        (transfersIn || []).forEach(t => {
            let isIncluded = false;
            if (t.to_category_id === categoryId) {
                isIncluded = true;
            } else if (!t.to_category_id) {
                if (categoryId === efectivoId && (!t.currency || t.currency === 'ARS')) isIncluded = true;
                if (categoryId === dolaresId && t.currency === 'USD') isIncluded = true;
            }

            if (isIncluded) {
                const fromUser = Array.isArray(t.from) ? t.from[0] : t.from;
                movements.push({
                    id: `tin_${t.id}`,
                    realId: t.id,
                    date: t.date,
                    createdAt: t.created_at,
                    type: 'ingreso',
                    amount: parseFloat(t.amount || 0),
                    description: `Transferencia recibida de ${fromUser?.full_name || fromUser?.email || 'Desconocido'}${t.description ? ` - ${t.description}` : ''}`,
                    source: 'transfer_in'
                });
            }
        });

        // Sort by date desc, then createdAt desc
        movements.sort((a, b) => {
            if (a.date !== b.date) return new Date(b.date) - new Date(a.date);
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        return movements;
    }, 'getUserCategoryMovements');
};

// --- DASHBOARD ---
export const getDashboardStats = async () => {
    // No usamos robustFetch aquí para evitar timeout falso en conexiones lentas.
    // Las queries están optimizadas para ser rápidas.
    try {
        const todayStr = formatDateLocal();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = formatDateLocal(yesterday);

        // Week start (Monday)
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(now.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        const weekStartStr = weekStart.toISOString().split('T')[0];

        // Month start
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthStartStr = monthStart.toISOString().split('T')[0];

        // Fetch ventas del mes + productos en paralelo
        // Solo traemos los campos necesarios (no SELECT *)
        const [salesResult, productsResult] = await Promise.all([
            supabase
                .from('sales')
                .select('id, date, total, client_id, clients:client_id (zone_id, zones:zone_id (name)), sale_items (product_id, quantity, unit_cost, total)')
                .gte('date', monthStartStr)
                .order('date', { ascending: false })
                .limit(2000),
            supabase.from('products').select('id, description')
        ]);

        if (salesResult.error) {
            console.error('API Dashboard: Error fetching sales:', salesResult.error);
            throw salesResult.error;
        }

        const sales = salesResult.data;
        const products = productsResult.data;
        const safeSales = sales || [];
        const productMap = (products || []).reduce((acc, p) => ({ ...acc, [p.id]: p.description }), {});

        // Helper to sum
        const getSalesForRange = (rangeStartStr, rangeEndStr = todayStr) =>
            safeSales.filter(s => s.date >= rangeStartStr && s.date <= rangeEndStr);

        const currentDaySales = safeSales.filter(s => s.date === todayStr);
        const yesterdaySales = safeSales.filter(s => s.date === yesterdayStr);
        const weeklySales = getSalesForRange(weekStartStr);
        const monthlySales = safeSales; // Already filtered gte monthStartStr

        const calculateMetrics = (salesList) => {
            const amount = salesList.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
            let quantity = 0;
            let cost = 0;
            
            salesList.forEach(s => {
                (s.sale_items || []).forEach(item => {
                    const qty = parseFloat(item.quantity || 0);
                    quantity += qty;
                    cost += qty * parseFloat(item.unit_cost || 0);
                });
            });

            return { amount, quantity, cost, profit: amount - cost };
        };

        const todayMetrics = calculateMetrics(currentDaySales);
        const yesterdayMetrics = calculateMetrics(yesterdaySales);
        const weekMetrics = calculateMetrics(weeklySales);
        const monthMetrics = calculateMetrics(monthlySales);

        // Product Rankings & Breakdowns
        const getQuantityBreakdown = (salesList) => {
            const counts = {};
            salesList.forEach(s => {
                (s.sale_items || []).forEach(item => {
                    const pid = item.product_id;
                    const name = productMap[pid] || 'Prod #' + pid;
                    const qty = parseFloat(item.quantity || 0);
                    if (!counts[pid]) counts[pid] = { name, quantity: 0 };
                    counts[pid].quantity += qty;
                });
            });
            // Return as string or array? Let's return as array of {name, quantity}
            return Object.values(counts).sort((a, b) => b.quantity - a.quantity);
        };

        const getTopProducts = (salesList) => {
            const counts = {};
            salesList.forEach(s => {
                (s.sale_items || []).forEach(item => {
                    const pid = item.product_id;
                    const qty = parseFloat(item.quantity || 0);
                    if (!counts[pid]) counts[pid] = { name: productMap[pid] || 'Prod #' + pid, quantity: 0, total: 0 };
                    counts[pid].quantity += qty;
                    counts[pid].total += parseFloat(item.total || 0);
                });
            });
            return Object.values(counts).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
        };

        // Zone Stats
        const zoneStats = {};
        monthlySales.forEach(s => {
            const zoneName = s.clients?.zones?.name || 'Sin Zona';
            if (!zoneStats[zoneName]) zoneStats[zoneName] = { amount: 0, quantity: 0 };
            zoneStats[zoneName].amount += parseFloat(s.total || 0);
            const qty = (s.sale_items || []).reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0);
            zoneStats[zoneName].quantity += qty;
        });

        // Expenses breakdown - exclude provider payments from "Gastos" for profit calculation
        let expensesArs = 0;
        let expensesUsd = 0;
        let outflowsArs = 0;
        let outflowsUsd = 0;
        try {
            const { data: expData } = await supabase.from('expenses').select('amount, currency, provider_id').gte('date', monthStartStr);
            if (expData) {
                // Real expenses (Gastos) = no provider_id
                expensesArs = expData.filter(e => (!e.currency || e.currency === 'ARS') && !e.provider_id).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
                expensesUsd = expData.filter(e => e.currency === 'USD' && !e.provider_id).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
                
                // Total Outflows (Erogaciones) = everything
                outflowsArs = expData.filter(e => !e.currency || e.currency === 'ARS').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
                outflowsUsd = expData.filter(e => e.currency === 'USD').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
            }
        } catch (e) {
            console.warn('API Dashboard: Error fetching expenses:', e.message);
        }

        const statsResult = {
            today: { ...todayMetrics, breakdown: getQuantityBreakdown(currentDaySales) },
            yesterday: { ...yesterdayMetrics, breakdown: getQuantityBreakdown(yesterdaySales) },
            week: { ...weekMetrics, breakdown: getQuantityBreakdown(weeklySales) },
            month: { ...monthMetrics, breakdown: getQuantityBreakdown(monthlySales) },
            totalIncome: monthMetrics.amount, // legacy field
            totalOrders: monthlySales.length, // legacy field
            topProductsWeek: getTopProducts(weeklySales),
            topProductsMonth: getTopProducts(monthlySales),
            zoneStats: Object.entries(zoneStats).map(([name, data]) => ({ name, ...data })),
            totalExpenses: expensesArs,
            // Multi-currency support
            monthArs: calculateMetrics(monthlySales.filter(s => !s.currency || s.currency === 'ARS')),
            monthUsd: calculateMetrics(monthlySales.filter(s => s.currency === 'USD')),
            expensesArs,
            expensesUsd,
            outflowsArs,
            outflowsUsd
        };

        return statsResult;
    } catch (e) {
        console.error('API Dashboard: Error.', e.message);
        throw e;
    }
};

export const getInsightsStats = async () => {
    return robustFetch(async () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const today = now.getDate();

        // Helper for consistent formatting
        const fmt = (d) => formatDateLocal(d);

        // Current Month
        const curStart = new Date(year, month, 1);
        const curStartStr = fmt(curStart);

        // Previous Month
        const prevStart = new Date(year, month - 1, 1);
        const prevStartStr = fmt(prevStart);
        
        // Prev Month to same day (capping at last day of prev month)
        let prevSameDay = new Date(year, month - 1, today);
        const lastDayOfPrevMonth = new Date(year, month, 0);
        if (prevSameDay > lastDayOfPrevMonth) {
            prevSameDay = lastDayOfPrevMonth;
        }
        const prevSameDayStr = fmt(prevSameDay);
        const prevFullEndStr = fmt(lastDayOfPrevMonth);

        // Current Month Data
        const { data: currentSales, error: e1 } = await supabase.from('sales').select('total, sale_items(quantity, unit_cost)').gte('date', curStartStr);
        if (e1) throw e1;

        const { data: currentExp, error: e2 } = await supabase.from('expenses').select('amount, currency, provider_id').gte('date', curStartStr);
        if (e2) throw e2;

        // Previous Month Data (To Date)
        const { data: prevSalesToDate, error: e3 } = await supabase.from('sales').select('total, sale_items(quantity, unit_cost)').gte('date', prevStartStr).lte('date', prevSameDayStr);
        if (e3) throw e3;

        const { data: prevExpToDate, error: e4 } = await supabase.from('expenses').select('amount, currency, provider_id').gte('date', prevStartStr).lte('date', prevSameDayStr);
        if (e4) throw e4;

        // Previous Month Data (Full Month)
        const { data: prevExpFull, error: e5 } = await supabase.from('expenses').select('amount, currency, provider_id').gte('date', prevStartStr).lte('date', prevFullEndStr);
        if (e5) throw e5;

        const sumData = (list, isExpense = false) => {
            const filteredList = isExpense ? (list || []).filter(e => !e.provider_id) : (list || []);
            
            // Sales don't have currency column, assume ARS. Expenses do.
            const amountArs = filteredList
                .filter(r => !r.currency || r.currency === 'ARS')
                .reduce((s, row) => s + parseFloat(row.total || row.amount || 0), 0);
            
            const amountUsd = filteredList
                .filter(r => r.currency === 'USD')
                .reduce((s, row) => s + parseFloat(row.total || row.amount || 0), 0);
            
            const quantity = isExpense ? 0 : (list || []).reduce((s, row) =>
                s + (row.sale_items || []).reduce((is, item) => is + parseFloat(item.quantity || 0), 0), 0);
            
            const costArs = isExpense ? 0 : (list || []).filter(r => !r.currency || r.currency === 'ARS').reduce((s, row) =>
                s + (row.sale_items || []).reduce((is, item) => is + (parseFloat(item.quantity || 0) * parseFloat(item.unit_cost || 0)), 0), 0);
            
            return { amountArs, amountUsd, quantity, costArs, profitArs: amountArs - costArs };
        };

        return {
            current: sumData(currentSales),
            previousToDate: sumData(prevSalesToDate),
            currentExpenses: sumData(currentExp, true),
            previousExpensesToDate: sumData(prevExpToDate, true),
            previousExpensesFull: sumData(prevExpFull, true)
        };
    }, 'getInsightsStats');
};

export const logAuditEvent = async ({
    tableName,
    operation,
    recordId,
    amount = 0,
    type = 'system',
    oldData = null,
    newData = null,
    description = ''
}) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        let userEmail = user?.email || 'sistema@app.com';
        let userFullName = user?.user_metadata?.full_name || userEmail.split('@')[0];

        if (user?.id) {
            const { data: prof } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', user.id)
                .single();
            if (prof) {
                if (prof.full_name) userFullName = prof.full_name;
                if (prof.email) userEmail = prof.email;
            }
        }

        const logPayload = {
            table_name: tableName || type,
            operation: operation || 'action',
            record_id: String(recordId || ''),
            responsible_full_name: userFullName,
            responsible_email: userEmail,
            editor_full_name: userFullName,
            editor_email: userEmail,
            amount: parseFloat(amount || 0),
            type: type || tableName,
            movement_id: recordId || null,
            old_data: oldData ? oldData : null,
            new_data: newData ? newData : null,
            description: description || null,
            date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('audit_logs').insert([logPayload]);
        if (error) {
            console.warn('Advertencia registrando auditoría:', error.message);
        }
    } catch (e) {
        console.warn('Error no bloqueante en logAuditEvent:', e);
    }
};

export const getAuditLogs = async () => {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        return (data || []).map(log => ({
            ...log,
            movement_id: log.movement_id || log.record_id || log.id,
            type: log.type || log.table_name || 'general',
            userName: log.responsible_full_name || log.responsible_email?.split('@')[0] || 'Desconocido',
            editorName: log.editor_full_name || log.editor_email?.split('@')[0] || 'Desconocido'
        }));
    } catch (error) {
        console.error('Error in getAuditLogs:', error);
        throw error;
    }
};

// ============================================================
// --- FISCAL: CATÁLOGOS ---
// ============================================================

export const getCondicionesFiscales = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase.from('condicion_fiscal').select('*').eq('activo', true).order('descripcion');
        if (error) throw error;
        return data || [];
    }, 'getCondicionesFiscales');
};

export const getAlicuotasIva = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase.from('alicuotas_iva').select('*').eq('activo', true).order('porcentaje');
        if (error) throw error;
        return data || [];
    }, 'getAlicuotasIva');
};

export const getTiposComprobante = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase.from('tipo_comprobante').select('*').eq('activo', true).order('codigo');
        if (error) throw error;
        return data || [];
    }, 'getTiposComprobante');
};

export const getRegimenesRetencion = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase.from('regimenes_retencion').select('*').eq('activo', true).order('nombre');
        if (error) throw error;
        return data || [];
    }, 'getRegimenesRetencion');
};

export const createRegimenRetencion = async (regimen) => {
    const { data, error } = await supabase.from('regimenes_retencion').insert([regimen]).select();
    if (error) throw error;
    return data[0];
};

export const updateRegimenRetencion = async (id, updates) => {
    const { data, error } = await supabase.from('regimenes_retencion').update(updates).eq('id', id).select();
    if (error) throw error;
    return data[0];
};

export const deleteRegimenRetencion = async (id) => {
    const { error } = await supabase.from('regimenes_retencion').update({ activo: false }).eq('id', id);
    if (error) throw error;
    return true;
};

export const getIibbJurisdicciones = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase.from('iibb_jurisdicciones').select('*').eq('activo', true).order('nombre');
        if (error) throw error;
        return data || [];
    }, 'getIibbJurisdicciones');
};

// ============================================================
// --- FISCAL: EMPRESA CONFIG ---
// ============================================================

export const getEmpresaConfig = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase
            .from('empresa_config')
            .select('*, condicion_fiscal(*)')
            .eq('activo', true)
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data;
    }, 'getEmpresaConfig');
};

export const upsertEmpresaConfig = async (config) => {
    const { data: existing } = await supabase.from('empresa_config').select('id').eq('activo', true).limit(1).maybeSingle();
    if (existing?.id) {
        const { data, error } = await supabase.from('empresa_config').update(config).eq('id', existing.id).select();
        if (error) throw error;
        return data[0];
    } else {
        const { data, error } = await supabase.from('empresa_config').insert([{ ...config, activo: true }]).select();
        if (error) throw error;
        return data[0];
    }
};

// ============================================================
// --- FISCAL: COMPROBANTES ---
// ============================================================

export const getComprobantes = async ({ flujo, periodo, estado, limit = 500 } = {}) => {
    return robustFetch(async () => {
        let query = supabase
            .from('comprobantes')
            .select(`
                *,
                tipo_comprobante(codigo, descripcion, discrimina_iva, codigo_afip),
                clients(name, cuit, cuit_fiscal),
                providers(name, cuit, cuit_fiscal),
                comprobante_items(
                    id, descripcion, cantidad, precio_unitario_neto,
                    iva_importe, total_item, tipo_gravamen,
                    alicuotas_iva(porcentaje, descripcion),
                    products(description)
                )
            `)
            .order('id', { ascending: false })
            .limit(limit);

        if (flujo) query = query.eq('flujo', flujo);
        if (periodo) query = query.eq('periodo_fiscal', periodo);
        if (estado) query = query.eq('estado', estado);

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(c => {
            const tc = Array.isArray(c.tipo_comprobante) ? c.tipo_comprobante[0] : c.tipo_comprobante;
            const client = Array.isArray(c.clients) ? c.clients[0] : c.clients;
            const provider = Array.isArray(c.providers) ? c.providers[0] : c.providers;
            return {
                ...c,
                tipo_comprobante_codigo: tc?.codigo,
                tipo_comprobante_descripcion: tc?.descripcion,
                discrimina_iva: tc?.discrimina_iva,
                codigo_afip_comprobante: tc?.codigo_afip,
                receptor_nombre: client?.name || provider?.name,
                cuit_receptor: c.cuit_receptor || client?.cuit_fiscal || client?.cuit || provider?.cuit_fiscal || provider?.cuit,
                items: (c.comprobante_items || []).map(item => {
                    const alicuota = Array.isArray(item.alicuotas_iva) ? item.alicuotas_iva[0] : item.alicuotas_iva;
                    const product = Array.isArray(item.products) ? item.products[0] : item.products;
                    return {
                        ...item,
                        alicuota_porcentaje: alicuota?.porcentaje,
                        producto_descripcion: product?.description,
                    };
                })
            };
        });
    }, 'getComprobantes');
};

export const createComprobante = async (comprobante, items = [], retenciones = [], userId = null) => {
    try {
        const { data: comp, error: compError } = await supabase
            .from('comprobantes')
            .insert([{
                flujo: comprobante.flujo,
                tipo_comprobante_id: comprobante.tipo_comprobante_id,
                punto_venta: comprobante.punto_venta || 1,
                numero: comprobante.numero || null,
                fecha_emision: comprobante.fecha_emision,
                fecha_vto_pago: comprobante.fecha_vto_pago || null,
                cliente_id: comprobante.cliente_id || null,
                proveedor_id: comprobante.proveedor_id || null,
                condicion_iva_receptor: comprobante.condicion_iva_receptor,
                cuit_receptor: comprobante.cuit_receptor,
                razon_social_receptor: comprobante.razon_social_receptor,
                neto_gravado_27: comprobante.neto_gravado_27 || 0,
                neto_gravado_21: comprobante.neto_gravado_21 || 0,
                neto_gravado_105: comprobante.neto_gravado_105 || 0,
                neto_gravado_0: comprobante.neto_gravado_0 || 0,
                neto_no_gravado: comprobante.neto_no_gravado || 0,
                neto_exento: comprobante.neto_exento || 0,
                iva_27: comprobante.iva_27 || 0,
                iva_21: comprobante.iva_21 || 0,
                iva_105: comprobante.iva_105 || 0,
                total_otros_tributos: comprobante.total_otros_tributos || 0,
                total_comprobante: comprobante.total_comprobante,
                estado: comprobante.estado || 'emitido',
                periodo_fiscal: comprobante.periodo_fiscal,
                comprobante_original_id: comprobante.comprobante_original_id || null,
                created_by: userId,
            }])
            .select()
            .single();

        if (compError) throw compError;

        if (items.length > 0) {
            const itemsToInsert = items.map(item => ({
                comprobante_id: comp.id,
                producto_id: item.producto_id || null,
                descripcion: item.descripcion,
                cantidad: item.cantidad,
                precio_unitario_neto: item.precio_unitario_neto,
                alicuota_iva_id: item.alicuota_iva_id || null,
                iva_importe: item.iva_importe || 0,
                tipo_gravamen: item.tipo_gravamen || 'gravado',
                total_item: item.total_item,
            }));
            const { error: itemsError } = await supabase.from('comprobante_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;
        }

        if (retenciones.length > 0) {
            const retToInsert = retenciones.map(r => ({
                comprobante_id: comp.id,
                regimen_id: r.regimen_id || null,
                tipo: r.tipo,
                base_imponible: r.base_imponible || 0,
                alicuota: r.alicuota || 0,
                importe: r.importe || 0,
                nro_certificado: r.nro_certificado || null,
                fecha: r.fecha || comprobante.fecha_emision,
                cuit_agente: r.cuit_agente || null,
                periodo_fiscal: comprobante.periodo_fiscal,
            }));
            const { error: retError } = await supabase.from('retenciones_percepciones').insert(retToInsert);
            if (retError) throw retError;
        }

        await supabase.from('auditoria_comprobantes').insert([{
            comprobante_id: comp.id,
            usuario_id: userId,
            accion: 'created',
            detalle: `Comprobante creado: ${comprobante.flujo} ${comprobante.periodo_fiscal}`,
        }]);

        return comp;
    } catch (e) {
        console.error('API: Error creando comprobante:', e);
        throw e;
    }
};

export const anularComprobante = async (id, userId) => {
    const { data, error } = await supabase
        .from('comprobantes')
        .update({ anulado: true, estado: 'anulado' })
        .eq('id', id)
        .select();
    if (error) throw error;

    await supabase.from('auditoria_comprobantes').insert([{
        comprobante_id: id,
        usuario_id: userId,
        accion: 'anulado',
        detalle: 'Comprobante anulado manualmente',
    }]);

    return data[0];
};

// ============================================================
// --- FISCAL: PERÍODOS Y LIQUIDACIÓN ---
// ============================================================

export const getPeriodosFiscales = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase
            .from('periodos_fiscales')
            .select('*')
            .order('anio', { ascending: false })
            .order('mes', { ascending: false });
        if (error) throw error;
        return data || [];
    }, 'getPeriodosFiscales');
};

export const calcularLiquidacionIva = async (anio, mes) => {
    return robustFetch(async () => {
        const { data, error } = await supabase.rpc('calcular_liquidacion_iva', { p_anio: anio, p_mes: mes });
        if (error) throw error;
        return data?.[0] || null;
    }, 'calcularLiquidacionIva');
};

export const cerrarPeriodoFiscal = async (anio, mes, datosLiquidacion, userId) => {
    const { data, error } = await supabase
        .from('periodos_fiscales')
        .upsert({
            anio,
            mes,
            debito_fiscal: datosLiquidacion.debito_fiscal || 0,
            credito_fiscal: datosLiquidacion.credito_fiscal || 0,
            retenciones_sufridas: datosLiquidacion.retenciones_sufridas || 0,
            percepciones_sufridas: datosLiquidacion.percepciones_sufridas || 0,
            saldo_tecnico: (datosLiquidacion.debito_fiscal || 0) - (datosLiquidacion.credito_fiscal || 0),
            iva_a_pagar: datosLiquidacion.iva_a_pagar || 0,
            cerrado: true,
            fecha_cierre: new Date().toISOString(),
            cerrado_por: userId,
        }, { onConflict: 'anio,mes' })
        .select();
    if (error) throw error;
    return data[0];
};

// ============================================================
// --- FISCAL: RETENCIONES ---
// ============================================================

export const getRetenciones = async ({ periodo, tipo } = {}) => {
    return robustFetch(async () => {
        let query = supabase
            .from('retenciones_percepciones')
            .select('*, regimenes_retencion(nombre, impuesto, organismo, tipo)')
            .order('fecha', { ascending: false });

        if (periodo) query = query.eq('periodo_fiscal', periodo);
        if (tipo) query = query.eq('tipo', tipo);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }, 'getRetenciones');
};

export const createRetencionManual = async (retencion) => {
    const { data, error } = await supabase.from('retenciones_percepciones').insert([{
        comprobante_id: retencion.comprobante_id || null,
        regimen_id: retencion.regimen_id || null,
        tipo: retencion.tipo,
        base_imponible: retencion.base_imponible || 0,
        alicuota: retencion.alicuota || 0,
        importe: retencion.importe || 0,
        nro_certificado: retencion.nro_certificado || null,
        fecha: retencion.fecha,
        cuit_agente: retencion.cuit_agente || null,
        periodo_fiscal: retencion.periodo_fiscal,
        ingresado_manual: true,
    }]).select();
    if (error) throw error;
    return data[0];
};

// ============================================================
// --- FISCAL: ARCA CONFIG (Fase 3) ---
// ============================================================

export const getArcaConfig = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase
            .from('arca_configuracion')
            .select('id, cuit_emisor, razon_social, ambiente, condicion_iva_emisor, domicilio_fiscal, localidad, provincia, cp, logo_url, pie_factura, email_envio_facturas, email_proveedor, activo, configuracion_completa, ws_token_expira')
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data;
    }, 'getArcaConfig');
};

export const upsertArcaConfig = async (config) => {
    const { data: existing } = await supabase.from('arca_configuracion').select('id').limit(1).maybeSingle();
    if (existing?.id) {
        const { data, error } = await supabase.from('arca_configuracion').update(config).eq('id', existing.id).select('id, cuit_emisor, razon_social, ambiente, activo, configuracion_completa');
        if (error) throw error;
        return data[0];
    } else {
        const { data, error } = await supabase.from('arca_configuracion').insert([config]).select('id, cuit_emisor, razon_social, ambiente, activo, configuracion_completa');
        if (error) throw error;
        return data[0];
    }
};

export const getArcaPuntosVenta = async () => {
    return robustFetch(async () => {
        const { data, error } = await supabase.from('arca_puntos_venta').select('*').eq('activo', true).order('numero');
        if (error) throw error;
        return data || [];
    }, 'getArcaPuntosVenta');
};

export const upsertArcaPuntoVenta = async (pv) => {
    if (pv.id) {
        const { data, error } = await supabase.from('arca_puntos_venta').update(pv).eq('id', pv.id).select();
        if (error) throw error;
        return data[0];
    } else {
        const { data, error } = await supabase.from('arca_puntos_venta').insert([pv]).select();
        if (error) throw error;
        return data[0];
    }
};

export const getArcaWsLog = async ({ limit = 100 } = {}) => {
    return robustFetch(async () => {
        const { data, error } = await supabase
            .from('arca_ws_log')
            .select('*')
            .order('fecha', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    }, 'getArcaWsLog');
};
