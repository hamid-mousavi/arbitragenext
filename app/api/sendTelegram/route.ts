import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: Request) {
    try {
        const { message } = await req.json();
        const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            return NextResponse.json({ success: false, error: "Missing Telegram credentials" }, { status: 400 });
        }

        const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(telegramApiUrl, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: "Markdown",
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("❌ خطا در ارسال پیام تلگرام:", error);
        return NextResponse.json({ success: false, error: "Failed to send Telegram message" }, { status: 500 });
    }
}
