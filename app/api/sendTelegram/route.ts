// import { NextResponse } from "next/server";
// import axios from "axios";

// export async function POST(req: Request) {
//     try {
//         const { message } = await req.json();
//         const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
//         const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

//         if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
//             return NextResponse.json({ success: false, error: "Missing Telegram credentials" }, { status: 400 });
//         }

//         const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
//         await axios.post(telegramApiUrl, {
//             chat_id: TELEGRAM_CHAT_ID,
//             text: message,
//             parse_mode: "Markdown",
//         });

//         return NextResponse.json({ success: true });

//     } catch (error) {
//         console.error("❌ خطا در ارسال پیام تلگرام:", error);
//         return NextResponse.json({ success: false, error: "Failed to send Telegram message" }, { status: 500 });
//     }
// }


import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export async function GET(req: NextRequest) {
    try {
        // دریافت قیمت‌ها از API
        const response = await fetch(`${apiUrl}/api/arbitrage`);
        const result = await response.json();

        if (!result.success) {
            return NextResponse.json({ success: false, message: "خطا در دریافت داده‌ها از API" });
        }

        // بررسی اختلاف قیمت برای ارسال پیام
        if (result.difference > 15000) {
            const message = `🚀 فرصت آربیتراژ!\n\n💰 قیمت نوبیتکس: ${result.nobitex}\n💰 قیمت والکس: ${result.wallex}\n🔍 اختلاف قیمت: ${result.difference}`;
            
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: "Markdown",
            });

            return NextResponse.json({ success: true, message: "پیام به تلگرام ارسال شد" });
        }

        return NextResponse.json({ success: true, message: "اختلاف قیمت کافی نبود، پیام ارسال نشد" });
    } catch (error) {
        return NextResponse.json({ success: false, message: "خطا در ارسال پیام", error });
    }
}
