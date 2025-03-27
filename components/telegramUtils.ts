import axios from 'axios';

export async function sendTelegramMessage(message: string) {
    try {
        await axios.post("/api/sendTelegram", { message });
    } catch (error) {
        console.error("❌ خطا در ارسال پیام تلگرام:", error);
    }
}
