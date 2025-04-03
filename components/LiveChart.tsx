"use client";
import React, { useEffect, useState } from "react";
import withdrawalFees from './withdrawalFees.json';
// تابع تبدیل اعداد انگلیسی به فارسی
const toPersianDigits = (num: string) => {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.replace(/\d/g, (match) => persianDigits[parseInt(match)]);
};
const PAGE_SIZE = 20;
const takerFeeNobitex = 0.0025;  // 0.25%
const makerFeeWallex = 0.002;     // 0.2%

interface WithdrawalFee {
  currency: string;
  network: string;
  min_withdrawal: string;
  withdrawal_fee: string;
  current_balance: string;
  current_withdrawal_fee: string;
}

interface NetworkOption {
  value: string;
  label: string;
}

interface PriceData {
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
  totalProfit: number;
  selectedNetwork: string;
  withdrawalFee: number;
}

const LiveChart = () => {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [visibleData, setVisibleData] = useState<PriceData[]>([]);
  const [sortField, setSortField] = useState<keyof PriceData>("percentage");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
// در بخش state سرمایه‌گذاری:
const [investment, setInvestment] = useState<number>(1000000000);
const [inputValue, setInputValue] = useState<string>('۱٬۰۰۰٬۰۰۰٬۰۰۰');

const [displayInvestment, setDisplayInvestment] = useState('۱٬۰۰۰٬۰۰۰٬۰۰۰'); // مقدار پیش‌فرض فرمت‌بندی شده
  const [networkOptions, setNetworkOptions] = useState<Record<string, NetworkOption[]>>({});
// تابع مدیریت تغییر مقدار سرمایه‌گذاری
 // تابع مدیریت تغییرات ورودی
 const handleInvestmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  
  // حذف تمام کاراکترهای غیرعددی و تبدیل اعداد فارسی به انگلیسی
  const englishNumbers = value.replace(/[^۰-۹0-9]/g, '')
    .replace(/[۰-۹]/g, (match) => 
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(match))
    );
  
  // اگر مقدار خالی بود
  if (!englishNumbers) {
    setInvestment(0);
    setInputValue('');
    return;
  }
  
  // تبدیل به عدد
  const numValue = parseInt(englishNumbers, 10);
  setInvestment(numValue);
  
  // فرمت‌بندی با جداکننده هزارگان و تبدیل به اعداد فارسی
  const formattedValue = numValue.toLocaleString('fa-IR');
  setInputValue(formattedValue);
};
  // تابع محاسبه کارمزد برداشت به واحد ارز دیجیتال
  const calculateWithdrawalFee = (currency: string, network: string): number => {
    const normalizedCurrency = currency.split('-')[0].toUpperCase();
    const feeData = withdrawalFees.find((item: WithdrawalFee) => 
      item.currency.toUpperCase() === normalizedCurrency && 
      item.network === network
    );
    
    if (!feeData) return 0;
    
    try {
      return parseFloat(feeData.withdrawal_fee.split(' ')[0]);
    } catch {
      return 0;
    }
  };

  // تابع محاسبه سود واقعی به ریال
  const calculateTotalProfitInRial = (
    profitInRial: number, 
    currency: string, 
    network: string, 
    nobitexPrice: number
  ): number => {
    const withdrawalFeeInCrypto = calculateWithdrawalFee(currency, network);
    const withdrawalFeeInRial = withdrawalFeeInCrypto * nobitexPrice;
    
    const tradingFees = profitInRial * (makerFeeWallex + takerFeeNobitex);
    const totalProfit = profitInRial - tradingFees - withdrawalFeeInRial;
    
    return Math.max(0, totalProfit); // جلوگیری از سود منفی
  };

  // تابع مرتب‌سازی
  const handleSort = (field: keyof PriceData) => {
    const newOrder = sortField === field && sortOrder === "desc" ? "asc" : "desc";
    setSortField(field);
    setSortOrder(newOrder);

    const sortedData = [...prices].sort((a, b) => {
      if (a[field] === undefined || b[field] === undefined) return 0;
      return newOrder === "asc" 
        ? (a[field] as number) - (b[field] as number)
        : (b[field] as number) - (a[field] as number);
    });

    setPrices(sortedData);
    setVisibleData(sortedData.slice(0, page * PAGE_SIZE));
  };

  // تابع دریافت گزینه‌های شبکه برای هر ارز
  const getNetworkOptions = (currency: string): NetworkOption[] => {
    const normalizedCurrency = currency.split('-')[0].toUpperCase();
    const fees = withdrawalFees.filter((item: WithdrawalFee) => 
      item.currency.toUpperCase() === normalizedCurrency
    );
    
    return fees.map(fee => ({
      value: fee.network,
      label: `${fee.network} (${fee.withdrawal_fee})`
    }));
  };

  // تابع تغییر شبکه انتخابی
  const handleNetworkChange = (pair: string, network: string) => {
    setPrices(prevPrices => prevPrices.map(item => {
      if (item.pair === pair) {
        const profitInRial = item.profit;
        const totalProfit = calculateTotalProfitInRial(
          profitInRial, 
          pair.split('-')[0], 
          network, 
          item.nobitex
        );
        
        return {
          ...item,
          selectedNetwork: network,
          withdrawalFee: calculateWithdrawalFee(pair, network),
          totalProfit
        };
      }
      return item;
    }));
  };

  // تابع مدیریت اسکرول
  const handleScroll = () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
      setPage(prev => prev + 1);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/arbitrage");
        const result = await response.json();
  
        if (result.success) {
          const processedData = result.prices
            .map((item: any) => {
              const currency = item.pair.split('-')[0];
              const networks = getNetworkOptions(currency);
              const defaultNetwork = networks[0]?.value || '';
              const profitInRial = item.nobitex > 0 
                ? investment * (item.difference / item.nobitex) 
                : 0;
              const totalProfit = calculateTotalProfitInRial(
                profitInRial, 
                currency, 
                defaultNetwork, 
                item.nobitex
              );
              
              return {
                pair: item.pair,
                nobitex: item.nobitex || 0,
                wallex: item.wallex || 0,
                difference: item.difference || 0,
                percentage: item.percentage ?? 0,
                bestBid: item.bestBid || 0,
                bestAsk: item.bestAsk || 0,
                spread: item.spread || 0,
                totalVolume: item.totalVolume || 0,
                profit: profitInRial,
                totalProfit,
                selectedNetwork: defaultNetwork,
                withdrawalFee: calculateWithdrawalFee(currency, defaultNetwork)
              };
            })
            .filter((item: any) => item.wallex && item.wallex !== 0)
            .sort((a: any, b: any) => b.percentage - a.percentage);
  
          setPrices(processedData);
          setVisibleData(processedData.slice(0, page * PAGE_SIZE));
          
          const options: Record<string, NetworkOption[]> = {};
          processedData.forEach((item: any) => {
            options[item.pair] = getNetworkOptions(item.pair.split('-')[0]);
          });
          setNetworkOptions(options);
        }
      } catch (error) {
        console.error("❌ خطا در دریافت داده‌ها:", error);
      }
    };
  
    fetchData();
    const interval = setInterval(fetchData, 100000);
    return () => clearInterval(interval);
  }, [investment]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setVisibleData(prices.slice(0, page * PAGE_SIZE));
  }, [page, prices]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-xl font-bold text-center mb-4">📊 فرصت‌های آربیتراژ</h2>

      <div className="mb-4">
      <label className="font-bold">💰 مبلغ سرمایه‌گذاری (ریال):</label>
      <input
        type="text"
        value={inputValue}
        onChange={handleInvestmentChange}
        className="border p-2 rounded w-full text-left"
        inputMode="numeric"
        dir="ltr"
      />
    </div>

      <table className="w-full border-collapse border border-gray-300 text-sm">
        <thead>
          <tr className="bg-gray-200 text-center">
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("pair")}>🪙 جفت ارز</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("nobitex")}>💰 نوبیتکس (ریال)</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("wallex")}>💰 والکس (ریال)</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("difference")}>🔍 اختلاف (ریال)</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("percentage")}>📈 درصد</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("profit")}>💵 سود اولیه (ریال)</th>
            <th className="p-2 border">🌐 شبکه برداشت</th>
            <th className="p-2 border">💸 کارمزد برداشت</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("totalProfit")}>📊 سود واقعی (ریال)</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("bestBid")}>🛒 بهترین خرید (ریال)</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("bestAsk")}>🏷️ بهترین فروش (ریال)</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("spread")}>⚡ اسپرد</th>
            <th className="p-2 border cursor-pointer" onClick={() => handleSort("totalVolume")}>📊 حجم کل</th>
          </tr>
        </thead>
        <tbody>
          {visibleData.map((item) => (
            <tr key={item.pair} className="text-center hover:bg-gray-50">
              <td className="p-2 border">{item.pair}</td>
              <td className="p-2 border">{item.nobitex.toLocaleString('fa-IR')}</td>
              <td className="p-2 border">{item.wallex.toLocaleString('fa-IR')}</td>
              <td className="p-2 border text-red-500">{item.difference.toLocaleString('fa-IR')}</td>
              <td className="p-2 border text-green-600">{item.percentage.toFixed(2)}%</td>
              <td className="p-2 border text-blue-500">{Math.floor(item.profit).toLocaleString('fa-IR')}</td>
              <td className="p-2 border">
                <select 
                  value={item.selectedNetwork}
                  onChange={(e) => handleNetworkChange(item.pair, e.target.value)}
                  className="border rounded p-1 text-xs w-full"
                >
                  {networkOptions[item.pair]?.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-2 border">
                {item.withdrawalFee} {item.pair.split('-')[0]}
              </td>
              <td className="p-2 border text-purple-600 font-medium">
                {Math.floor(item.totalProfit).toLocaleString('fa-IR')}
              </td>
              <td className="p-2 border">{item.bestBid.toLocaleString('fa-IR')}</td>
              <td className="p-2 border">{item.bestAsk.toLocaleString('fa-IR')}</td>
              <td className="p-2 border text-orange-600">{item.spread.toFixed(2)}%</td>
              <td className="p-2 border text-purple-600">{item.totalVolume.toLocaleString('fa-IR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LiveChart;