import { exec } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import csv from 'csv-parser';
import crypto from 'node:crypto';
import { ExifTool } from 'exiftool-vendored';

const exiftool = new ExifTool();
const COPYRIGHT_LOG = '../data/copyright_logs.csv';

// Initialize copyright log file
async function initLog() {
  try {
    await fs.access(COPYRIGHT_LOG);
  } catch {
    await fs.writeFile(COPYRIGHT_LOG, 'timestamp,keyword,imagePath,prompt,license,hash\n');
  }
}

// Add copyright metadata to image
async function addCopyrightMetadata(imagePath, prompt, keyword) {
  try {
    await exiftool.write(imagePath, {
      Copyright: `CC BY-NC 4.0 - ${new Date().getFullYear()}`,
      Artist: "YourAIStudio",
      ImageDescription: `AI-generated artwork based on trend: ${keyword}`,
      UserComment: `Prompt: ${prompt.substring(0, 200)}`,
      CopyrightNotice: "This AI-generated artwork is licensed under Creative Commons Attribution-NonCommercial 4.0",
      UsageTerms: "For non-commercial use only"
    });
  } catch (error) {
    console.error(`Metadata failed for ${imagePath}:`, error.message);
  }
}

// Generate file checksum
async function generateFileHash(imagePath) {
  try {
    const buffer = await fs.readFile(imagePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch (error) {
    console.error(`Hashing failed for ${imagePath}:`, error.message);
    return null;
  }
}

// Log generation details
async function logGeneration(keyword, imagePath, prompt, hash) {
  const timestamp = new Date().toISOString();
  await fs.appendFile(COPYRIGHT_LOG, 
    `${timestamp},"${keyword}","${imagePath}","${prompt.replace(/"/g, '""')}","CC BY-NC 4.0","${hash}"\n`
  );
}

// Generate image with watermark
async function generateImage(prompt, outputPath, keyword) {
  const payload = {
    prompt: `${prompt} | watermark:©${new Date().getFullYear()} YourBrand`,
    negative_prompt: "blurry, low quality, text, watermark",
    steps: 25,
    width: 512,
    height: 512,
    sampler_name: "DPM++ 2M Karras",
    cfg_scale: 7,
    seed: -1,
    alwayson_scripts: {
      "Tiled Diffusion": {
        args: [true, "MultiDiffusion", 96, 96, 4, 0.2]
      },
      "Additional Networks": {
        args: [{
          modules: ["watermark"],
          args: ["©", 36, 0.3, "bottom-right"]
        }]
      }
    }
  };

  const command = `curl -X POST http://localhost:7860/sdapi/v1/txt2img \
    -H "Content-Type: application/json" \
    -d '${JSON.stringify(payload).replace(/'/g, "'\\''")}' \
    --output ${outputPath}`;

  return new Promise((resolve, reject) => {
    exec(command, async (error) => {
      if (error) return reject(error);
      
      try {
        await addCopyrightMetadata(outputPath, prompt, keyword);
        const hash = await generateFileHash(outputPath);
        await logGeneration(keyword, outputPath, prompt, hash);
        resolve(outputPath);
      } catch (metadataError) {
        reject(metadataError);
      }
    });
  });
}

// Style variations
function getStyle(iter) {
  const styles = [
    "cyberpunk neon style",
    "oil painting texture",
    "low poly 3D render",
    "watercolor art",
    "anime cel-shaded"
  ];
  return styles[(iter - 1) % styles.length];
}

// Main execution
(async () => {
  await initLog();
  
  createReadStream('../inputs/trends.csv')
    .pipe(csv())
    .on('data', async (row) => {
      const keyword = row['Trends'];
      if (!keyword) return;

      const searchVolume = row['Search volume'] || "N/A";
      
      for (let i = 1; i <= 5; i++) {
        const prompt = `NFT artwork: "${keyword}" (${searchVolume} searches), ${getStyle(i)}`;
        const outputPath = `../images/${keyword.replace(/[^\w]/g, '_')}_v${i}.png`;
        
        try {
          await generateImage(prompt, outputPath, keyword);
          console.log(`✅ Generated protected: ${outputPath}`);
        } catch (error) {
          console.error(`❌ Failed ${keyword} v${i}:`, error.message);
          await fs.appendFile(COPYRIGHT_LOG, 
            `${new Date().toISOString()},"${keyword}","FAILED","${prompt.replace(/"/g, '""')}","ERROR","${error.message}"\n`
          );
        }
      }
    })
    .on('end', () => exiftool.end());
})();