import requests
import json
import csv

API_URL = "http://localhost:7860"

def generate_from_csv(csv_path):
    with open(csv_path) as f:
        for row in csv.DictReader(f):
            prompt = f"Trending NFT artwork: {row['Trends']}, {row['Search volume']} searches"
            payload = {
                "prompt": prompt,
                "steps": 28,
                "width": 768,
                "height": 768,
                "sampler_name": "Euler a"
            }
            response = requests.post(f"{API_URL}/sdapi/v1/txt2img", json=payload)
            save_image(response.json(), row['Trends'])

def save_image(response, keyword):
    for i, img_data in enumerate(response['images']):
        with open(f"outputs/{keyword}_{i}.png", "wb") as f:
            f.write(base64.b64decode(img_data.split(",",1)[0]))

generate_from_csv('inputs/trends.csv')