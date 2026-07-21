import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Read config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function analyzeDC() {
  console.log("Fetching users...");
  const usersSnapshot = await getDocs(collection(db, 'users'));
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    console.log(`User ID: ${userDoc.id}, Email: ${userData.email}`);

    // Fetch accounts
    const accountsSnapshot = await getDocs(collection(db, 'users', userDoc.id, 'accounts'));
    console.log(`\n--- ACCOUNTS ---`);
    let dcAccount: any = null;
    for (const doc of accountsSnapshot.docs) {
      const acc = { id: doc.id, ...doc.data() as any };
      console.log(`Account ID: ${acc.id}, Name: ${acc.name}, Type: ${acc.accountType}, BrokerId: ${acc.brokerId}`);
      if (acc.name.includes("퇴직DC") || acc.name.includes("DC")) {
        dcAccount = acc;
      }
    }

    if (!dcAccount) {
      console.log("No DC account found for this user.");
      continue;
    }

    console.log(`\nAnalyzing DC Account: ${dcAccount.name} (${dcAccount.id})`);

    // Fetch stocks
    const stocksSnapshot = await getDocs(collection(db, 'users', userDoc.id, 'stocks'));
    const stockMap = new Map();
    for (const doc of stocksSnapshot.docs) {
      stockMap.set(doc.id, { id: doc.id, ...doc.data() as any });
    }

    // Fetch trades
    const tradesSnapshot = await getDocs(collection(db, 'users', userDoc.id, 'trades'));
    const trades = tradesSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(t => t.accountId === dcAccount.id);

    console.log(`\n--- TRADES for DC ACCOUNT (${trades.length}) ---`);
    let totalBuyCost = 0;
    let totalSellProceeds = 0;
    for (const t of trades) {
      const stock = stockMap.get(t.stockId);
      const stockName = stock ? stock.name : 'Unknown';
      const qty = Number(t.quantity) || 0;
      const price = Number(t.price) || 0;
      const val = qty * price;
      if (t.tradeType === 'BUY') {
        totalBuyCost += val;
      } else {
        totalSellProceeds += val;
      }
      console.log(`  Date: ${t.date}, Type: ${t.tradeType}, Stock: ${stockName}, Qty: ${qty}, Price: ${price}, Total: ${val}`);
    }

    // Fetch transactions
    const transactionsSnapshot = await getDocs(collection(db, 'users', userDoc.id, 'transactions'));
    const transactions = transactionsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }));

    console.log(`\n--- TRANSACTIONS for DC ACCOUNT ---`);
    let netCashFromTransactions = 0;
    let netDeposits = 0;
    for (const t of transactions) {
      const amount = Number(t.amount) || 0;
      const isRelated = t.accountId === dcAccount.id || t.counterpartyAccountId === dcAccount.id;
      if (!isRelated) continue;

      console.log(`  Date: ${t.date}, Type: ${t.transactionType}, Amount: ${amount}, AccId: ${t.accountId}, CounterParty: ${t.counterpartyAccountId}, Desc: ${t.description}`);

      if ((t.accountId === dcAccount.id && (t.transactionType === 'Deposit' || t.transactionType === 'Dividend')) || (t.counterpartyAccountId === dcAccount.id && t.transactionType === 'Withdrawal')) {
        netCashFromTransactions += amount;
        if (t.transactionType !== 'Dividend') netDeposits += amount;
      } else if ((t.accountId === dcAccount.id && t.transactionType === 'Withdrawal') || (t.counterpartyAccountId === dcAccount.id && t.transactionType === 'Deposit')) {
        netCashFromTransactions -= amount;
        netDeposits -= amount;
      }
    }

    // Historical gains
    const historicalGainsSnapshot = await getDocs(collection(db, 'users', userDoc.id, 'historicalGains'));
    let historicalPnlForAccount = 0;
    for (const doc of historicalGainsSnapshot.docs) {
      const hg = doc.data() as any;
      if (hg.accountId === dcAccount.id) {
        historicalPnlForAccount += Number(hg.realizedPnl) || 0;
        console.log(`  Historical PnL: ${hg.realizedPnl}, Date: ${hg.date}`);
      }
    }

    const cashBalance = netCashFromTransactions + totalSellProceeds - totalBuyCost + historicalPnlForAccount;
    console.log(`\n--- SUMMARY FOR ${dcAccount.name} ---`);
    console.log(`Net Cash from Transactions: ${netCashFromTransactions}`);
    console.log(`Net Deposits: ${netDeposits}`);
    console.log(`Total Buy Cost: ${totalBuyCost}`);
    console.log(`Total Sell Proceeds: ${totalSellProceeds}`);
    console.log(`Historical PnL: ${historicalPnlForAccount}`);
    console.log(`Calculated cashBalance (예수금): ${cashBalance}`);
  }
}

analyzeDC().catch(console.error);
