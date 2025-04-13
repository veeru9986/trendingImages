import express from 'express';
import fs from 'fs';

const app = express();
app.use(express.json());

// Endpoint to record sales
app.post('/api/sales', (req, res) => {
  const { keyword, price, platform } = req.body;
  
  const newSale = {
    date: new Date().toISOString(),
    keyword,
    price,
    platform
  };
  
  // Append to sales.json
  const salesData = JSON.parse(fs.readFileSync('./data/sales.json'));
  salesData.push(newSale);
  fs.writeFileSync('./data/sales.json', JSON.stringify(salesData, null, 2));
  
  res.status(200).send('Sale recorded');
});

// Generate daily report
app.get('/api/report', (req, res) => {
  const salesData = JSON.parse(fs.readFileSync('./data/sales.json'));
  
  // Group by keyword
  const report = salesData.reduce((acc, sale) => {
    if (!acc[sale.keyword]) acc[sale.keyword] = { total: 0, count: 0 };
    acc[sale.keyword].total += sale.price;
    acc[sale.keyword].count++;
    return acc;
  }, {});
  
  res.json(report);
});

app.listen(3000, () => console.log('Sales API running'));