const trades = [
  { type: 'SELL', date: '2025-11-26', qty: 1, price: 503000, fee: 1024 },
  { type: 'BUY',  date: '2026-05-15', qty: 19, price: 1795000, fee: 1228 },
  { type: 'BUY',  date: '2026-06-08', qty: 1, price: 1956000, fee: 70 },
  { type: 'SELL', date: '2026-06-19', qty: 6, price: 2781000, fee: 33973 },
  { type: 'BUY',  date: '2026-06-19', qty: 6, price: 2690000, fee: 581 },
  { type: 'BUY',  date: '2026-06-23', qty: 4, price: 2620000, fee: 377 },
  { type: 'BUY',  date: '2026-07-02', qty: 2, price: 2271000, fee: 164 },
  { type: 'BUY',  date: '2026-07-07', qty: 6, price: 2130000, fee: 460 },
];

function run(sellFirstOnSameDay) {
  // Sort trades by date. For same date, sort buy/sell based on sellFirstOnSameDay
  const sorted = [...trades].sort((a, b) => {
    const d1 = new Date(a.date).getTime();
    const d2 = new Date(b.date).getTime();
    if (d1 !== d2) return d1 - d2;
    if (a.type !== b.type) {
      if (sellFirstOnSameDay) {
        return a.type === 'SELL' ? -1 : 1;
      } else {
        return a.type === 'BUY' ? -1 : 1;
      }
    }
    return 0;
  });

  let qty = 0;
  let totalCost = 0;
  for (const t of sorted) {
    if (t.date === '2025-11-26') continue; // Let's ignore historical or include? Let's check both
    if (t.type === 'BUY') {
      qty += t.qty;
      totalCost += t.qty * t.price;
    } else {
      const avg = qty > 0 ? totalCost / qty : 0;
      qty -= t.qty;
      totalCost -= t.qty * avg;
    }
    console.log(`[sellFirst=${sellFirstOnSameDay}] Date: ${t.date}, Type: ${t.type}, Qty: ${qty}, Cost: ${totalCost}, Avg: ${qty > 0 ? totalCost / qty : 0}`);
  }
}

console.log("=== SELL FIRST ON SAME DAY (IGNORE 2025-11-26) ===");
run(true);
console.log("\n=== BUY FIRST ON SAME DAY (IGNORE 2025-11-26) ===");
run(false);
