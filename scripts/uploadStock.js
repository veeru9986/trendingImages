import config from '../config.js';
import axios from 'axios';
import fs from 'fs-extra';
import FormData from 'form-data';
import csv from 'csv-parser';
import { calculatePrice } from '../api/pricingEngine.js';
import { verifyOriginality } from '../utils/imageOriginality.js';
import { recordCopyrightAction } from '../utils/copyrightLogger.js';

// Stock platform configurations
const PLATFORMS = {
  SHUTTERSTOCK: {
    uploadUrl: 'https://api.shutterstock.com/v2/images',
    headers: (token) => ({ 'Authorization': `Bearer ${token}` }),
    formFields: (data) => ({
      'title': data.title,
      'description': data.description,
      'categories[]': data.categories,
      'keywords': data.keywords.join(','),
      'price': data.price.toString(),
      'license': 'enhanced',
      'ai_generated': 'true'
    })
  },
  ADOBE_STOCK: {
    uploadUrl: 'https://stock.adobe.io/Rest/Media/1/Files',
    headers: (token) => ({ 
      'X-API-Key': token,
      'x-product': 'MyAIBot/1.0'
    }),
    formFields: (data) => ({
      'title': data.title,
      'keywords': data.keywords.join(';'),
      'has_releases': 'false',
      'content_type': 'image',
      'ai_generation': {
        'is_ai_generated': 'true',
        'ai_tool_name': 'TrendingArtBot',
        'model_version': 'v1.2'
      }
    })
  }
};

/**
 * Uploads image to stock platform with copyright checks
 * @param {string} platform - Platform key (SHUTTERSTOCK/ADOBE_STOCK)
 * @param {string} filePath - Path to image file
 * @param {object} trend - CSV row data
 */
async function uploadToStock(platform, filePath, trend) {
  try {
    const keyword = trend['Trends'];
    const searchVolume = parseInt(trend['Search volume'].replace(/\D/g, '')) || 0;

    // 1. Verify originality
    const { isOriginal } = await verifyOriginality(filePath);
    if (!isOriginal) {
      await recordCopyrightAction({
        type: 'STOCK_REJECTED',
        platform,
        keyword,
        reason: 'Potential copyright issue'
      });
      return;
    }

    // 2. Calculate dynamic price
    const price = await calculatePrice(keyword, searchVolume, 'stock');

    // 3. Prepare metadata
    const platformConfig = PLATFORMS[platform];
    const formData = new FormData();
    
    // Add image file
    formData.append('file', fs.createReadStream(filePath));

    // Add platform-specific fields
    const metadata = {
      title: `AI Art: ${keyword}`,
      description: `AI-generated artwork based on trending topic "${keyword}" (${searchVolume} monthly searches)`,
      keywords: [keyword, 'AI Art', 'Digital Art', 'Trending'],
      categories: ['Digital Art'],
      price
    };

    Object.entries(platformConfig.formFields(metadata)).forEach(([key, value]) => {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
    });

    // 4. Upload to platform
    const response = await axios.post(
      platformConfig.uploadUrl,
      formData,
      {
        headers: {
          ...platformConfig.headers(config[`${platform}_API_KEY`]),
          ...formData.getHeaders()
        },
        timeout: 30000
      }
    );

    // 5. Record success
    await recordCopyrightAction({
      type: 'STOCK_UPLOAD',
      platform,
      keyword,
      price,
      assetId: response.data.id,
      filePath
    });

    console.log(`✅ Uploaded ${keyword} to ${platform} ($${price})`);
    return response.data;
  } catch (error) {
    await recordCopyrightAction({
      type: 'STOCK_ERROR',
      platform,
      keyword: trend['Trends'],
      error: error.response?.data?.message || error.message
    });
    console.error(`❌ ${platform} upload failed:`, error.message);
  }
}

/**
 * Processes all trends from CSV
 */
async function processTrends() {
  const trends = [];

  fs.createReadStream('./inputs/trends.csv')
    .pipe(csv())
    .on('data', (data) => trends.push(data))
    .on('end', async () => {
      console.log(`Starting upload of ${trends.length} trends...`);

      for (const trend of trends) {
        const keyword = trend['Trends'];
        if (!keyword) continue;

        for (let i = 1; i <= 5; i++) {
          const filePath = `./outputs/${keyword.replace(/[^\w]/g, '_')}_v${i}.jpg`;
          
          if (await fs.pathExists(filePath)) {
            try {
              // Upload to all platforms in parallel
              await Promise.all([
                uploadToStock('SHUTTERSTOCK', filePath, trend),
                uploadToStock('ADOBE_STOCK', filePath, trend)
              ]);
            } catch (error) {
              console.error(`Skipping ${keyword} v${i} due to errors`);
            }
          }
        }
      }
    });
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  recordCopyrightAction({
    type: 'SYSTEM_ERROR',
    error: error.stack
  });
});

// Start processing
processTrends();