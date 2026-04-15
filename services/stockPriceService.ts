export interface FetchStockPricesResult {
  prices: { [key: string]: number };
  errors: { [key: string]: string };
}

export interface StockHistoryPoint {
  date: string;
  price: number;
}

export const fetchStockPrices = async (tickers: string[]): Promise<FetchStockPricesResult> => {
    const originalUniqueTickers = [...new Set(tickers)];
    const validTickers: string[] = [];
    const validationErrors: { [key: string]: string } = {};

    const tickerRegex = /^[A-Z0-9]{6}$/;
    for (const ticker of originalUniqueTickers) {
        if (typeof ticker === 'string' && tickerRegex.test(ticker)) {
            validTickers.push(ticker);
        } else {
            validationErrors[ticker] = `Invalid ticker format: '${ticker}'.`;
        }
    }

    if (validTickers.length === 0) {
        return { prices: {}, errors: validationErrors };
    }

    try {
        const response = await fetch('/api/stock-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers: validTickers })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error("Expected JSON but received:", text.substring(0, 100));
            throw new Error("서버에서 올바른 형식(JSON)의 데이터를 보내지 않았습니다.");
        }

        const data = await response.json();
        return {
            prices: data.prices || {},
            errors: { ...validationErrors, ...(data.errors || {}) }
        };
    } catch (error) {
        console.error("Failed to fetch stock prices:", error);
        const fallbackErrors: Record<string, string> = { ...validationErrors };
        validTickers.forEach(t => fallbackErrors[t] = 'Server error');
        return { prices: {}, errors: fallbackErrors };
    }
};

export const fetchStockHistory = async (ticker: string): Promise<StockHistoryPoint[]> => {
    const tickerRegex = /^[A-Z0-9]{6}$/;
    if (typeof ticker !== 'string' || !tickerRegex.test(ticker)) {
        throw new Error(`Invalid ticker format for history fetch: '${ticker}'.`);
    }

    const response = await fetch(`/api/stock-history/${ticker}`);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) {
        throw new Error("Invalid data format received from history API.");
    }

    const historyData = data.slice(1);
    const formattedHistory = historyData.map((row: any[]) => {
        const dateStr = String(row[0]);
        return {
            date: `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`,
            price: Number(row[1]),
        };
    }).filter(point => !isNaN(point.price) && point.date);

    return formattedHistory.reverse();
};