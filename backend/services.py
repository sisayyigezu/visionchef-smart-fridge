import os
import requests
from typing import List, Dict
from ultralytics import YOLO
from dotenv import load_dotenv


load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

SPOONACULAR_API_KEY = os.getenv("SPOONACULAR_API_KEY")
if not SPOONACULAR_API_KEY:
    print("Warning: SPOONACULAR_API_KEY not found in environment variables.")

class YoloService:
    def __init__(self):
        # specific logic to find the trained model if it exists
        # usually stored in runs/detect/train/weights/best.pt relative to where script is run
        # We will look for it, otherwise fall back to 'yolov8n.pt'
        possible_paths = [
            "runs/weights/best.pt",
            "../runs/weights/best.pt",
            "runs/detect/train/weights/best.pt",
            "../runs/detect/train/weights/best.pt",
            "yolov8n.pt"  # Fallback
        ]
        self.model_path = "yolov8n.pt"
        for path in possible_paths:
            if os.path.exists(path):
                self.model_path = path
                print(f"Loading custom model from: {path}")
                break
        
        if self.model_path == "yolov8n.pt":
             print("Custom model not found. Using generic YOLOv8n (expect poor results for specific fridge items until training is done).")

        self.model = YOLO(self.model_path)

    def detect(self, image_path: str) -> Dict:
        """
        Run inference on an image.
        Returns cleaned labels and detection details for visualization.
        """
        results = self.model(image_path)
        
        detected_items = []
        labels_raw = []

        # Process results
        for r in results:
            boxes = r.boxes
            for box in boxes:
                # get label name
                cls_id = int(box.cls[0])
                label = self.model.names[cls_id]
                
                # get coords (xyxy) - normalized or pixels? pixels is default
                xyxy = box.xyxy[0].tolist()
                
                detected_items.append({
                    "label": label,
                    "bbox": xyxy,
                    "confidence": float(box.conf[0])
                })
                labels_raw.append(label)
        
        unique_ingredients = self._clean_labels(labels_raw)
        
        return {
            "detections": detected_items,
            "ingredients": unique_ingredients
        }

    def _clean_labels(self, labels: List[str]) -> List[str]:
        """
        Clean up labels for the API:
        - Lowercase
        - Remove underscores
        - Remove dash suffixes (e.g., "Ash Gourd -Kubhindo-" -> "ash gourd")
        - Remove duplicates
        """
        import re
        cleaned = set()
        for label in labels:
            # normalization
            l = label.lower().strip()
            l = l.replace("_", " ")
            # Remove content after hyphen if it looks like a local name suffix
            # e.g. "ash gourd -kubhindo-"
            l = re.sub(r'\s*-.*$', '', l)
            cleaned.add(l)
        return list(cleaned)

class SpoonacularService:
    def __init__(self):
        self.base_url = "https://api.spoonacular.com"
        self.api_key = SPOONACULAR_API_KEY

    def find_recipes_by_ingredients(self, ingredients: List[str], number: int = 5) -> List[Dict]:
        if not ingredients:
            return []
            
        endpoint = f"{self.base_url}/recipes/findByIngredients"
        ingredients_str = ",".join(ingredients)
        
        params = {
            "apiKey": self.api_key,
            "ingredients": ingredients_str,
            "number": number,
            "ignorePantry": True,
            "ranking": 1  # maximize used ingredients
        }
        
        try:
            print(f"Fetching recipes for ingredients: {ingredients_str}")
            response = requests.get(endpoint, params=params, timeout=10)
            print(f"API Response Status: {response.status_code}")
            
            if response.status_code == 401:
                print("Error: Invalid API key or expired")
                return []
            elif response.status_code == 402:
                print("Error: API quota exceeded (payment required)")
                return []
            elif response.status_code == 403:
                print("Error: Access denied by API")
                return []
            
            response.raise_for_status()
            initial_recipes = response.json()
            
            print(f"Found {len(initial_recipes)} initial recipes")
            
            if not initial_recipes:
                print("No recipes found for the detected ingredients")
                return []
                
            # Fetch details for URLs
            recipe_ids = [str(r['id']) for r in initial_recipes]
            ids_str = ",".join(recipe_ids)
            
            bulk_endpoint = f"{self.base_url}/recipes/informationBulk"
            bulk_params = {
                "apiKey": self.api_key,
                "ids": ids_str
            }
            
            print(f"Fetching detailed information for {len(recipe_ids)} recipes")
            bulk_response = requests.get(bulk_endpoint, params=bulk_params, timeout=10)
            print(f"Bulk API Response Status: {bulk_response.status_code}")
            
            if bulk_response.status_code == 402:
                print("Warning: API quota exceeded on bulk request, returning basic recipe data")
                # Return initial recipes without detailed info
                return initial_recipes[:number]
            
            bulk_response.raise_for_status()
            details = bulk_response.json()
            
            # Map details by ID for easy lookup (though bulk usually returns in order, good to be safe)
            details_map = {d['id']: d for d in details}
            
            final_recipes = []
            for r in initial_recipes:
                d = details_map.get(r['id'])
                if d:
                    # Merge info. details has sourceUrl, instructions, etc.
                    # We keep the used/missed counts from the first call as bulk might not have them relative to my query
                    r['sourceUrl'] = d.get('sourceUrl')
                    r['readyInMinutes'] = d.get('readyInMinutes')
                    r['summary'] = d.get('summary')
                    final_recipes.append(r)
                else:
                    # If no details, still include the recipe with basic info
                    final_recipes.append(r)
            
            print(f"Successfully returned {len(final_recipes)} recipes")
            return final_recipes

        except requests.Timeout:
            print("Error: API request timed out")
            return []
        except requests.RequestException as e:
            print(f"Error calling Spoonacular API: {e}")
            return []
        except Exception as e:
            print(f"Unexpected error in find_recipes_by_ingredients: {e}")
            return []