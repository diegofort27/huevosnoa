// Mock data for development - will be replaced with Supabase later

export const mockClients = [
    {
        id: 1,
        name: 'Supermercado Don José',
        address: 'Av. San Martín 1234',
        phone: '11-4567-8901',
        email: 'contacto@donjose.com',
        saleCondition: 'cc', // cuenta corriente
        priceListId: 1,
        balance: 25600
    },
    {
        id: 2,
        name: 'Almacén La Esquina',
        address: 'Calle Belgrano 456',
        phone: '11-2345-6789',
        email: 'laesquina@gmail.com',
        saleCondition: 'contado',
        priceListId: 2,
        balance: 0
    },
    {
        id: 3,
        name: 'Restaurante El Buen Sabor',
        address: 'Av. Corrientes 789',
        phone: '11-3456-7890',
        email: 'buensabor@resto.com',
        saleCondition: 'cc',
        priceListId: 1,
        balance: 18400
    },
    {
        id: 4,
        name: 'Panadería Central',
        address: 'Calle Tucumán 321',
        phone: '11-4567-1234',
        email: 'panaderia@central.com',
        saleCondition: 'cc',
        priceListId: 3,
        balance: 8750
    },
    {
        id: 5,
        name: 'Kiosco Los Amigos',
        address: 'Av. Rivadavia 567',
        phone: '11-5678-2345',
        email: 'losamigos@kiosco.com',
        saleCondition: 'contado',
        priceListId: 2,
        balance: 0
    }
];

export const mockProducts = [
    {
        id: 1,
        code: 'HUE-B30',
        description: 'Huevos Bandeja x30',
        unit: 'bandeja',
        currentStock: 250,
        minStock: 50,
        cost: 2100,
        basePrice: 2800,
        image: '🥚'
    },
    {
        id: 2,
        code: 'HUE-B12',
        description: 'Huevos Maple x12',
        unit: 'maple',
        currentStock: 180,
        minStock: 30,
        cost: 900,
        basePrice: 1200,
        image: '🥚'
    },
    {
        id: 3,
        code: 'HUE-B6',
        description: 'Huevos Media Docena x6',
        unit: 'pack',
        currentStock: 120,
        minStock: 20,
        cost: 450,
        basePrice: 650,
        image: '🥚'
    },
    {
        id: 4,
        code: 'HUE-BL30',
        description: 'Huevos Blancos Bandeja x30',
        unit: 'bandeja',
        currentStock: 15,
        minStock: 25,
        cost: 2400,
        basePrice: 3200,
        image: '🥚'
    },
    {
        id: 5,
        code: 'HUE-ORG30',
        description: 'Huevos Orgánicos x30',
        unit: 'bandeja',
        currentStock: 45,
        minStock: 15,
        cost: 3500,
        basePrice: 4500,
        image: '🥚'
    }
];

