'use client'
import LiveChart from '@/components/LiveChart';
import { useEffect } from "react";
import { requestNotificationPermission } from "@/components/notification"; // مسیر درست رو چک کن


export default function Home() {
    useEffect(() => {
        requestNotificationPermission();
    }, []);
    return (
        <div>
            <h1>💰 داشبورد آربیتراژ</h1>
            <LiveChart />
        </div>
    );
}
