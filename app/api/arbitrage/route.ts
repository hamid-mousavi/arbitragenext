import 'dotenv/config';
import axios from 'axios';
import { NextResponse } from 'next/server';

// 📌 لیست ۱۰ جفت ارز برتر برای تست اولیه
const TEST_PAIRS = [
    'usdt-rls','usdc-rls', 'btc-rls', 'eth-rls', 'xrp-rls', 'ada-rls',
    'dot-rls', 'doge-rls', 'trx-rls', 'ltc-rls', 'bnb-rls'
];

// 📌 دریافت لیست جفت‌ارزهای نوبیتکس
// async function getNobitexPairs() {
//     try {
//         const response = await fetch('https://api.nobitex.ir/market/stats');
//         const data = await response.json();
//         return Object.keys(data?.stats || {}); // همه جفت‌ارزها
//     } catch (error) {
//         console.error('❌ خطا در دریافت لیست جفت‌ارزهای نوبیتکس:', error);
//         return [];
//     }
// }
interface MarketStats {
    isClosed?: boolean;
}

interface NobitexResponse {
    status: string;
    stats: Record<string, MarketStats>;
}

interface WallexResponse {
    result: {
        symbols: Record<string, { stats: { lastPrice: string } }>;
    };
}

// تبدیل جفت‌ارزهای نوبیتکس به فرمت والکس
function convertToWallexFormat(pair: string): string {
    if (pair.endsWith('-usdt')) {
        return pair.replace('-usdt', '').toUpperCase() + 'USDT';
    } else if (pair.endsWith('-rls')) {
        return pair.replace('-rls', '').toUpperCase() + 'TMN';
    }
    return '';
}

async function getNobitexPairs(): Promise<string[]> {
    try {
        // دریافت داده‌های نوبیتکس و والکس هم‌زمان
        const [nobitexResponse, wallexResponse] = await Promise.all([
            fetch('https://api.nobitex.ir/market/stats').then(res => res.json() as Promise<NobitexResponse>),
            fetch('https://api.wallex.ir/v1/markets').then(res => res.json() as Promise<WallexResponse>)
        ]);

        // استخراج لیست جفت‌ارزهای والکس با تبدیل به فرمت استاندارد
        const wallexPairs = new Set(
            Object.keys(wallexResponse.result.symbols || {}).map(pair => pair.toUpperCase())
        );

        // فیلتر کردن جفت‌ارزهای نوبیتکس بر اساس:
        // 1. به "-rls" ختم شوند.
        // 2. isClosed=false باشد.
        // 3. در لیست جفت‌ارزهای والکس موجود باشند.
        return Object.entries(nobitexResponse.stats || {})
            .filter(([pair, details]) => {
                const convertedPair = convertToWallexFormat(pair);
                return pair.toLowerCase().endsWith('-rls') &&
                       !details.isClosed &&
                       wallexPairs.has(convertedPair);
            })
            .map(([pair]) => pair);
    } catch (error) {
        console.error('❌ خطا در دریافت داده‌ها:', error);
        return [];
    }
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
        const response = await fetch('https://api.wallex.ir/v1/markets');
        const data = await response.json();

        return pairs.reduce((prices, pair) => {
            let wallexPair;

            if (pair.endsWith('-usdt')) {
                wallexPair = pair.replace('-usdt', '').toUpperCase() + 'USDT'; // تبدیل به فرمت والکس
            } else {
                wallexPair = pair.replace('-rls', '').toUpperCase() + 'TMN'; // تبدیل به فرمت والکس
            }

            // دریافت قیمت از API
            let price = data?.result?.symbols?.[wallexPair]?.stats?.lastPrice;

            // تبدیل مقدار به عدد و ضرب در ۱۰ (برای تومان)
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

