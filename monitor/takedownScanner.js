// monitor/takedownScanner.js
import axios from 'axios';

async function checkTakedowns(assetId, platform) {
  const endpoints = {
    SHUTTERSTOCK: `https://api.shutterstock.com/v2/images/${assetId}/takedowns`,
    OPENSEA: `https://api.opensea.io/api/v1/asset/${assetId}/takedowns`
  };

  const response = await axios.get(endpoints[platform], {
    headers: {'Authorization': `Bearer ${config[`${platform}_API_KEY`]}`}
    
  })
  return response.data.active_takedowns || [];
}

// Scheduled job (run daily)
setInterval(async () => {
  const assets = await db.getAssets(); // Your database query
  for (const asset of assets) {
    const takedowns = await checkTakedowns(asset.id, asset.platform);
    if (takedowns.length > 0) {
      await db.flagAsset(asset.id, 'COPYRIGHT_REVIEW');
    }
  }
}, 86400000); // 24 hours