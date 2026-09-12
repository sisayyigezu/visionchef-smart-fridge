from roboflow import Roboflow
from ultralytics import YOLO
from dotenv import load_dotenv
import os
import yaml
import shutil
from pathlib import Path

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

def merge_datasets(dataset_paths, output_dir="merged_dataset"):
    """
    Merges multiple YOLOv8 datasets into one.
    - dataset_paths: list of paths to downloaded datasets (objects with .location attribute)
    - output_dir: path to create the merged dataset
    """
    output_path = Path(output_dir)
    if output_path.exists():
        print(f"Removing existing {output_dir}...")
        shutil.rmtree(output_path)
    
    # Create structure
    for split in ['train', 'valid', 'test']:
        (output_path / split / 'images').mkdir(parents=True, exist_ok=True)
        (output_path / split / 'labels').mkdir(parents=True, exist_ok=True)

    # 1. Collect all class names
    all_classes = []
    dataset_info = []

    print("Analyzing datasets...")
    for ds in dataset_paths:
        yaml_path = Path(ds.location) / "data.yaml"
        with open(yaml_path, 'r') as f:
            data = yaml.safe_load(f)
        
        names = data.get('names', [])
        # 'names' can be a list or a dict {0: 'name'}
        if isinstance(names, dict):
            # Sort by key to ensure order if dict provided
            sorted_keys = sorted(names.keys())
            names = [names[k] for k in sorted_keys]
            
        dataset_info.append({
            'location': Path(ds.location),
            'names': names
        })
        
        # Add new classes to master list
        for name in names:
            if name not in all_classes:
                all_classes.append(name)
    
    print(f"Total unique classes found: {len(all_classes)}")
    
    # 2. Process Datasets
    for ds_idx, info in enumerate(dataset_info):
        src_root = info['location']
        src_names = info['names']
        
        # Map src_id -> dest_id
        id_map = {}
        for idx, name in enumerate(src_names):
            if name in all_classes:
                id_map[idx] = all_classes.index(name)
            else:
                # Should not happen as we just built all_classes
                print(f"Warning: Class {name} mismatch.")

        print(f"Processing dataset {ds_idx + 1}/{len(dataset_info)} from {src_root}...")
        
        for split in ['train', 'valid', 'test']:
            src_split_dir = src_root / split
            if not src_split_dir.exists():
                print(f"  Skipping split {split} (not found)")
                continue

            # Copy Images & Rewrite Labels
            # We assume structure: split/images/file.jpg and split/labels/file.txt
            src_images = list((src_split_dir / 'images').glob('*'))
            
            for img_path in src_images:
                # Copy Image
                # Prefix filename with ds_idx to avoid collisions (e.g. 0_image.jpg)
                new_filename = f"ds{ds_idx}_{img_path.name}"
                dest_img_path = output_path / split / 'images' / new_filename
                shutil.copy2(img_path, dest_img_path)
                
                # Process Label
                label_name = img_path.stem + ".txt"
                src_label_path = src_split_dir / 'labels' / label_name
                dest_label_path = output_path / split / 'labels' / f"ds{ds_idx}_{label_name}"
                
                if src_label_path.exists():
                    with open(src_label_path, 'r') as f:
                        lines = f.readlines()
                    
                    new_lines = []
                    for line in lines:
                        parts = line.strip().split()
                        if not parts: continue
                        
                        old_id = int(parts[0])
                        # Map ID
                        if old_id in id_map:
                            new_id = id_map[old_id]
                            new_lines.append(f"{new_id} {' '.join(parts[1:])}\n")
                    
                    with open(dest_label_path, 'w') as f:
                        f.writelines(new_lines)

    # 3. Create merged data.yaml
    merged_yaml = {
        'path': str(output_path.absolute()),
        'train': 'train/images',
        'val': 'valid/images',
        'test': 'test/images',
        'nc': len(all_classes),
        'names': all_classes
    }
    
    with open(output_path / "data.yaml", 'w') as f:
        yaml.dump(merged_yaml, f, sort_keys=False)
        
    print(f"Merged dataset created at {output_path}")
    return str(output_path / "data.yaml")


