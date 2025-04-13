import axios from 'axios';
import fs from 'fs';

const TREND_WEIGHT = 0.6;  // 60% weight to trend popularity
const SALES_WEIGHT = 0.4;  // 40% weight to recent sales

async function calculatePrice(keyword, searchVolume) {
  // 1. Get recent sales data
  const salesData = JSON.parse(fs.readFileSync('./data/sales.json'));
  const keywordSales = salesData.filter(item => item.keyword === keyword);
  
  // 2. Calculate sales velocity (last 7 days)
  const recentSales = keywordSales.filter(s => 
    new Date(s.date) > new Date(Date.now() - 7 * 86400000)
  );
  const salesVelocity = recentSales.length / 7; // Sales per day
  
  // 3. Normalize values (0-1 scale)
  const maxSearch = Math.max(...Object.values(searchVolumes));
  const maxSales = Math.max(1, ...salesData.map(s => s.count)); // Avoid division by zero
  
  const normSearch = searchVolume / maxSearch;
  const normSales = salesVelocity / maxSales;
  
  // 4. Calculate price ($10-$500 range)
  const basePrice = 10;
  const dynamicAdjustment = (normSearch * TREND_WEIGHT + normSales * SALES_WEIGHT) * 490;
  
  return Math.round(basePrice + dynamicAdjustment);
}

// Example usage
const price = await calculatePrice("AI Art", 150000);
console.log(`Recommended price: $${price}`);