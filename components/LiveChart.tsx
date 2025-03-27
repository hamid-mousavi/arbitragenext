'use client';
import { Line } from 'react-chartjs-2';
import { useEffect, useState } from 'react';
import '@/components/chartSetup';
import { sendTelegramMessage } from '@/components/telegramUtils'; // 📌 مطمئن شو این فایل وجود داره!

// 📢 ارسال نوتیفیکیشن مرورگر
export function sendNotification(title: string, message: string) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
            body: message,
            icon: "/favicon.ico",
        });
    }
}

const MAX_HISTORY = 8640; // حداکثر تعداد رکوردها در ۲۴ ساعت (هر ۱۰ ثانیه یک داده)

const LiveChart = () => {
    const [nobitexPrices, setNobitexPrices] = useState<number[]>([]);
    const [wallexPrices, setWallexPrices] = useState<number[]>([]);
    const [differences, setDifferences] = useState<number[]>([]);
    const [labels, setLabels] = useState<string[]>([]);
    const [bestArbitrage, setBestArbitrage] = useState<{ time: string, difference: number }>({ time: "", difference: 0 });

  // مقدار اولیه فقط برای جلوگیری از خطای SSR، بعداً مقداردهی می‌شود
  const [currentPrices, setCurrentPrices] = useState({ nobitex: 0, wallex: 0, difference: 0 });
  const [history, setHistory] = useState<{ time: string, nobitex: number, wallex: number, difference: number }[]>([]);

  useEffect(() => {
      if (typeof window !== "undefined") {
          // دریافت مقدار ذخیره‌شده در `localStorage`
          const savedPrices = localStorage.getItem('currentPrices');
          if (savedPrices) setCurrentPrices(JSON.parse(savedPrices));

          const savedHistory = localStorage.getItem('history');
          if (savedHistory) setHistory(JSON.parse(savedHistory));
      }
  }, []);

  useEffect(() => {
      const fetchData = async () => {
          try {
              const response = await fetch('/api/arbitrage');
              const result = await response.json();
              console.log('📡 دریافت داده:', result);

              if (result.success && result.nobitex && result.wallex) {
                  const now = new Date().toLocaleTimeString();

                  // اضافه کردن داده جدید به تاریخچه
                  const newRecord = { time: now, nobitex: result.nobitex, wallex: result.wallex, difference: result.difference };
                  setHistory(prev => {
                      const updatedHistory = [...prev.slice(-MAX_HISTORY + 1), newRecord];
                      if (typeof window !== "undefined") {
                          localStorage.setItem('history', JSON.stringify(updatedHistory));
                      }
                      return updatedHistory;
                  });

                  // بروزرسانی قیمت‌ها
                  setNobitexPrices(prev => [...prev.slice(-9), result.nobitex]);
                  setWallexPrices(prev => [...prev.slice(-9), result.wallex]);
                  setDifferences(prev => [...prev.slice(-9), result.difference]);
                  setLabels(prev => [...prev.slice(-9), now]);

                  // بروزرسانی مقدار `currentPrices`
                  setCurrentPrices({
                      nobitex: result.nobitex,
                      wallex: result.wallex,
                      difference: result.difference
                  });

                  if (typeof window !== "undefined") {
                      localStorage.setItem('currentPrices', JSON.stringify({
                          nobitex: result.nobitex,
                          wallex: result.wallex,
                          difference: result.difference
                      }));
                  }

                  // بررسی بهترین فرصت آربیتراژ
                  if (result.difference > bestArbitrage.difference) {
                      setBestArbitrage({ time: now, difference: result.difference });

                    //   // ✅ ارسال به تلگرام
                    //   const message = `
                    //   🚀 *بهترین فرصت آربیتراژ در ۲۴ ساعت اخیر!* 🚀
                    //   ⏰ زمان: ${now}
                    //   🔍 اختلاف قیمت: ${result.difference.toLocaleString()} ریال
                    //   💰 *قیمت نوبیتکس:* ${result.nobitex.toLocaleString()} ریال
                    //   💰 *قیمت والکس:* ${result.wallex.toLocaleString()} ریال
                    //   📢 فرصت را از دست ندهید!
                    //   `;
                    //   sendTelegramMessage(message);
                  }

                  // ارسال نوتیفیکیشن اگر اختلاف زیاد باشد
                  if (result.difference > 15000) {
                      sendNotification("🚀 فرصت آربیتراژ!", `اختلاف قیمت به ${result.difference.toLocaleString()} ریال رسید!`);
                  }
              } else {
                  console.warn('⚠️ مقدار نامعتبر از API:', result);
              }
          } catch (error) {
              console.error('❌ خطا در دریافت داده‌ها:', error);
          }
      };

      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);

  }, [bestArbitrage]);


    return (
        <div className="max-w-2xl mx-auto p-4">
            {/* 📌 نمایش قیمت‌های لحظه‌ای */}
            <div className="bg-gray-100 p-4 rounded-md shadow-md text-center mb-4">
                <h2 className="text-xl font-bold">📊 قیمت‌های لحظه‌ای</h2>
                <p className="text-blue-600 font-semibold">💰 قیمت نوبیتکس: {currentPrices.nobitex.toLocaleString()} ریال</p>
                <p className="text-green-600 font-semibold">💰 قیمت والکس: {currentPrices.wallex.toLocaleString()} ریال</p>
                <p className="text-red-600 font-semibold">🔍 اختلاف قیمت: {currentPrices.difference.toLocaleString()} ریال</p>
            </div>

            {/* 📌 نمایش بهترین فرصت آربیتراژ در ۲۴ ساعت اخیر */}
            <div className="bg-yellow-100 p-4 rounded-md shadow-md text-center mb-4">
                <h2 className="text-xl font-bold">🔥 بهترین فرصت آربیتراژ ۲۴ ساعت اخیر</h2>
                <p className="text-red-600 font-semibold">🔍 بیشترین اختلاف قیمت: {bestArbitrage.difference.toLocaleString()} ریال</p>
                <p className="text-gray-700">⏰ در ساعت: {bestArbitrage.time}</p>
            </div>

            {/* 📌 نمایش چارت */}
            <div className="bg-white p-4 rounded-md shadow-md">
                <h2 className="text-xl font-bold text-center mb-2">📈 نمودار تغییرات قیمت</h2>
                <Line
                    data={{
                        labels,
                        datasets: [
                            {
                                label: 'قیمت نوبیتکس',
                                data: nobitexPrices,
                                borderColor: 'blue',
                                backgroundColor: 'rgba(0, 0, 255, 0.2)',
                                fill: false,
                                pointStyle: 'circle',
                                pointRadius: 5,
                                borderWidth: 2,
                                yAxisID: 'priceAxis'
                            },
                            {
                                label: 'قیمت والکس',
                                data: wallexPrices,
                                borderColor: 'green',
                                backgroundColor: 'rgba(0, 255, 0, 0.2)',
                                fill: false,
                                pointStyle: 'triangle',
                                pointRadius: 5,
                                borderWidth: 2,
                                yAxisID: 'priceAxis'
                            },
                            {
                                label: 'اختلاف قیمت',
                                data: differences,
                                borderColor: 'red',
                                backgroundColor: 'rgba(255, 0, 0, 0.2)',
                                fill: false,
                                borderDash: [5, 5],
                                pointStyle: 'rectRot',
                                pointRadius: 5,
                                borderWidth: 2,
                                yAxisID: 'diffAxis'
                            }
                        ]
                    }}
                    options={{
                        responsive: true,
                        plugins: { legend: { display: true } },
                        scales: {
                            x: { display: true },
                            priceAxis: {
                                type: 'linear',
                                position: 'left',
                                ticks: {
                                    callback: value => value.toLocaleString()
                                },
                                suggestedMin: Math.min(...nobitexPrices, ...wallexPrices) - 1000,
                                suggestedMax: Math.max(...nobitexPrices, ...wallexPrices) + 1000
                            },
                            diffAxis: {
                                type: 'linear',
                                position: 'right',
                                grid: { drawOnChartArea: false }
                            }
                        }
                    }}
                    style={{ width: '100%', height: '400px' }}
                />
            </div>
        </div>
    );
};

export default LiveChart;
