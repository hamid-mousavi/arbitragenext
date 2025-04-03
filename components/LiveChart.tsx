"use client";
import React, { useEffect, useState } from "react";
import withdrawalFees from './withdrawalFees.json';

const PAGE_SIZE = 20;
const takerFeeNobitex = 0.0025;  // 0.25%
const makerFeeNobitex = 0.0015;   // 0.15%
const takerFeeWallex = 0.0025;    // 0.25%
const makerFeeWallex = 0.002;     // 0.2%

interface WithdrawalFee {
  currency: string;
  network: string;
  withdrawal_fee: string;
}

interface NetworkOption {
  value: string;
  label: string;
}

interface ArbitrageDirection {
  direction: 'nobitex-to-wallex' | 'wallex-to-nobitex';
  priceDifference: number;
  percentage: number;
  profit: number;
  totalProfit: number;
  cryptoAmount: number;
  tradingFees: number;
  withdrawalFee: number;
}

interface PriceData {
  pair: string;
  nobitexBid: number;
  nobitexAsk: number;
  wallexBid: number;
  wallexAsk: number;
  spread: number;
  totalVolume: number;
  arbitrageDirections: ArbitrageDirection[];
  selectedNetwork: string;
}

const LiveChart = () => {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [visibleData, setVisibleData] = useState<PriceData[]>([]);
  const [page, setPage] = useState(1);
  const [investment, setInvestment] = useState<number>(1000000000);
  const [inputValue, setInputValue] = useState<string>('۱٬۰۰۰٬۰۰۰٬۰۰۰');
  const [networkOptions, setNetworkOptions] = useState<Record<string, NetworkOption[]>>({});

  // تبدیل اعداد به فارسی و مدیریت ورودی سرمایه
  const handleInvestmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const englishNumbers = value.replace(/[^۰-۹0-9]/g, '')
      .replace(/[۰-۹]/g, (match) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(match)));
    
    if (!englishNumbers) {
      setInvestment(0);
      setInputValue('');
      return;
    }
    
    const numValue = parseInt(englishNumbers, 10);
    setInvestment(numValue);
    setInputValue(numValue.toLocaleString('fa-IR'));
  };

  // محاسبه کارمزد برداشت
  const calculateWithdrawalFee = (currency: string, network: string): number => {
    const normalizedCurrency = currency.split('-')[0].toUpperCase();
    const feeData = withdrawalFees.find((item: WithdrawalFee) => 
      item.currency.toUpperCase() === normalizedCurrency && 
      item.network === network
    );
    
    return feeData ? parseFloat(feeData.withdrawal_fee.split(' ')[0]) : 0;
  };

  // تغییر شبکه انتخابی
  const handleNetworkChange = (pair: string, network: string) => {
    setPrices(prevPrices => prevPrices.map(item => {
      if (item.pair === pair) {
        const updatedDirections = item.arbitrageDirections.map(dir => {
          const withdrawalFee = calculateWithdrawalFee(pair.split('-')[0], network);
          const withdrawalFeeInRial = withdrawalFee * (dir.direction === 'nobitex-to-wallex' ? item.nobitexAsk : item.wallexAsk);
          
          return {
            ...dir,
            withdrawalFee,
            totalProfit: dir.profit - dir.tradingFees - withdrawalFeeInRial
          };
        });
        
        return {
          ...item,
          selectedNetwork: network,
          arbitrageDirections: updatedDirections
        };
      }
      return item;
    }));
  };

  // دریافت داده‌ها از API
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
              
              // محاسبه سود برای هر جهت
              const directions = item.arbitrageDirections.map((dir: any) => {
                const buyPrice = dir.direction === 'nobitex-to-wallex' ? item.nobitexAsk : item.wallexAsk;
                const sellPrice = dir.direction === 'nobitex-to-wallex' ? item.wallexBid : item.nobitexBid;
                
                // مقدار ارز قابل خرید
                const cryptoAmount = investment / (buyPrice * (1 + 
                  (dir.direction === 'nobitex-to-wallex' ? takerFeeNobitex : takerFeeWallex)));
                
                // درآمد حاصل از فروش
                const sellRevenue = cryptoAmount * sellPrice * (1 - 
                  (dir.direction === 'nobitex-to-wallex' ? makerFeeWallex : makerFeeNobitex));
                
                // سود اولیه
                const profit = sellRevenue - investment;
                
                // کارمزدهای معامله
                const tradingFees = investment * 
                  (dir.direction === 'nobitex-to-wallex' 
                    ? (takerFeeNobitex + makerFeeWallex) 
                    : (takerFeeWallex + makerFeeNobitex));
                
                // کارمزد انتقال
                const withdrawalFee = calculateWithdrawalFee(currency, defaultNetwork);
                const withdrawalFeeInRial = withdrawalFee * buyPrice;
                
                // سود واقعی
                const totalProfit = profit - tradingFees - withdrawalFeeInRial;
                
                return {
                  ...dir,
                  profit,
                  totalProfit,
                  cryptoAmount,
                  tradingFees,
                  withdrawalFee
                };
              });
              
              return {
                ...item,
                arbitrageDirections: directions,
                selectedNetwork: defaultNetwork
              };
            });

          setPrices(processedData);
          setVisibleData(processedData.slice(0, page * PAGE_SIZE));
          
          const options: Record<string, NetworkOption[]> = {};
          processedData.forEach((item: any) => {
            options[item.pair] = getNetworkOptions(item.pair.split('-')[0]);
          });
          setNetworkOptions(options);
        }
      } catch (error) {
        console.error("خطا در دریافت داده‌ها:", error);
      }
    };
  
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [investment]);

  // دریافت گزینه‌های شبکه برای هر ارز
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

  // مدیریت اسکرول بی‌نهایت
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        setPage(prev => prev + 1);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setVisibleData(prices.slice(0, page * PAGE_SIZE));
  }, [page, prices]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-xl font-bold text-center mb-4">📊 فرصت‌های آربیتراژ دوطرفه (نوبیتکس ↔ والکس)</h2>

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

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-200 text-center">
              <th className="p-2 border">🪙 جفت ارز / جهت</th>
              <th className="p-2 border">💰 قیمت خرید</th>
              <th className="p-2 border">🏷️ قیمت فروش</th>
              <th className="p-2 border">🔍 اختلاف (ریال)</th>
              <th className="p-2 border">📈 درصد سود</th>
              <th className="p-2 border">💎 مقدار ارز</th>
              <th className="p-2 border">💵 سود اولیه</th>
              <th className="p-2 border">🧾 کارمزد معامله</th>
              <th className="p-2 border">🌐 شبکه</th>
              <th className="p-2 border">💸 کارمزد برداشت</th>
              <th className="p-2 border">📊 سود واقعی</th>
            </tr>
          </thead>
       
          <tbody>
  {visibleData.flatMap((item, itemIndex) =>
    item.arbitrageDirections.map((dir, dirIndex) => {
      // ایجاد کلید کاملاً منحصر به فرد
      const uniqueRowKey = `${item.pair}-${dir.direction}-${item.selectedNetwork}-${itemIndex}-${dirIndex}`;
      
      return (
        <tr key={uniqueRowKey} className="text-center hover:bg-gray-50">

          <td className="p-2 border">
            {item.pair} 
            <span className="block text-xs text-gray-500">
              {dir.direction === 'nobitex-to-wallex' ? '← نوبیتکس به والکس' : '→ والکس به نوبیتکس'}
            </span>
          </td>
          <td className="p-2 border">
            {dir.direction === 'nobitex-to-wallex' 
              ? item.nobitexAsk.toLocaleString('fa-IR') 
              : item.wallexAsk.toLocaleString('fa-IR')}
          </td>
          <td className="p-2 border">
            {dir.direction === 'nobitex-to-wallex' 
              ? item.wallexBid.toLocaleString('fa-IR') 
              : item.nobitexBid.toLocaleString('fa-IR')}
          </td>
          <td className={`p-2 border ${dir.priceDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {dir.priceDifference.toLocaleString('fa-IR')}
          </td>
          <td className={`p-2 border ${dir.percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {dir.percentage.toFixed(2)}%
          </td>
          <td className="p-2 border">
            {dir.cryptoAmount.toFixed(8)} {item.pair.split('-')[0].toUpperCase()}
          </td>
          <td className={`p-2 border ${dir.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {Math.floor(dir.profit).toLocaleString('fa-IR')}
          </td>
          <td className="p-2 border">
            {Math.floor(dir.tradingFees).toLocaleString('fa-IR')}
          </td>
          <td className="p-2 border">
            <select 
              value={item.selectedNetwork}
              onChange={(e) => handleNetworkChange(item.pair, e.target.value)}
              className="border rounded p-1 text-xs w-full"
            >
              {networkOptions[item.pair]?.map((option, optionIndex) => (
                <option 
                  key={`${item.pair}-${option.value}-${optionIndex}`}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </td>
          <td className="p-2 border">
            {dir.withdrawalFee} {item.pair.split('-')[0].toUpperCase()}
          </td>
          <td className={`p-2 border font-medium ${dir.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {Math.floor(dir.totalProfit).toLocaleString('fa-IR')}
          </td>
        </tr>
      );
    })
  )}
</tbody>
        </table>
      </div>
    </div>
  );
};

export default LiveChart;