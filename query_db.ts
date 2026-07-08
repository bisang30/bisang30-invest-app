import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Read config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function dumpTrades() {
  console.log("Fetching users...");
  const usersSnapshot = await getDocs(collection(db, 'users'));
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    console.log(`User ID: ${userDoc.id}, Email: ${userData.email}`);
    
    // Fetch trades subcollection
    const tradesSnapshot = await getDocs(collection(db, 'users', userDoc.id, 'trades'));
    console.log(`Found ${tradesSnapshot.size} trades:`);
    const trades = [];
    for (const tradeDoc of tradesSnapshot.docs) {
      trades.push({ id: tradeDoc.id, ...tradeDoc.data() });
    }
    // Sort them by date
    trades.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const t of trades) {
      console.log(`  - Date: ${t.date}, StockId: ${t.stockId}, Type: ${t.tradeType}, Qty: ${t.quantity}, Price: ${t.price}, Method: ${t.tradeMethod}`);
    }

    // Also fetch stocks
    const stocksSnapshot = await getDocs(collection(db, 'users', userDoc.id, 'stocks'));
    console.log(`Found ${stocksSnapshot.size} stocks:`);
    for (const sDoc of stocksSnapshot.docs) {
      console.log(`  - ID: ${sDoc.id}, Name: ${sDoc.data().name}, Ticker: ${sDoc.data().ticker}`);
    }
  }
}

dumpTrades().catch(console.error);
