import 'dotenv/config';
import axios from 'axios';
import { NextResponse } from 'next/server';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
export async function GET() {
    try {
        const [nobitexPrice, wallexPrice] = await Promise.all([
            getNobitexPrice(),
            getWallexPrice()
        ]);

        if (nobitexPrice && wallexPrice) {
            const difference = Math.abs(nobitexPrice - wallexPrice);

            return NextResponse.json({
                success: true,
                nobitex: nobitexPrice,
                wallex: wallexPrice,
                difference: difference
            });
        } else {
            return NextResponse.json({ success: false, error: "عدم دریافت قیمت" }, { status: 500 });
        }
    } catch (error) {
        console.error('خطا:', error);
        return NextResponse.json({ success: false, error: 'مشکلی رخ داد.' }, { status: 500 });
    }
}

// دریافت قیمت از نوبیتکس
async function getNobitexPrice(): Promise<number | null> {
    try {
        const { data } = await axios.post('https://api.nobitex.ir/market/stats', {
            srcCurrency: 'usdt',
            dstCurrency: 'rls'
        });
        return data?.stats?.['usdt-rls']?.latest ? parseFloat(data.stats['usdt-rls'].latest) : null;
    } catch (error) {
        return null;
    }
}

// دریافت قیمت از والکس
async function getWallexPrice(): Promise<number | null> {
    try {
        const { data } = await axios.get('https://api.wallex.ir/v1/markets');
        return data?.result?.symbols?.['USDTTMN']?.stats?.lastPrice
            ? parseFloat(data.result.symbols['USDTTMN'].stats.lastPrice) * 10
            : null;
    } catch (error) {
        return null;
    }
}
