import requests
import json
import csv
import base64
import os
import logging
from time import sleep

# Configuration
API_URL = "http://localhost:7860"  # Stable Diffusion API endpoint
OUTPUT_DIR = "outputs"            # Directory to save generated images
INPUT_CSV = "inputs/trends.csv"   # Path to your Google Trends CSV

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('sd_generator.log'),
        logging.StreamHandler()
    ]
)

def create_directories():
    """Ensure output directory exists."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if not os.path.exists(INPUT_CSV):
        logging.error(f"Input CSV not found at {INPUT_CSV}")
        exit(1)

def generate_from_csv():
    """Generate images from CSV trends."""
    with open(INPUT_CSV, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                # Extract data from CSV (handle missing keys gracefully)
                trend = row.get('Trends', '').strip()
                search_volume = row.get('Search volume', '').strip()
                
                if not trend:
                    logging.warning(f"Skipping row with empty 'Trends': {row}")
                    continue

                # Construct the prompt
                prompt = (
                    f"Trending NFT artwork: {trend}, "
                    f"{search_volume} searches, "
                    "trending on social media, digital art, "
                    "vibrant colors, 8k detailed, ultra-realistic"
                )
                
                # API payload for Stable Diffusion
                payload = {
                    "prompt": prompt,
                    "negative_prompt": "blurry, low quality, text, watermark, deformed, ugly",
                    "steps": 20,
                    "width": 512,
                    "height": 512,
                    "cfg_scale": 7,
                    "sampler_name": "Euler a",
                    "batch_size": 1
                }
                
                logging.info(f"Generating image for: {trend}")
                
                # Call Stable Diffusion API
                response = requests.post(
                    f"{API_URL}/sdapi/v1/txt2img",
                    json=payload,
                    timeout=60
                )
                response.raise_for_status()  # Raise HTTP errors
                
                # Save the generated image
                save_image(response.json(), trend)
                sleep(2)  # Cooldown to avoid GPU overload
            
            except Exception as e:
                logging.error("Failed to process '{trend}': {str(e)}")
                continue

def save_image(response, keyword):
    """Save base64 image data to a file."""
    try:
        for i, img_data in enumerate(response.get('images', [])):
            # Clean the keyword for filename use
            safe_keyword = "".join(c if c.isalnum() else "_" for c in keyword)
            filename = f"{OUTPUT_DIR}/{safe_keyword}_{i}.png"
            
            # Decode and save the image
            with open(filename, "wb") as f:
                f.write(base64.b64decode(img_data.split(",", 1)[0]))
            
            logging.info(f"Saved: {filename}")
    except Exception as e:
        logging.error("Failed to save image for '{keyword}'")