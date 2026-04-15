import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/stock-prices', async (req, res) => {
    const { tickers } = req.body;
    if (!Array.isArray(tickers)) {
      return res.status(400).json({ error: 'tickers must be an array' });
    }

    const prices: Record<string, number> = {};
    const errors: Record<string, string> = {};

    // Fetch prices in parallel
    await Promise.all(tickers.map(async (ticker) => {
      try {
        // Try Naver Polling API first
        const naverUrl = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${ticker}`;
        const naverRes = await fetch(naverUrl);
        const naverData = await naverRes.json();
        const price = naverData?.result?.areas?.[0]?.datas?.[0]?.nv;
        
        if (typeof price === 'number') {
          prices[ticker] = price;
          return;
        }

        // Fallback to Yahoo Finance
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.KS`;
        const yahooRes = await fetch(yahooUrl);
        const yahooData = await yahooRes.json();
        const yahooPrice = yahooData?.chart?.result?.[0]?.meta?.regularMarketPrice;

        if (typeof yahooPrice === 'number') {
          prices[ticker] = yahooPrice;
          return;
        }

        errors[ticker] = 'Price not found in Naver or Yahoo APIs';
      } catch (err) {
        errors[ticker] = err instanceof Error ? err.message : String(err);
      }
    }));

    res.json({ prices, errors });
  });

  app.get('/api/stock-history/:ticker', async (req, res) => {
    const { ticker } = req.params;
    try {
      const url = `https://api.finance.naver.com/item/siseDaily.naver?code=${ticker}&page=1&count=250`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
