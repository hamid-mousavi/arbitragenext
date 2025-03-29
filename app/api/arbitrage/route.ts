import 'dotenv/config';
import axios from 'axios';
import { NextResponse } from 'next/server';

// 📌 لیست ۱۰ جفت ارز برتر برای تست اولیه
const TEST_PAIRS = [
    'usdt-rls', 'btc-rls', 'eth-rls', 'xrp-rls', 'ada-rls',
    'dot-rls', 'doge-rls', 'trx-rls', 'ltc-rls', 'bnb-rls'
];

// 📌 دریافت فقط این ۱۰ جفت ارز
async function getNobitexPairs() {
    return TEST_PAIRS;
}



// 📌 دریافت قیمت جفت‌ارزها از نوبیتکس
async function fetchNobitexPrices(pairs: string[]) {
    try {
        const response = await fetch('https://api.nobitex.ir/market/stats');
        const data = await response.json();

        return pairs.reduce((prices, pair) => {
            let nobitexPair = pair.toLowerCase(); // تبدیل به حروف کوچک (نوبیتکس حروف کوچک دارد)
            prices[pair] = data?.stats?.[nobitexPair]?.latest || 0;
            return prices;
        }, {} as Record<string, number>);
    } catch (error) {
        console.error('❌ خطا در دریافت قیمت‌های نوبیتکس:', error);
        return {};
    }
}



// 📌 دریافت قیمت جفت‌ارزها از والکس
async function fetchWallexPrices(pairs: string[]) {
    try {
        const { data } = await axios.get('https://api.wallex.ir/v1/markets');

        return pairs.reduce((prices, pair) => {
            // تبدیل نام جفت‌ارز به فرمت والکس
            let wallexPair = pair.replace('-rls', 'tmn').toUpperCase(); 

            // دریافت قیمت از API
            let price = data?.result?.symbols?.[wallexPair]?.stats?.lastPrice;
            
            // تبدیل مقدار به عدد و ضرب در ۱۰ (در صورت نیاز)
            prices[pair] = price ? parseFloat(price) * 10 : 0;

            return prices;
        }, {} as Record<string, number>);
    } catch (error) {
        console.error('❌ خطا در دریافت قیمت‌های والکس:', error);
        return {};
    }
}



// 📌 هندلر `GET` برای دریافت اطلاعات آربیتراژ
export async function GET() {
    try {
        const pairs = await getNobitexPairs();
        const [nobitex, wallex] = await Promise.all([
            fetchNobitexPrices(pairs),
            fetchWallexPrices(pairs)
        ]);

        const prices = pairs.map(pair => ({
            pair,
            nobitex: nobitex[pair] || 0,
            wallex: wallex[pair] || 0,
            difference: (wallex[pair] || 0) - (nobitex[pair] || 0),
            percentage: nobitex[pair] ? (((wallex[pair] - nobitex[pair]) / nobitex[pair]) * 100) : 0
        })).sort((a, b) => b.percentage - a.percentage); // مرتب‌سازی

        return NextResponse.json({ success: true, prices });
    } catch (error) {
        console.error('❌ خطا در پردازش API:', error);
        return NextResponse.json({ success: false, message: 'خطایی رخ داد' }, { status: 500 });
    }
}

