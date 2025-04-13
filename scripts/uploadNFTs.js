import config from '../config.js';
import axios from 'axios';
import fs from 'fs-extra';
import FormData from 'form-data';
import csv from 'csv-parser';
import { calculatePrice } from '../api/pricingEngine.js';
import { verifyOriginality } from '../utils/imageOriginality.js';
import { recordCopyrightAction } from '../utils/copyrightLogger.js';

// Configure Axios for API calls
const api = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'TrendingArtBot/1.0'
  }
});

/**
 * Uploads file to IPFS with copyright checks
 * @param {string} filePath - Path to image file
 * @param {string} keyword - Original trend keyword
 * @returns {Promise<string>} IPFS hash
 */
async function uploadToIPFS(filePath, keyword) {
  try {
    // 1. Verify image originality
    const { isOriginal, matchDetails } = await verifyOriginality(filePath);
    if (!isOriginal) {
      await recordCopyrightAction({
        type: 'POTENTIAL_INFRINGEMENT',
        keyword,
        filePath,
        matches: matchDetails
      });
      throw new Error(`Copyright issue detected for ${keyword}`);
    }

    // 2. Prepare upload
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('pinataMetadata', JSON.stringify({
      name: `AI_Art_${keyword.replace(/[^a-z0-9]/gi, '_')}`,
      keyvalues: {
        license: config.copyright.license,
        generatedBy: config.copyright.artistName
      }
    }));

    // 3. Upload to IPFS
    const response = await api.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      form,
      {
        headers: {
          'Authorization': `Bearer ${config.PINATA_JWT}`,
          ...form.getHeaders()
        }
      }
    );

    return response.data.IpfsHash;
  } catch (error) {
    console.error(`IPFS upload failed for ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Mints NFT with copyright metadata
 * @param {string} ipfsHash 
 * @param {object} metadata 
 * @returns {Promise<object>} API response
 */
async function mintNFT(ipfsHash, metadata) {
  try {
    // Calculate dynamic price
    const price = await calculatePrice(metadata.keyword, metadata.searchVolume);
    
    // Prepare NFT data
    const nftData = {
      name: metadata.name,
      description: `${metadata.description}\n\nAI-Generated under ${config.copyright.license}`,
      image: `ipfs://${ipfsHash}`,
      external_url: "https://yourportfolio.com",
      attributes: [
        {
          trait_type: "Copyright Status",
          value: "AI-Generated"
        },
        {
          trait_type: "License",
          value: config.copyright.license
        }
      ]
    };

    // Mint on OpenSea
    const response = await api.post(
      `https://api.opensea.io/api/v2/collections/${config.OPENSEA_COLLECTION_SLUG}/nfts`,
      nftData,
      {
        headers: {
          'X-API-KEY': config.OPENSEA_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    // Record successful mint
    await recordCopyrightAction({
      type: 'MINTED_NFT',
      keyword: metadata.keyword,
      ipfsHash,
      price,
      platform: 'OpenSea'
    });

    return response.data;
  } catch (error) {
    await recordCopyrightAction({
      type: 'MINT_ERROR',
      keyword: metadata.keyword,
      error: error.message
    });
    throw error;
  }
}

/**
 * Main processing function
 */
async function processTrends() {
  const trends = [];

  // Read and process CSV
  fs.createReadStream('./inputs/trends.csv')
    .pipe(csv())
    .on('data', (data) => trends.push(data))
    .on('end', async () => {
      console.log(`Processing ${trends.length} trends...`);
      
      for (const row of trends) {
        const keyword = row['Trends'];
        const searchVolume = parseInt(row['Search volume'].replace(/\D/g, '')) || 0;

        if (!keyword) {
          await recordCopyrightAction({
            type: 'INVALID_ROW',
            rowData: JSON.stringify(row)
          });
          continue;
        }

        for (let i = 1; i <= 5; i++) {
          const filePath = `./outputs/${keyword.replace(/[^\w]/g, '_')}_v${i}.jpg`;
          
          if (await fs.pathExists(filePath)) {
            try {
              console.log(`⏳ Processing ${keyword} v${i}...`);
              
              // 1. Upload to IPFS with copyright checks
              const ipfsHash = await uploadToIPFS(filePath, keyword);
              
              // 2. Mint NFT
              await mintNFT(ipfsHash, {
                name: `${keyword} #${i}`,
                description: `AI-generated NFT based on trending topic: ${keyword}`,
                keyword,
                searchVolume
              });
              
              console.log(`✅ Successfully minted ${keyword} v${i}`);
            } catch (error) {
              console.error(`❌ Failed to process ${keyword} v${i}:`, error.message);
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
  process.exit(1);
});

// Start processing
processTrends();