export const mockPriceLists = [
    {
        id: 1,
        name: 'Lista Mayorista',
        products: [
            {
                productId: 1,
                price: 2800,
                discounts: [
                    { minQty: 1, maxQty: 1, type: 'fixed', value: 0 },      // 1 unidad: precio original
                    { minQty: 2, maxQty: 5, type: 'fixed', value: 100 },    // 2-5: $100 descuento
                    { minQty: 6, maxQty: 10, type: 'fixed', value: 200 },   // 6-10: $200 descuento
                    { minQty: 11, maxQty: null, type: 'fixed', value: 300 } // 11+: $300 descuento
                ]
            },
            {
                productId: 2,
                price: 1200,
                discounts: [
                    { minQty: 1, maxQty: 1, type: 'fixed', value: 0 },
                    { minQty: 2, maxQty: 5, type: 'fixed', value: 50 },
                    { minQty: 6, maxQty: null, type: 'fixed', value: 100 }
                ]
            },
            { productId: 3, price: 650, discounts: [] },
            {
                productId: 4,
                price: 3200,
                discounts: [
                    { minQty: 1, maxQty: 4, type: 'fixed', value: 0 },
                    { minQty: 5, maxQty: 10, type: 'percent', value: 5 },
                    { minQty: 11, maxQty: null, type: 'percent', value: 10 }
                ]
            },
            {
                productId: 5,
                price: 4500,
                discounts: [
                    { minQty: 1, maxQty: 5, type: 'fixed', value: 0 },
                    { minQty: 6, maxQty: null, type: 'fixed', value: 500 }
                ]
            }
        ]
    },
    {
        id: 2,
        name: 'Lista Minorista',
        products: [
            { productId: 1, price: 3200, discounts: [] },
            { productId: 2, price: 1400, discounts: [] },
            { productId: 3, price: 750, discounts: [] },
            { productId: 4, price: 3600, discounts: [] },
            { productId: 5, price: 5200, discounts: [] }
        ]
    },
    {
        id: 3,
        name: 'Lista Especial',
        products: [
            {
                productId: 1,
                price: 2600,
                discounts: [
                    { minQty: 1, maxQty: 1, type: 'fixed', value: 0 },
                    { minQty: 2, maxQty: 5, type: 'fixed', value: 1000 },
                    { minQty: 6, maxQty: 10, type: 'fixed', value: 2000 },
                    { minQty: 11, maxQty: null, type: 'fixed', value: 3000 }
                ]
            },
            {
                productId: 2,
                price: 1100,
                discounts: [
                    { minQty: 1, maxQty: 10, type: 'fixed', value: 0 },
                    { minQty: 11, maxQty: null, type: 'percent', value: 10 }
                ]
            },
            { productId: 3, price: 600, discounts: [] },
            { productId: 4, price: 3000, discounts: [] },
            {
                productId: 5,
                price: 4200,
                discounts: [
                    { minQty: 1, maxQty: 5, type: 'fixed', value: 0 },
                    { minQty: 6, maxQty: 10, type: 'fixed', value: 200 },
                    { minQty: 11, maxQty: null, type: 'fixed', value: 400 }
                ]
            }
        ]
    }
];

// Helper function to calculate discounted price based on quantity ranges
export const calculateDiscountedPrice = (basePrice, quantity, discounts = []) => {
    if (!discounts || discounts.length === 0) {
        return { finalPrice: basePrice, discount: null };
    }

    // Find the discount range that matches the quantity
    const applicableDiscount = discounts.find(d => {
        const matchesMin = quantity >= d.minQty;
        const matchesMax = d.maxQty === null || quantity <= d.maxQty;
        return matchesMin && matchesMax;
    });

    if (!applicableDiscount || applicableDiscount.value === 0) {
        return { finalPrice: basePrice, discount: applicableDiscount?.value === 0 ? applicableDiscount : null };
    }

    let finalPrice;
    if (applicableDiscount.type === 'percent') {
        finalPrice = basePrice * (1 - applicableDiscount.value / 100);
    } else {
        finalPrice = basePrice - applicableDiscount.value;
    }

    return {
        finalPrice: Math.max(0, finalPrice),
        discount: applicableDiscount
    };
};

