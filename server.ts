import express from 'express';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // CORS middleware for iframe and cross-origin compatibility
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API Routes: Batch Stock Prices
  app.post('/api/stock-prices', async (req, res) => {
    const { tickers } = req.body || {};
    if (!Array.isArray(tickers)) {
      return res.status(400).json({ error: 'tickers must be an array' });
    }

    if (tickers.length === 0) {
      return res.json({ prices: {}, errors: {} });
    }

    const prices: Record<string, number> = {};
    const errors: Record<string, string> = {};

    // Fetch prices in parallel with per-ticker timeouts and multiple fallback sources
    await Promise.all(tickers.map(async (ticker) => {
      try {
        // Strategy 1: Naver Mobile API (Fast and highly accurate for Korean Stocks & ETFs)
        try {
          const controller1 = new AbortController();
          const timer1 = setTimeout(() => controller1.abort(), 3500);
          const basicRes = await fetch(`https://m.stock.naver.com/api/stock/${ticker}/basic`, {
            signal: controller1.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          clearTimeout(timer1);
          if (basicRes.ok) {
            const basicData: any = await basicRes.json().catch(() => null);
            const rawClose = basicData?.closePrice || basicData?.nowPrice;
            if (rawClose) {
              const numPrice = Number(String(rawClose).replace(/,/g, '').trim());
              if (!isNaN(numPrice) && numPrice > 0) {
                prices[ticker] = numPrice;
                return;
              }
            }
          }
        } catch {
          // Continue to fallback
        }

        // Strategy 2: Naver Polling API
        try {
          const controller2 = new AbortController();
          const timer2 = setTimeout(() => controller2.abort(), 3500);
          const naverUrl = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${ticker}`;
          const naverRes = await fetch(naverUrl, { signal: controller2.signal });
          clearTimeout(timer2);
          if (naverRes.ok) {
            const naverData: any = await naverRes.json().catch(() => null);
            const price = naverData?.result?.areas?.[0]?.datas?.[0]?.nv;
            if (typeof price === 'number' && price > 0) {
              prices[ticker] = price;
              return;
            }
          }
        } catch {
          // Continue to fallback
        }

        // Strategy 3: Yahoo Finance (.KS for KOSPI, .KQ for KOSDAQ)
        for (const suffix of ['.KS', '.KQ']) {
          try {
            const controller3 = new AbortController();
            const timer3 = setTimeout(() => controller3.abort(), 3500);
            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}${suffix}`;
            const yahooRes = await fetch(yahooUrl, {
              signal: controller3.signal,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            clearTimeout(timer3);
            if (yahooRes.ok) {
              const yahooData: any = await yahooRes.json().catch(() => null);
              const yahooPrice = yahooData?.chart?.result?.[0]?.meta?.regularMarketPrice;
              if (typeof yahooPrice === 'number' && yahooPrice > 0) {
                prices[ticker] = yahooPrice;
                return;
              }
            }
          } catch {
            // Ignore
          }
        }

        errors[ticker] = 'Price not found in available sources';
      } catch (err) {
        errors[ticker] = err instanceof Error ? err.message : String(err);
      }
    }));

    res.json({ prices, errors });
  });

  app.get('/api/stock-history/:ticker', async (req, res) => {
    const { ticker } = req.params;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const url = `https://api.finance.naver.com/item/siseDaily.naver?code=${ticker}&page=1&count=250`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch history' });
      }
      const data = await response.json().catch(() => null);
      if (!data) {
        return res.status(502).json({ error: 'Invalid response from upstream' });
      }
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

