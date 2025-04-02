import 'dotenv/config';
import axios from 'axios';
import { NextResponse } from 'next/server';

const TEST_PAIRS = [
    'usdt-rls', 'usdc-rls', 'btc-rls', 'eth-rls', 'xrp-rls',
    'ada-rls', 'dot-rls', 'doge-rls', 'trx-rls', 'ltc-rls', 'bnb-rls'
];

// تبدیل جفت‌ارزهای نوبیتکس به فرمت والکس
function convertToWallexFormat(pair: string): string {
    if (pair.endsWith('-usdt')) return pair.replace('-usdt', '').toUpperCase() + 'USDT';
    if (pair.endsWith('-rls')) return pair.replace('-rls', '').toUpperCase() + 'TMN';
    return '';
}

async function getNobitexPairs(): Promise<string[]> {
    try {
        const response = await fetch('https://api.nobitex.ir/market/stats');
        const data = await response.json();
        return Object.keys(data.stats || {}).filter(pair => pair.endsWith('-rls') && !data.stats[pair].isClosed);
    } catch (error) {
        console.error('❌ خطا در دریافت جفت‌ارزهای نوبیتکس:', error);
        return [];
    }
}

async function fetchNobitexData(pairs: string[]) {
    try {
        const response = await fetch('https://api.nobitex.ir/market/stats');
        const data = await response.json();

        return pairs.reduce((result, pair) => {
            const stats = data.stats[pair.toLowerCase()] || {};
            result[pair] = {
                price: stats.latest ? parseFloat(stats.latest) : 0,
                bestBid: stats.bestBuy ? parseFloat(stats.bestBuy) : 0,  // بهترین قیمت خرید
                bestAsk: stats.bestSell ? parseFloat(stats.bestSell) : 0,  // بهترین قیمت فروش
                volume: stats.volumeSrc ? parseFloat(stats.volumeSrc) : 0,
                spread: stats.bestSell && stats.bestBuy ? ((parseFloat(stats.bestSell) - parseFloat(stats.bestBuy)) / parseFloat(stats.bestSell)) * 100 : 0, // محاسبه اسپرد
                totalVolume: stats.volumeDst ? parseFloat(stats.volumeDst) : 0  // استفاده از volumeDst برای حجم کل
            };
            return result;
        }, {} as Record<string, { price: number; bestBid: number; bestAsk: number; volume: number; spread: number; totalVolume: number }>);
    } catch (error) {
        console.error('❌ خطا در دریافت داده‌های نوبیتکس:', error);
        return {};
    }
}

async function fetchWallexData(pairs: string[]) {
    try {
        const response = await fetch('https://api.wallex.ir/v1/markets');
        const data = await response.json();

        return pairs.reduce((result, pair) => {
            const wallexPair = convertToWallexFormat(pair);
            const marketData = data.result.symbols[wallexPair] || {};

            result[pair] = {
                price: marketData.stats?.lastPrice *10 ? parseFloat(marketData.stats.lastPrice)*10 : 0,
                bestBid: marketData.stats?.bidPrice *10? parseFloat(marketData.stats.bidPrice)*10 : 0, // بهترین قیمت خرید
                bestAsk: marketData.stats?.askPrice *10? parseFloat(marketData.stats.askPrice)*10 : 0, // بهترین قیمت فروش
                volume: marketData.stats?.volume ? parseFloat(marketData.stats['24h_tmnVolume']) *10 : 0 // حجم کل معاملات
            };
            return result;
        }, {} as Record<string, { price: number; bestBid: number; bestAsk: number; volume: number }>);
    } catch (error) {
        console.error('❌ خطا در دریافت داده‌های والکس:', error);
        return {};
    }
}

export async function GET() {
    try {
        const pairs = await getNobitexPairs();
        const [nobitex, wallex] = await Promise.all([
            fetchNobitexData(pairs),
            fetchWallexData(pairs)
        ]);

        const prices = pairs.map(pair => {
            const nobitexPrice = nobitex[pair]?.price || 0;
            const wallexPrice = wallex[pair]?.price || 0;
            const bestAsk = nobitex[pair]?.bestAsk || 0;
            const bestBid = wallex[pair]?.bestBid || 0;
            const totalVolume = (nobitex[pair]?.volume || 0) + (wallex[pair]?.volume || 0);
            const spread = (nobitex[pair]?.spread || 0);

            return {
                pair,
                nobitex: nobitexPrice,
                wallex: wallexPrice,
                difference: wallexPrice - nobitexPrice,
                percentage: nobitexPrice ? ((wallexPrice - nobitexPrice) / nobitexPrice) * 100 : 0,
                bestBid,
                bestAsk,
                spread,
                totalVolume
            };
        }).sort((a, b) => b.percentage - a.percentage);

        return NextResponse.json({ success: true, prices });
    } catch (error) {
        console.error('❌ خطا در پردازش API:', error);
        return NextResponse.json({ success: false, message: 'خطایی رخ داد' }, { status: 500 });
    }
}
