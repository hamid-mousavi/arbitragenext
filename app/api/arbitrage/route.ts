import 'dotenv/config';
import axios from 'axios';
import { NextResponse } from 'next/server';
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
const telegramChatId = process.env.TELEGRAM_CHAT_ID || '';
let lastNotificationDate: string | null = null; // ذخیره آخرین روز ارسال پیام

export async function GET() {
    try {
        const [nobitexPrice, wallexPrice] = await Promise.all([
            getNobitexPrice(),
            getWallexPrice()
        ]);

        if (nobitexPrice && wallexPrice) {
            console.log(`💰 قیمت USDT در نوبیتکس: ${nobitexPrice}`);
            console.log(`💰 قیمت USDT در والکس: ${wallexPrice}`);

            const difference = Math.abs(nobitexPrice - wallexPrice);
            console.log(`🔍 اختلاف قیمت: ${difference}`);

            const today = new Date().toISOString().split('T')[0]; // تاریخ امروز

            if (difference > 500 && lastNotificationDate !== today) {
                console.log('🚀 فرصت آربیتراژ شناسایی شد! 🚀');

                const message = `
🚀 *فرصت آربیتراژ شناسایی شد!* 🚀\n
💰 *قیمت USDT در نوبیتکس:* ${nobitexPrice} ریال\n
💰 *قیمت USDT در والکس:* ${wallexPrice} ریال\n
🔍 *اختلاف قیمت:* ${difference} ریال\n
📢 همین حالا اقدام کنید!`;

                await sendTelegramMessage(message);
                lastNotificationDate = today;
            }
        } else {
            console.log('❌ دریافت قیمت از یکی از APIها ناموفق بود.');
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('خطا:', error);
        return NextResponse.json({ error: 'مشکلی رخ داد.' }, { status: 500 });
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
        console.error('❌ خطا در دریافت قیمت از نوبیتکس:', error);
        return null;
    }
}

// دریافت قیمت از والکس
async function getWallexPrice(): Promise<number | null> {
    try {
        const { data } = await axios.get('https://api.wallex.ir/v1/markets');
        return data?.result?.symbols?.['USDTTMN']?.stats?.lastPrice ? parseFloat(data.result.symbols['USDTTMN'].stats.lastPrice) * 10 : null;
    } catch (error) {
        console.error('❌ خطا در دریافت قیمت از والکس:', error);
        return null;
    }
}

// ارسال پیام به تلگرام
async function sendTelegramMessage(message: string) {
    try {
        const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
        await axios.post(url, {
            chat_id: telegramChatId,
            text: message,
            parse_mode: 'Markdown'
        });
        console.log('✅ پیام به تلگرام ارسال شد.');
    } catch (error) {
        console.error('❌ خطا در ارسال پیام تلگرام:', error);
    }
}
