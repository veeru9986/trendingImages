import config from '../config.js';
import axios from 'axios';
import fs from 'fs-extra';
import csv from 'csv-parser';

// Clean and parse search volume (handles "120,000" -> 120000)
function parseSearchVolume(volumeStr) {
  return parseInt(volumeStr?.toString().replace(/\D/g, '') || '0');
}

async function generateDalleImages() {
  const results = [];
  
  // Read CSV with specific column names
  fs.createReadStream('./inputs/trends.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`Generating images for ${results.length} trends...`);
      
      for (const row of results) {
        const keyword = row['Trends']; // Get from "Trends" column
        const searchVolume = parseSearchVolume(row['Search volume']); // Clean numeric value
        
        if (!keyword) continue; // Skip empty rows

        const prompt = `Ultra-detailed NFT artwork about "${keyword}". 
                       Trending on social media, search volume: ${searchVolume}, 
                       vibrant colors, 8K resolution, digital art`;

        for (let i = 1; i <= 5; i++) {
          try {
            console.log(`Generating ${keyword} v${i}...`);
            
            const response = await axios.post(
              'https://api.openai.com/v1/images/generations',
              {
                prompt,
                n: 1,
                size: "1024x1024",
                quality: "hd"
              },
              {
                headers: {
                  'Authorization': `Bearer ${config.OPENAI_KEY}`,
                  'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
              }
            );

            const imageUrl = response.data.data[0].url;
            const safeKeyword = keyword.replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
            const imagePath = `./outputs/${safeKeyword}_v${i}.jpg`;
            
            // Download and save image
            const imageResponse = await axios.get(imageUrl, { 
              responseType: 'arraybuffer',
              timeout: 30000
            });
            
            await fs.writeFile(imagePath, imageResponse.data);
            console.log(`Saved: ${imagePath}`);

          } catch (error) {
            console.error(`Error generating ${keyword} v${i}:`, 
              error.response?.data?.error?.message || error.message);
            
            // Wait before retrying
            if (i < 5) await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }
      console.log('Image generation complete!');
    });
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

generateDalleImages();