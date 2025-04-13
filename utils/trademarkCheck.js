// generateImages.js
import { checkTrademark } from '../utils/trademarkCheck.js';
import { injectCopyrightMetadata } from '../utils/metadataInjector.js';

async function processTrend(row) {
  // 1. Trademark check
  const { isSafe, matches } = await checkTrademark(row['Trends']);
  if (!isSafe) {
    fs.appendFileSync('./data/copyright_logs/trademark_blocks.log', 
      `${new Date().toISOString()}|${row['Trends']}|${JSON.stringify(matches)}\n`);
    return; // Exit instead of continue
  }

  // 2. Image generation
  for (let i = 1; i <= 5; i++) {
    try {
      const prompt = `NFT artwork: ${row['Trends']}, ${row['Search volume']} searches`;
      const response = await openai.images.generate({ prompt });
      
      // 3. Add copyright metadata
      const imageBuffer = await axios.get(response.data[0].url, { 
        responseType: 'arraybuffer' 
      });
      const protectedImage = injectCopyrightMetadata(imageBuffer.data, prompt);
      
      await fs.writeFile(
        `./outputs/${row['Trends'].replace(/[^\w]/g, '_')}_v${i}.jpg`,
        protectedImage
      );
    } catch (error) {
      console.error(`Error processing ${row['Trends']} v${i}:`, error.message);
    }
  }
}

// Main execution
fs.createReadStream('./inputs/trends.csv')
  .pipe(csv())
  .on('data', async (row) => {
    await processTrend(row); // Handles each row
  })
  .on('end', () => console.log('Processing complete'));