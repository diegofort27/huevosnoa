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

export const getNextDeliveryDay = (deliveryDays) => {
    if (!deliveryDays || deliveryDays.length === 0) return null;

    const today = new Date();
    // JS: 0=Sun, 1=Mon ... 6=Sat
    // Our DB: 1=Mon ... 7=Sun
    // Mapping JS to DB: 0 -> 7, others same
    const currentDay = today.getDay() === 0 ? 7 : today.getDay();

    // Sort days
    const sortedDays = [...deliveryDays].sort((a, b) => a - b);

    // Find next day in this week (including today)
    const nextDayThisWeek = sortedDays.find(d => d >= currentDay);

    let targetDay;
    let daysToAdd = 0;

    if (nextDayThisWeek) {
        targetDay = nextDayThisWeek;
        daysToAdd = targetDay - currentDay;
    } else {
        // Next week, first available day
        targetDay = sortedDays[0];
        daysToAdd = (7 - currentDay) + targetDay;
    }

    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysToAdd);

    return nextDate;
};
export const getCurrentWeekRange = () => {
    const today = new Date();
    const day = today.getDay(); // 0 (Sun) to 6 (Sat)

    // Adjust to Monday (1)
    // If today is Sunday (0), we want the previous Monday
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const range = [];
    for (let i = 0; i < 7; i++) { // Mon to Sun
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        range.push(d.toISOString().split('T')[0]);
    }
    return range;
};

/**
 * Returns YYYY-MM-DD in Argentina timezone.
 * Used to ensure "today" matches the user's business day.
 */
export const formatDateLocal = (date = new Date()) => {
    let dateObj = date;
    if (typeof date === 'string') {
        const normalized = date.includes('T') ? date : `${date}T00:00:00`;
        dateObj = new Date(normalized);
    }
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
        dateObj = new Date();
    }
    try {
        // We use sv-SE locale because it naturally formats as YYYY-MM-DD
        return new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(dateObj);
    } catch (e) {
        console.error('formatDateLocal: Error formatting date', e);
        return typeof date === 'string' ? date.split('T')[0] : '';
    }
};

export const getGoogleMapsLink = (url) => {
    if (!url) return '';
    if (typeof url !== 'string') return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    // If it's just a Plus Code or address, search for it
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(url)}`;
};