def train_model_local():
    """Train YOLO model on local Food-in-Fridge dataset."""
    print("\n" + "=" * 60)
    print("🎯 YOLO TRAINING - LOCAL DATASET")
    print("=" * 60)
    
    # Check for local dataset
    print("🔍 Checking for datasets...")
    dataset_path = None
    
    if os.path.exists("Food-in-Fridge-1/data.yaml"):
        dataset_path = "Food-in-Fridge-1/data.yaml"
        print("✓ Found dataset at: Food-in-Fridge-1/data.yaml")
    else:
        print("❌ Error: Food-in-Fridge-1 dataset not found!")
        raise FileNotFoundError("Food-in-Fridge-1/data.yaml not found")
    
    print(f"📊 Using dataset: {dataset_path}")
    print("=" * 60)
    
    # Load model
    print("📦 Loading YOLOv8 Medium model...")
    model = YOLO("yolov8m.pt")  # Medium model for better accuracy
    
    # Train the model
    print("🔥 Starting training...")
    print("   This may take several minutes on CPU...")
# Inside your train_model_local() function, replace the model.train() call
    results = model.train(
        data=dataset_path,
        epochs=150,           # Increased from 50
        imgsz=1280,           # Increased from 640 for better small object detection
        batch=16,             # Set explicitly - use largest value your GPU VRAM allows (e.g., -1 for auto on GPU)
        patience=30,          # Increased from 10
        device="cpu",           # Use GPU ("0" for first GPU, "cpu" for CPU)
        # --- Enable and configure augmentations ---
        augment=True,         # Enable built-in augmentations
        hsv_h=0.015,         # Randomly adjust image hue
        hsv_s=0.7,           # Randomly adjust image saturation
        hsv_v=0.4,           # Randomly adjust image value (brightness)
        degrees=10.0,        # Random image rotation (+/- degrees)
        translate=0.1,       # Random image translation (+/- fraction)
        scale=0.5,           # Random image scaling (+/- gain)
        shear=2.0,           # Random image shear (+/- degrees)
        # --- Tuning other hyperparameters ---
        lr0=0.01,            # Initial learning rate (SGD)
        lrf=0.01,            # Final learning rate factor = lr0 * lrf
        momentum=0.937,      # SGD momentum
        weight_decay=0.0005, # Optimizer weight decay
        warmup_epochs=3.0,   # Learning rate warmup epochs
        warmup_momentum=0.8, # Warmup initial momentum
        box=7.5,             # Box loss gain
        cls=0.5,             # Class loss gain
        dfl=1.5,             # Distribution Focal Loss gain
        project="runs/detect",
        name="train_enhanced",
        verbose=True
    )
    
    print("=" * 60)
    print("✅ Training Complete!")
    print(f"📁 Results saved to: {results.save_dir}")
    print(f"🏆 Best model: {results.save_dir}/weights/best.pt")
    print("=" * 60)
    print("\n✨ The app will automatically load this trained model on next restart!")


def train_model_roboflow():
    """Train YOLO model using Roboflow datasets."""
    api_key = os.getenv("ROBOFLOW_API_KEY")
    if not api_key:
        raise ValueError("ROBOFLOW_API_KEY not found in .env file")
        
    rf = Roboflow(api_key=api_key)
    
    print("Downloading Dataset 1 (Food in Fridge)...")
    p1 = rf.workspace("samsung-capstone").project("food-in-fridge-2slx4-asarp")
    d1 = p1.version(1).download("yolov8")
    
    print("Downloading Dataset 2 (Food Ingredients)...")
    p2 = rf.workspace("samsung-capstone").project("food-ingredients-detection-6ce7j-arpob")
    d2 = p2.version(1).download("yolov8")

    print("Merging datasets...")
    data_yaml_path = merge_datasets([d1, d2], output_dir="merged_data")

    print("Starting YOLOv8 training on merged dataset...")
    # Load a model
    model = YOLO("yolov8n.pt") 

    # Train
    results = model.train(data=data_yaml_path, epochs=20, imgsz=640)
    
    print("Training complete.")
    print(f"Best model weights should be saved in: {results.save_dir}/weights/best.pt")


def train_model():
    """Main training function - tries local first, then Roboflow."""
    # Try local dataset first
    if os.path.exists("Food-in-Fridge-1/data.yaml"):
        print("Found local dataset, using local training...")
        train_model_local()
    else:
        print("No local dataset found, using Roboflow...")
        train_model_roboflow()


if __name__ == "__main__":
    train_model()