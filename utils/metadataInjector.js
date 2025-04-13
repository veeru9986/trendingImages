// utils/metadataInjector.js
import piexif from 'piexifjs';

function injectCopyrightMetadata(imageBuffer, prompt) {
  const zeroth = {};
  zeroth[piexif.ImageIFD.Artist] = "AI Art Generator";
  zeroth[piexif.ImageIFD.Copyright] = `CC BY-NC 4.0 - Generated from prompt: ${prompt}`;
  
  const exifObj = { "0th": zeroth };
  const exifBytes = piexif.dump(exifObj);
  return piexif.insert(exifBytes, imageBuffer.toString("binary"));
}

// Usage in generateImages.js
const imageWithMetadata = injectCopyrightMetadata(imageBuffer, prompt);