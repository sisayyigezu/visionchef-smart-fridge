# ------------------------------
# app.py
# ------------------------------

# 1️⃣ Load environment variables from .env
from dotenv import load_dotenv
import os

load_dotenv()  # loads .env file in backend folder


# 2️⃣ Import other modules
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil
import uuid
from services import YoloService, SpoonacularService

# 3️⃣ Initialize FastAPI
app = FastAPI(title="VisionChef API")

# 4️⃣ Allow CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development convenience
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5️⃣ Initialize services
yolo_service = YoloService()
spoonacular_service = SpoonacularService()

# 6️⃣ Ensure temporary uploads folder exists
os.makedirs("temp_uploads", exist_ok=True)

# 7️⃣ Root endpoint
@app.get("/")
def read_root():
    return {"message": "VisionChef API is running"}

# 8️⃣ Analyze fridge endpoint
@app.post("/analyze_fridge")
async def analyze_fridge(file: UploadFile = File(...)):
    # Save uploaded file
    file_extension = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = f"temp_uploads/{filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        print(f"Processing image: {filename}")
        
        # Detect Ingredients
        print("Running YOLO detection...")
        detection_result = yolo_service.detect(file_path)
        detected_ingredients = detection_result.get("ingredients", [])
        detections = detection_result.get("detections", [])
        
        print(f"Detected ingredients: {detected_ingredients}")
        
        # Fetch Recipes
        recipes = []
        if detected_ingredients:
            print("Fetching recipes from Spoonacular API...")
            recipes = spoonacular_service.find_recipes_by_ingredients(detected_ingredients)
            print(f"Retrieved {len(recipes)} recipes")
        else:
            print("No ingredients detected")
        
        response_data = {
            "detected_ingredients": detected_ingredients,
            "raw_detections": detections,  # Frontend can use this to draw boxes
            "recipes": recipes,
            "image_id": filename
        }
        
        print(f"Response: {len(detected_ingredients)} ingredients, {len(recipes)} recipes")
        return response_data
    
    except Exception as e:
        import traceback
        print(f"Error during analysis: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    
    finally:
        # Optional: Clean up file after processing,
        # but might want to keep it if we serve it back.
        # For now, let's keep it to verify.
        pass

# 9️⃣ Serve uploaded images if needed (though client has the original)
# app.mount("/files", StaticFiles(directory="temp_uploads"), name="files")

# 🔟 Run the app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)