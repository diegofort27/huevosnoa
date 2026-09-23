import { getSales } from '../src/lib/api.js';

async function test() {
    const sales = await getSales();
    console.log(sales.slice(0, 2).map(s => s.date));
}
test();
