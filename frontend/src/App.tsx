import React from 'react';
import './App.css';
import { useState, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Clock, Sparkles, FolderOpen } from 'lucide-react';
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Interfaces
interface BBox {
  label: string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
}

interface Recipe {
  id: number;
  title: string;
  image: string;
  usedIngredientCount: number;
  missedIngredientCount: number;
  usedIngredients: { name: string }[];
  missedIngredients: { name: string }[];
  sourceUrl?: string;
  readyInMinutes?: number;
  summary?: string;
}

interface AnalysisResult {
  detected_ingredients: string[];
  raw_detections: BBox[];
  recipes: Recipe[];
  image_id: string;
}

function App() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragActivePreview, setIsDragActivePreview] = useState(false);
  
  // Dark mode state 
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Toggle dark mode class on html element
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };
  
  // For overlay scaling
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAnalysisResult(null);
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      alert('Please drop an image file');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      processFile(event.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      // Check if we're actually leaving the element
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (
        e.clientX <= rect.left ||
        e.clientX >= rect.right ||
        e.clientY <= rect.top ||
        e.clientY >= rect.bottom
      ) {
        setIsDragActive(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragPreview = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActivePreview(true);
    } else if (e.type === "dragleave") {
      // Check if we're actually leaving the element
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (
        e.clientX <= rect.left ||
        e.clientX >= rect.right ||
        e.clientY <= rect.top ||
        e.clientY >= rect.bottom
      ) {
        setIsDragActivePreview(false);
      }
    }
  };

  const handleDropPreview = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActivePreview(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', selectedImage);

    try {
      // Assuming backend is on port 8000
      const response = await axios.post(`${API_BASE_URL}/analyze_fridge`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setAnalysisResult(response.data);
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to analyze image. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  // Sort recipes: least missing ingredients first
  const sortedRecipes = analysisResult?.recipes 
    ? [...analysisResult.recipes].sort((a, b) => a.missedIngredientCount - b.missedIngredientCount)
    : [];

  return (
    <div className={`min-h-screen transition-colors duration-500 font-sans ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-[#f8f9fa] text-black'}`}>
      
      {/* One UI Header: Compact */}
      <header className="px-6 py-4 sticky top-0 z-40 bg-opacity-95 backdrop-blur-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            
            <div>
                <h1 className="text-2xl md:text-3xl font-light tracking-tight">
                    Vision<span className="font-bold text-[#0381fe]">Chef</span>
                </h1>
                {/* <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Smart Fridge Assistant</p> */} 
            </div>

            <button 
                onClick={toggleDarkMode}
                className={`p-2 px-4 rounded-full transition-all duration-500 transform active:scale-95 shadow-sm flex items-center gap-2 text-sm font-medium ${isDarkMode ? 'bg-[#252525] text-yellow-400' : 'bg-white text-slate-600'}`}
            >
                    {isDarkMode ? <Sparkles className="w-4 h-4" /> : <Clock className="w-4 h-4 rotate-180" />}
                    <span>{isDarkMode ? 'Dark' : 'Light'}</span>
            </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
        
        {/* Left Column: Upload */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className={`p-1 rounded-[2.5rem] overflow-hidden transition-all duration-500 ${isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white shadow-lg hover:shadow-xl'}`}
          >
             {/* Content Container */}
             <div className="p-6 flex flex-col items-center">
                 {!previewUrl ? (
                    <label 
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className={`w-full aspect-[4/5] rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                        isDragActive
                        ? isDarkMode 
                          ? 'border-[#0381fe] bg-[#0381fe]/10 scale-105' 
                          : 'border-[#0381fe] bg-blue-50 scale-105'
                        : isDarkMode 
                          ? 'border-gray-700 hover:border-[#0381fe] bg-[#252525]' 
                          : 'border-gray-200 hover:border-[#0381fe] bg-gray-50'
                    }`}
                    >
                        <div className={`p-6 rounded-3xl mb-4 transition-all duration-200 ${
                          isDragActive
                          ? isDarkMode
                            ? 'bg-[#0381fe]/30 text-[#0381fe] scale-110'
                            : 'bg-blue-100 text-[#0381fe] scale-110'
                          : isDarkMode 
                            ? 'bg-[#0381fe]/20 text-[#0381fe]' 
                            : 'bg-blue-50 text-[#0381fe]'
                        }`}>
                            <Upload className="w-8 h-8" />
                        </div>
                        <span className={`text-lg font-medium mb-1 transition-colors ${isDragActive ? 'text-[#0381fe]' : ''}`}>
                          {isDragActive ? 'Drop your image here!' : 'Upload Photo'}
                        </span>
                        <span className="text-sm text-gray-400">Tap to select or drag and drop</span>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                    </label>
                 ) : (
                    <>
                    <div 
                      className="relative w-full rounded-[2rem] overflow-hidden shadow-sm transition-all duration-200"
                      onDragEnter={handleDragPreview}
                      onDragLeave={handleDragPreview}
                      onDragOver={handleDragPreview}
                      onDrop={handleDropPreview}
                      style={{
                        backgroundColor: isDragActivePreview ? 'rgba(3, 129, 254, 0.1)' : 'transparent',
                        transform: isDragActivePreview ? 'scale(1.02)' : 'scale(1)',
                      }}
                    >
                        <img 
                            src={previewUrl} 
                            ref={imgRef}
                            alt="Preview" 
                          
                            className="w-full h-auto object-cover"
                        />
                        {/* Drag Overlay - Show when dragging */}
                        {isDragActivePreview && (
                          <div className="absolute inset-0 bg-[#0381fe]/20 backdrop-blur-sm flex items-center justify-center z-20">
                            <div className="bg-black/70 backdrop-blur-md rounded-2xl px-6 py-4 flex flex-col items-center gap-2">
                              <Upload className="w-8 h-8 text-[#0381fe]" />
                              <span className="text-white font-semibold">Drop to replace image</span>
                            </div>
                          </div>
                        )}
                        {/* Overlay Bounding Boxes */}
                         {analysisResult && analysisResult.raw_detections.map((det, idx) => {
                            const natW = imgRef.current?.naturalWidth || 1;
                            const natH = imgRef.current?.naturalHeight || 1;
                            const [x1, y1, x2, y2] = det.bbox;
                            return (
                                <motion.div 
                                    key={idx}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="absolute border-[3px] border-[#0381fe] rounded-xl z-10"
                                    style={{
                                        left: `${(x1 / natW) * 100}%`,
                                        top: `${(y1 / natH) * 100}%`,
                                        width: `${((x2 - x1) / natW) * 100}%`,
                                        height: `${((y2 - y1) / natH) * 100}%`,
                                    }}
                                >
                                    <span className="absolute -top-8 left-0 text-white bg-[#0381fe] text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-md">
                                        {det.label}
                                    </span>
                                </motion.div>
                            );
                         })}
                    </div>

                    {/* Change Image Button - Below Image */}
                    <label className="w-12 h-12 mt-3 bg-gray-400/40 backdrop-blur-md text-white rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-all duration-500 hover:bg-gray-400/60">
                        <Upload className="w-5 h-5" />
                        <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                    </label>
                    </>
                 )}

                {/* Detected Items List - Moved Inside Card */}
                <AnimatePresence>
                    {analysisResult && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="w-full mt-4"
                        >
                            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Detected Ingredients</h3>
                            <div className="flex flex-wrap gap-2">
                                {analysisResult.detected_ingredients.map((ing, i) => (
                                    <motion.span 
                                        key={i}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: i * 0.03 }}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                            isDarkMode 
                                            ? 'bg-[#252525] text-blue-300' 
                                            : 'bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#0381fe]"></div>
                                        {ing}
                                    </motion.span>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                 {/* Action Button */}
                 <button 
                  onClick={handleUpload} 
                  disabled={!selectedImage || loading}
                  type="button"
                  className={`mt-6 w-full py-6 px-6 rounded-[2rem] text-lg font-bold shadow-lg transition-all duration-500 flex items-center justify-center gap-3 outline-none focus:outline-none ${
                    !selectedImage || loading 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500 opacity-60' 
                    : 'bg-[#0381fe] text-white hover:bg-[#026bd6] active:scale-95 hover:shadow-xl hover:shadow-blue-500/40 dark:hover:shadow-blue-500/30 focus:ring-4 focus:ring-blue-400/50 dark:focus:ring-blue-500/40 cursor-pointer'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                       <Sparkles className="w-5 h-5 fill-current flex-shrink-0" />
                       <span>Find Recipes</span>
                    </>
                  )}
                </button>
             </div>
          </motion.div>

        </div>

        {/* Right Column: Recipe Feed */}
        <div className="lg:col-span-7">
           <div className={`p-1 mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>
               <h2 className="text-2xl font-bold flex items-center gap-2">
                   Recipes <span className="text-[#0381fe] text-sm font-bold bg-[#0381fe]/10 px-2 py-1 rounded-lg">{sortedRecipes.length}</span>
               </h2>
           </div>

           {!analysisResult && !loading && (
              <div className={`flex flex-col items-center justify-center h-80 rounded-[2.5rem] ${isDarkMode ? 'bg-[#1e1e1e]' : 'bg-gray-100'}`}>
                <FolderOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-400 dark:text-gray-500 font-medium">Scan your fridge to see recipes</p>
              </div>
           )}

           {loading && (
             <div className="space-y-4">
               {[1, 2, 3].map(i => (
                  <div key={i} className={`h-40 w-full rounded-[2rem] animate-pulse ${isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white shadow-lg'}`}></div>
               ))}
             </div>
           )}

           <div className="space-y-5">
             {sortedRecipes.map((recipe, idx) => (
               <motion.div 
                 key={recipe.id}
                 initial={{ opacity: 0, y: 30 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 0.1 * idx }}
                 onClick={() => setSelectedRecipe(recipe)}
                 className={`relative p-4 flex gap-5 rounded-[2rem] transition-all duration-500 cursor-pointer active:scale-95 ${
                    isDarkMode 
                    ? 'bg-[#1e1e1e] active:bg-[#252525]' 
                    : 'bg-white shadow-lg hover:shadow-2xl active:bg-gray-50'
                 }`}
               >
                  <div className="w-32 h-32 rounded-[1.5rem] overflow-hidden flex-shrink-0 bg-gray-200">
                     <img src={recipe.image} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  
                  <div className="flex-1 py-1 flex flex-col justify-center">
                      <h3 className="text-lg font-bold leading-tight line-clamp-2 mb-2">{recipe.title}</h3>
                      
                      <div className="flex items-center gap-3 text-xs font-semibold mb-3">
                        <span className={`px-2 py-1 rounded-lg ${isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
                            {recipe.usedIngredientCount} Used
                        </span>
                        {recipe.missedIngredientCount > 0 && (
                            <span className={`px-2 py-1 rounded-lg ${isDarkMode ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700'}`}>
                                {recipe.missedIngredientCount} Missing
                            </span>
                        )}
                      </div>
                      
                      {recipe.readyInMinutes && (
                         <div className="flex items-center gap-1.5 text-xs text-gray-400">
                             <Clock className="w-3 h-3" />
                             <span>{recipe.readyInMinutes} min</span>
                         </div>
                      )}
                  </div>
               </motion.div>
             ))}
           </div>
        </div>

      </main>

      {/* Samsung Bottom Sheet / Modal */}
      <AnimatePresence>
        {selectedRecipe && (
            <>
                {/* Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedRecipe(null)}
                    className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-center justify-center p-6"
                >
                    {/* Centered Modal Card */}
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className={`relative w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col rounded-[2.5rem] shadow-2xl ${
                            isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white'
                        }`}
                    >
                        {/* Scrollable Content Container */}
                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            <div className="relative h-64 shrink-0">
                                <img src={selectedRecipe.image} className="w-full h-full object-cover" />
                                <div className={`absolute inset-0 bg-gradient-to-t ${isDarkMode ? 'from-[#1e1e1e]' : 'from-white'} to-transparent opacity-90 h-full`}></div>
                                
                                <button 
                                    onClick={() => setSelectedRecipe(null)}
                                    className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors duration-500"
                                >
                                    <X className="w-6 h-6" />
                                </button>

                                <div className="absolute bottom-6 left-8 right-8">
                                    <h2 className="text-3xl font-bold mb-2 leading-tight">{selectedRecipe.title}</h2>
                                    {selectedRecipe.readyInMinutes && (
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${isDarkMode ? 'bg-[#252525] text-white' : 'bg-white text-black shadow-sm'}`}>
                                            <Clock className="w-3 h-3" /> {selectedRecipe.readyInMinutes}m Cook Time
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="px-8 pb-8">
                                {selectedRecipe.summary && (
                                    <div className={`p-6 rounded-[2rem] text-sm leading-relaxed mb-6 ${isDarkMode ? 'bg-[#252525] text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
                                        <h3 className="font-bold mb-2 text-[#0381fe] uppercase text-xs tracking-wider">Description</h3>
                                        <div dangerouslySetInnerHTML={{ __html: selectedRecipe.summary }} />
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className={`p-5 rounded-[2rem] ${isDarkMode ? 'bg-[#2c2c2c]' : 'bg-green-50'}`}>
                                        <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>You Have</h3>
                                        <ul className="space-y-3">
                                            {selectedRecipe.usedIngredients.map((ing, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm font-medium">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"></div>
                                                    {ing.name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className={`p-5 rounded-[2rem] ${isDarkMode ? 'bg-[#2c2c2c]' : 'bg-orange-50'}`}>
                                        <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-orange-400' : 'text-orange-700'}`}>You Need</h3>
                                        <ul className="space-y-3">
                                            {selectedRecipe.missedIngredients.map((ing, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0"></div>
                                                    {ing.name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                {selectedRecipe.sourceUrl && (
                                    <a 
                                        href={selectedRecipe.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full block py-4 bg-[#0381fe] text-white text-center font-bold text-lg rounded-[2rem] shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all duration-500"
                                    >
                                        View Full Instructions
                                    </a>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App