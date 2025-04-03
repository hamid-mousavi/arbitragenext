import { NextResponse } from 'next/server';

// تابع دریافت جفت‌ارزهای فعال از نوبیتکس
async function getNobitexPairs(): Promise<string[]> {
  try {
    const response = await fetch('https://api.nobitex.ir/market/stats');
    const data = await response.json();
    return Object.keys(data.stats || {})
      .filter(pair => pair.endsWith('-rls') && !data.stats[pair].isClosed);
  } catch (error) {
    console.error('خطا در دریافت جفت‌ارزهای نوبیتکس:', error);
    return [];
  }
}

// تابع دریافت جفت‌ارزهای فعال از والکس
async function getWallexPairs(): Promise<string[]> {
  try {
    const response = await fetch('https://api.wallex.ir/v1/markets');
    const data = await response.json();
    return Object.keys(data.result.symbols || {})
      .filter(symbol => symbol.endsWith('TMN'))
      .map(symbol => symbol.replace('TMN', '').toLowerCase() + '-rls');
  } catch (error) {
    console.error('خطا در دریافت جفت‌ارزهای والکس:', error);
    return [];
  }
}

// تابع تبدیل فرمت جفت‌ارز به فرمت والکس
function convertToWallexFormat(pair: string): string | null {
  if (pair.endsWith('-rls')) {
    return pair.replace('-rls', '').toUpperCase() + 'TMN';
  }
  return null;
}

// تابع دریافت داده‌های نوبیتکس
async function fetchNobitexData(pairs: string[]) {
    try {
      const response = await fetch('https://api.nobitex.ir/market/stats');
      const data = await response.json();
  
      return pairs.reduce((result, pair) => {
        const stats = data.stats[pair.toLowerCase()] || {};
        
        // ضریب تقسیم برای SHIB
        const divisor = pair.toLowerCase().startsWith('shib-') ? 1000 : 1;
        
        result[pair] = {
          bestBid: stats.bestBuy ? parseFloat(stats.bestBuy) / divisor : 0,
          bestAsk: stats.bestSell ? parseFloat(stats.bestSell) / divisor : 0,
          volume: stats.volumeSrc ? parseFloat(stats.volumeSrc) : 0,
          spread: stats.bestSell && stats.bestBuy ? 
            (parseFloat(stats.bestSell) - parseFloat(stats.bestBuy)) / parseFloat(stats.bestSell) * 100 : 0,
          totalVolume: stats.volumeDst ? parseFloat(stats.volumeDst) : 0
        };
        return result;
      }, {} as Record<string, any>);
    } catch (error) {
      console.error('خطا در دریافت داده‌های نوبیتکس:', error);
      return {};
    }
  }

// تابع دریافت داده‌های والکس
async function fetchWallexData(pairs: string[]) {
  try {
    const response = await fetch('https://api.wallex.ir/v1/markets');
    const data = await response.json();

    return pairs.reduce((result, pair) => {
      const wallexPair = convertToWallexFormat(pair);
      if (!wallexPair) {
        result[pair] = null;
        return result;
      }

      const marketData = data.result.symbols[wallexPair] || null;
      if (!marketData) {
        result[pair] = null;
        return result;
      }

      result[pair] = {
        bestBid: marketData.stats?.bidPrice ? parseFloat(marketData.stats.bidPrice) * 10 : 0,
        bestAsk: marketData.stats?.askPrice ? parseFloat(marketData.stats.askPrice) * 10 : 0,
        volume: marketData.stats?.['24h_tmnVolume'] ? parseFloat(marketData.stats['24h_tmnVolume']) * 10 : 0
      };
      return result;
    }, {} as Record<string, any>);
  } catch (error) {
    console.error('خطا در دریافت داده‌های والکس:', error);
    return {};
  }
}

export async function GET() {
  try {
    // دریافت جفت‌ارزهای موجود در هر دو صرافی
    const [nobitexPairs, wallexPairs] = await Promise.all([
      getNobitexPairs(),
      getWallexPairs()
    ]);
    
    // فقط جفت‌ارزهایی که در هر دو صرافی وجود دارند
    const commonPairs = nobitexPairs.filter(pair => 
      wallexPairs.includes(pair)
    );

    // دریافت داده‌های بازار برای جفت‌ارزهای مشترک
    const [nobitex, wallex] = await Promise.all([
      fetchNobitexData(commonPairs),
      fetchWallexData(commonPairs)
    ]);

    const prices = commonPairs
      .map(pair => {
        const nobitexData = nobitex[pair] || {};
        const wallexData = wallex[pair] || {};

        // محاسبه سود برای هر جهت آربیتراژ
        const calculateProfit = (direction: 'nobitex-to-wallex' | 'wallex-to-nobitex') => {
          const buyPrice = direction === 'nobitex-to-wallex' ? nobitexData.bestAsk : wallexData.bestAsk;
          const sellPrice = direction === 'nobitex-to-wallex' ? wallexData.bestBid : nobitexData.bestBid;
          
          if (!buyPrice || !sellPrice) return null;

          return {
            priceDifference: sellPrice - buyPrice,
            percentage: buyPrice ? ((sellPrice - buyPrice) / buyPrice) * 100 : 0
          };
        };

        const nobitexToWallex = calculateProfit('nobitex-to-wallex');
        const wallexToNobitex = calculateProfit('wallex-to-nobitex');

        if (!nobitexToWallex || !wallexToNobitex) return null;

        return {
          pair,
          nobitexBid: nobitexData.bestBid,
          nobitexAsk: nobitexData.bestAsk,
          wallexBid: wallexData.bestBid,
          wallexAsk: wallexData.bestAsk,
          spread: nobitexData.spread,
          totalVolume: (nobitexData.volume || 0) + (wallexData.volume || 0),
          arbitrageDirections: [
            { ...nobitexToWallex, direction: 'nobitex-to-wallex' },
            { ...wallexToNobitex, direction: 'wallex-to-nobitex' }
          ].filter(dir => dir !== null)
        };
      })
      .filter(item => item !== null && item.arbitrageDirections.length > 0)
      .sort((a, b) => {
        const maxA = Math.max(...a!.arbitrageDirections.map(d => d.percentage));
        const maxB = Math.max(...b!.arbitrageDirections.map(d => d.percentage));
        return maxB - maxA;
      });

    return NextResponse.json({ 
      success: true, 
      prices,
      availablePairs: commonPairs
    });
  } catch (error) {
    console.error('خطا در پردازش API:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'خطایی در دریافت داده‌ها رخ داد' 
    }, { status: 500 });
  }
}