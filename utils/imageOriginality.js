// utils/imageOriginality.js
import TinEye from 'tineye-api';

const tineye = new TinEye({
  api_key: config.TINEYE_API_KEY,
  endpoint: 'https://api.tineye.com/rest/'
});

async function verifyOriginality(imagePath) {
  const results = await tineye.searchUrl(imagePath);
  return {
    isOriginal: results.matches.length === 0,
    matchDetails: results.matches
  };
}

// Usage in uploadNFTs.js
const { isOriginal } = await verifyOriginality(filePath);
if (!isOriginal) {
  fs.unlinkSync(filePath); // Delete problematic files
  throw new Error("Potential copyright infringement detected");
}