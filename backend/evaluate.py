from ultralytics import YOLO
from roboflow import Roboflow
from dotenv import load_dotenv
import os
import sys

# Add current directory to path to allow importing from train.py if needed
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from train import merge_datasets

# Load environment variables
load_dotenv()

def evaluate():
    print("--- VisionChef Model Evaluation ---")
    
    # 1. Ensure Merged Dataset Exists
    api_key = os.getenv("ROBOFLOW_API_KEY")
    if not api_key:
        print("Error: ROBOFLOW_API_KEY not found in .env")
        return

    rf = Roboflow(api_key=api_key)
    
    print("\n1. Verifying datasets (Roboflow usage)...")
    # Same projects as train.py
    try:
        p1 = rf.workspace("samsung-capstone").project("food-in-fridge-2slx4-asarp")
        d1 = p1.version(1).download("yolov8")
        
        p2 = rf.workspace("samsung-capstone").project("food-ingredients-detection-6ce7j-arpob")
        d2 = p2.version(1).download("yolov8")
    except Exception as e:
        print(f"Error downloading datasets: {e}")
        return

    print("\n2. Ensuring merged dataset is ready...")
    # We use the function from train.py to ensure consistency
    data_yaml_path = merge_datasets([d1, d2], output_dir="merged_data")
    
    # 3. Load Model
    # Look for the trained model in likely locations
    possible_paths = [
        "runs/detect/train/weights/best.pt",
        "runs/weights/best.pt",
        "best.pt",
        "yolov8n.pt" # Fallback, but we warn
    ]
    
    model_path = None
    for p in possible_paths:
        if os.path.exists(p):
            model_path = p
            break
            
    if not model_path:
        print("Error: No model weights found in 'runs/' or current directory.")
        return
        
    print(f"\n3. Loading model from: {model_path}")
    if "yolov8n.pt" in model_path:
        print("WARNING: Using base YOLOv8n model. Results might not reflect custom training.")

    model = YOLO(model_path)

    # 4. Run Evaluation on Test Split
    print("\n4. Running evaluation on TEST split...")
    # We set split='test' to use the test set defined in data.yaml
    metrics = model.val(data=data_yaml_path, split='test')
    
    print("\n" + "="*40)
    print("       EVALUATION RESULTS (TEST SET)")
    print("="*40)
    print(f"mAP50-95 (Overall Performance): {metrics.box.map:.4f}")
    print(f"mAP50    (Strict Detection):    {metrics.box.map50:.4f}")
    print(f"Precision:                      {metrics.box.mp:.4f}")
    print(f"Recall:                         {metrics.box.mr:.4f}")
    print("="*40)
    print(f"Detailed results saved to: {metrics.save_dir}")

if __name__ == "__main__":
    evaluate()