export const mockSales = [
    {
        id: 1,
        clientId: 1,
        clientName: 'Supermercado Don José',
        date: '2026-01-26',
        items: [
            { productId: 1, productName: 'Huevos Bandeja x30', quantity: 10, unitPrice: 2800, total: 28000 }
        ],
        total: 28000,
        saleType: 'cc',
        status: 'pending'
    },
    {
        id: 2,
        clientId: 3,
        clientName: 'Restaurante El Buen Sabor',
        date: '2026-01-25',
        items: [
            { productId: 1, productName: 'Huevos Bandeja x30', quantity: 5, unitPrice: 2800, total: 14000 },
            { productId: 2, productName: 'Huevos Maple x12', quantity: 10, unitPrice: 1200, total: 12000 }
        ],
        total: 26000,
        saleType: 'cc',
        status: 'success'
    },
    {
        id: 3,
        clientId: 2,
        clientName: 'Almacén La Esquina',
        date: '2026-01-25',
        items: [
            { productId: 3, productName: 'Huevos Media Docena x6', quantity: 20, unitPrice: 750, total: 15000 }
        ],
        total: 15000,
        saleType: 'contado',
        status: 'success'
    },
    {
        id: 4,
        clientId: 4,
        clientName: 'Panadería Central',
        date: '2026-01-24',
        items: [
            { productId: 1, productName: 'Huevos Bandeja x30', quantity: 8, unitPrice: 2600, total: 20800 }
        ],
        total: 20800,
        saleType: 'cc',
        status: 'pending'
    },
    {
        id: 5,
        clientId: 5,
        clientName: 'Kiosco Los Amigos',
        date: '2026-01-24',
        items: [
            { productId: 2, productName: 'Huevos Maple x12', quantity: 15, unitPrice: 1400, total: 21000 }
        ],
        total: 21000,
        saleType: 'contado',
        status: 'success'
    },
    {
        id: 6,
        clientId: 1,
        clientName: 'Supermercado Don José',
        date: '2026-01-23',
        items: [
            { productId: 5, productName: 'Huevos Orgánicos x30', quantity: 4, unitPrice: 4500, total: 18000 }
        ],
        total: 18000,
        saleType: 'cc',
        status: 'success'
    },
    {
        id: 7,
        clientId: 3,
        clientName: 'Restaurante El Buen Sabor',
        date: '2026-01-22',
        items: [
            { productId: 1, productName: 'Huevos Bandeja x30', quantity: 12, unitPrice: 2800, total: 33600 }
        ],
        total: 33600,
        saleType: 'cc',
        status: 'pending'
    }
];

export const mockCollections = [
    {
        id: 1,
        clientId: 1,
        clientName: 'Supermercado Don José',
        date: '2026-01-26',
        amount: 20000,
        paymentMethod: 'transfer',
        saleIds: [1],
        observations: 'Pago parcial'
    },
    {
        id: 2,
        clientId: 3,
        clientName: 'Restaurante El Buen Sabor',
        date: '2026-01-25',
        amount: 26000,
        paymentMethod: 'cash',
        saleIds: [2],
        observations: 'Pago total'
    },
    {
        id: 3,
        clientId: 4,
        clientName: 'Panadería Central',
        date: '2026-01-24',
        amount: 12000,
        paymentMethod: 'mercadoPago',
        saleIds: [4],
        observations: 'Pago parcial'
    }
];

export const mockPaymentMethods = [
    { id: 'cash', name: 'Efectivo' },
    { id: 'transfer', name: 'Transferencia' },
    { id: 'mercadoPago', name: 'Mercado Pago' },
    { id: 'check', name: 'Cheque' },
    { id: 'other', name: 'Otro' }
];

// Dashboard statistics
export const mockDashboardStats = {
    totalIncome: 450000,
    totalOrders: 250,
    totalViews: 964,
    totalExpenses: 125000,
    incomeChange: 8.5,
    ordersChange: 3.2,
    viewsChange: -1.5,
    expensesChange: 2.1
};

export const mockTopProducts = mockSales.flatMap(sale =>
    sale.items.map(item => ({
        ...item,
        date: sale.date,
        status: sale.status
    }))
);

export const mockZoneData = [
    { name: 'Zona Norte', value: 50, color: '#6366f1' },
    { name: 'Zona Sur', value: 30, color: '#8b5cf6' },
    { name: 'Zona Centro', value: 20, color: '#a855f7' }
];

export const mockDeviceData = [
    { name: 'Móvil', value: 55, color: '#6366f1' },
    { name: 'Desktop', value: 35, color: '#8b5cf6' },
    { name: 'Otros', value: 10, color: '#a855f7' }
];
