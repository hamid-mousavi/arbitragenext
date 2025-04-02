"use client";
import { exit } from "process";
import React, { useEffect, useState } from "react";

const PAGE_SIZE = 20; // تعداد جفت ارزهایی که هر بار نمایش داده می‌شود

const LiveChart = () => {
  const [prices, setPrices] = useState<
    {
      pair: string;
      nobitex: number;
      wallex: number;
      difference: number;
      percentage: number;
      profit: number;
      bestBid: number;
      bestAsk: number;
      spread: number;
      totalVolume: number;
    }[]
  >([]);
  const [visibleData, setVisibleData] = useState<typeof prices>([]);
  const [sortField, setSortField] = useState<string | null>("percentage");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [investment, setInvestment] = useState(100000000); // مقدار پیش‌فرض ۱۰۰ میلیون ریال

  // 📌 دریافت داده‌ها از API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/arbitrage");
        const result = await response.json();
  
        if (result.success) {
          console.log("داده‌های دریافتی:", result);  // اضافه کردن این خط برای بررسی داده‌ها
          const sortedData = result.prices
            .map((item: any) => ({
              pair: item.pair,
              nobitex: item.nobitex || 0,
              wallex: item.wallex || 0,
              difference: item.difference || 0,
              percentage: item.percentage ?? 0,
              bestBid: item.bestBid || 0,
              bestAsk: item.bestAsk || 0,
              spread: item.spread || 0,
              totalVolume: item.totalVolume || 0,
            }))
            .sort((a: { percentage: number; }, b: { percentage: number; }) => b.percentage - a.percentage);
  
          setPrices(sortedData);
          setVisibleData(sortedData.slice(0, page * PAGE_SIZE));
        }
      } catch (error) {
        console.error("❌ خطا در دریافت داده‌ها:", error);
      }
    };
  
    fetchData();
    const interval = setInterval(fetchData, 100000); // بروزرسانی هر ۱۰ ثانیه
  
    return () => clearInterval(interval);
  }, []);
  
  // 📌 لود تدریجی داده‌ها هنگام اسکرول
  const handleScroll = () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
      setPage((prevPage) => prevPage + 1);
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setVisibleData(prices.slice(0, page * PAGE_SIZE));
  }, [page, prices]);

  // 📌 مرتب‌سازی جدول هنگام کلیک روی ستون‌ها
  const handleSort = (field: keyof (typeof prices)[0]) => {
    const newOrder = sortField === field && sortOrder === "desc" ? "asc" : "desc";
    setSortField(field);
    setSortOrder(newOrder);

    const sortedData = [...prices].sort((a, b) => {
      if (newOrder === "asc") return (a[field] as number) - (b[field] as number);
      return (b[field] as number) - (a[field] as number);
    });

    setPrices(sortedData);
    setVisibleData(sortedData.slice(0, page * PAGE_SIZE));
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-xl font-bold text-center mb-4">📊 فرصت‌های آربیتراژ</h2>

      {/* 📌 فیلد ورودی برای مبلغ سرمایه */}
      <div className="mb-4">
        <label className="font-bold">💰 مبلغ سرمایه‌گذاری (ریال):</label>
        <input
          type="number"
          value={investment}
          onChange={(e) => setInvestment(Number(e.target.value))}
          className="border p-2 rounded w-full"
        />
      </div>

      <table className="w-full border-collapse border border-gray-300 text-sm">
        <thead>
          <tr className="bg-gray-200 text-center">
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("pair")}>🪙 جفت ارز</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("nobitex")}>💰 نوبیتکس</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("wallex")}>💰 والکس</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("difference")}>🔍 اختلاف</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("percentage")}>📈 درصد</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("profit")}>💵 سود {investment.toLocaleString()}</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("bestBid")}>🛒 بهترین قیمت خرید</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("bestAsk")}>🏷️ بهترین قیمت فروش</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("spread")}>⚡ اسپرد</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("totalVolume")}>📊 حجم کل</th>
          </tr>
        </thead>
        <tbody>
          {visibleData.map(({ pair, nobitex, wallex, difference, percentage, bestBid, bestAsk, spread, totalVolume }) => {
            const profit = nobitex > 0 ? investment * (difference / nobitex) : 0;
            if (!wallex || wallex === 0) {
              console.warn(`⚠️ جفت ارز ${pair} در والکس موجود نیست.`);
              exit; // این جفت‌ارز رو از جدول حذف کن
          }else{
            return (
              <tr key={pair} className="text-center">
                <td className="p-2 border">{pair}</td>
                <td className="p-2 border">{nobitex.toLocaleString()}</td>
                <td className="p-2 border">{wallex.toLocaleString() }</td>
                <td className="p-2 border text-red-500">{difference.toLocaleString()}</td>
                <td className="p-2 border text-green-600">{percentage.toFixed(2)}%</td>
                <td className="p-2 border text-blue-500">{Math.floor(profit).toLocaleString()}</td>
                <td className="p-2 border">{bestBid.toLocaleString()}</td>
                <td className="p-2 border">{bestAsk.toLocaleString()}</td>
                <td className="p-2 border text-orange-600">{spread.toFixed(2)}%</td>
                <td className="p-2 border text-purple-600">{totalVolume.toLocaleString()}</td>
              </tr>
            );
          }
          
           
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LiveChart;
