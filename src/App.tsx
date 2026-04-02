/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Upload, 
  Image as ImageIcon, 
  Loader2, 
  Sparkles, 
  X, 
  MessageSquare, 
  RotateCw, 
  Crop, 
  Check, 
  Settings2,
  Type,
  Layout,
  Smile,
  Zap,
  Download,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import Cropper, { Area } from 'react-easy-crop';

interface FilterState {
  brightness: number;
  contrast: number;
  grayscale: number;
  sepia: number;
}

const ANALYSIS_PROMPTS = [
  { id: 'general', label: 'General Analysis', icon: <Layout className="w-4 h-4" />, prompt: "Analyze this image in detail. Describe the scene, people, and objects. Provide the response in Bengali as well." },
  { id: 'mood', label: 'Describe Mood', icon: <Smile className="w-4 h-4" />, prompt: "What is the overall mood and atmosphere of this image? Describe the emotions it conveys. Provide the response in Bengali as well." },
  { id: 'objects', label: 'Identify Objects', icon: <ImageIcon className="w-4 h-4" />, prompt: "List and describe all major objects found in this image. Provide the response in Bengali as well." },
  { id: 'text', label: 'Extract Text', icon: <Type className="w-4 h-4" />, prompt: "Identify and extract any text visible in this image. If there is no text, say so. Provide the response in Bengali as well." },
];

const POSES = [
  { id: 'standing', label: 'Standing Confidently', prompt: "standing confidently, full body view" },
  { id: 'sitting', label: 'Sitting Elegantly', prompt: "sitting elegantly on a premium chair" },
  { id: 'side', label: 'Side Profile', prompt: "side profile view, looking slightly away" },
  { id: 'walking', label: 'Walking Naturally', prompt: "walking naturally in an elegant hallway" },
  { id: 'portrait', label: 'Close-up Portrait', prompt: "close-up portrait with a soft blurred background" },
];

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(ANALYSIS_PROMPTS[0]);
  const [selectedPose, setSelectedPose] = useState(POSES[0]);
  const [activeTab, setActiveTab] = useState<'analyze' | 'generate'>('analyze');

  // Editing State
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    brightness: 100,
    contrast: 100,
    grayscale: 0,
    sepia: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImage(reader.result as string);
        setProcessedImage(reader.result as string);
        setAnalysis('');
        setGeneratedImage(null);
        setError(null);
        setIsEditing(false);
        setRotation(0);
        setFilters({ brightness: 100, contrast: 100, grayscale: 0, sepia: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getProcessedImage = async () => {
    if (!originalImage || !croppedAreaPixels) return originalImage;

    const image = await createImage(originalImage);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return originalImage;

    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;

    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%)`;

    const rotateRad = (rotation * Math.PI) / 180;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rotateRad);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    return canvas.toDataURL('image/jpeg');
  };

  const applyEdits = async () => {
    try {
      const result = await getProcessedImage();
      setProcessedImage(result);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      setError("Failed to process image edits.");
    }
  };

  const analyzeImage = async () => {
    if (!processedImage) return;
    setLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const base64Data = processedImage.split(',')[1];
      const mimeType = processedImage.split(';')[0].split(':')[1];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          parts: [
            { text: selectedPrompt.prompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }]
      });
      setAnalysis(response.text || 'No analysis generated.');
    } catch (err) {
      console.error(err);
      setError('Failed to analyze image.');
    } finally {
      setLoading(false);
    }
  };

  const generateVariation = async () => {
    if (!processedImage) return;
    setGenerating(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const base64Data = processedImage.split(',')[1];
      const mimeType = processedImage.split(';')[0].split(':')[1];

      const prompt = `Generate a high-quality variation of the person in this image. 
      STRICT REQUIREMENT: Keep the EXACT SAME model (face, features) and the EXACT SAME Islamic clothing (Borka/Panjabi/Topi). 
      The person should be in a ${selectedPose.prompt}. 
      The environment should be an elegant, professional studio setting. 
      Maintain the dignity and style of the Islamic attire. 
      Output ONLY the generated image.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }]
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to generate variation. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const clearImage = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setAnalysis('');
    setGeneratedImage(null);
    setError(null);
    setIsEditing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadImage = (dataUrl: string, name: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = name;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-2 bg-indigo-100 rounded-full mb-4"
          >
            <Sparkles className="w-5 h-5 text-indigo-600 mr-2" />
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Islamic Fashion AI Studio</span>
          </motion.div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2">
            AI Image Studio Pro
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto font-medium">
            Analyze, edit, and generate stunning variations of Islamic attire with precision AI.
          </p>
        </header>

        <main className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Left Column: Image & Editor (7 cols) */}
          <div className="xl:col-span-7 space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-indigo-100/50 overflow-hidden min-h-[550px] relative flex flex-col">
              {!originalImage ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all p-12 group"
                >
                  <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    <Upload className="w-10 h-10 text-indigo-600" />
                  </div>
                  <p className="text-2xl font-black text-slate-900">Drop your image here</p>
                  <p className="text-slate-400 mt-2 font-medium">High resolution images work best</p>
                </div>
              ) : isEditing ? (
                <div className="flex-1 relative bg-slate-950">
                  <Cropper
                    image={originalImage}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                    style={{
                      containerStyle: { background: '#020617' },
                      cropAreaStyle: { border: '2px solid rgba(255,255,255,0.5)', borderRadius: '1rem' }
                    }}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50 relative group">
                  <img 
                    src={processedImage || originalImage} 
                    alt="Preview" 
                    className="max-w-full max-h-[650px] rounded-3xl shadow-2xl object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                    referrerPolicy="no-referrer"
                    style={{
                      filter: !processedImage ? `brightness(${filters.brightness}%) contrast(${filters.contrast}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%)` : 'none'
                    }}
                  />
                  <div className="absolute top-6 right-6 flex gap-2">
                    <button 
                      onClick={() => downloadImage(processedImage || originalImage!, 'original.jpg')}
                      className="p-3 bg-white/90 backdrop-blur-md shadow-xl rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={clearImage}
                      className="p-3 bg-white/90 backdrop-blur-md shadow-xl rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                      title="Clear"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Toolbar */}
              {originalImage && (
                <div className="p-5 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {!isEditing ? (
                      <>
                        <button 
                          onClick={() => setIsEditing(true)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                        >
                          <Crop className="w-4 h-4" /> Edit & Crop
                        </button>
                        <button 
                          onClick={() => setRotation(r => (r + 90) % 360)}
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
                          title="Rotate"
                        >
                          <RotateCw className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={applyEdits}
                        className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all"
                      >
                        <Check className="w-4 h-4" /> Save Edits
                      </button>
                    )}
                  </div>
                  
                  {originalImage && !isEditing && (
                    <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Brightness</span>
                        <input type="range" min="50" max="150" value={filters.brightness} onChange={(e) => setFilters(f => ({ ...f, brightness: parseInt(e.target.value) }))} className="w-24 accent-indigo-600" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Contrast</span>
                        <input type="range" min="50" max="150" value={filters.contrast} onChange={(e) => setFilters(f => ({ ...f, contrast: parseInt(e.target.value) }))} className="w-24 accent-indigo-600" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Generated Image Preview */}
            <AnimatePresence>
              {generatedImage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-indigo-100/50 space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                        <Zap className="w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900">AI Generated Variation</h3>
                    </div>
                    <button 
                      onClick={() => downloadImage(generatedImage!, 'variation.png')}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition-all"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </div>
                  <div className="relative group rounded-3xl overflow-hidden bg-slate-100 flex items-center justify-center min-h-[400px]">
                    <img src={generatedImage} alt="Generated" className="max-w-full max-h-[600px] object-contain" referrerPolicy="no-referrer" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
          </div>

          {/* Right Column: Studio Controls (5 cols) */}
          <div className="xl:col-span-5 space-y-6">
            {/* Mode Selector */}
            <div className="bg-white p-2 rounded-3xl border border-slate-200 shadow-sm flex gap-2">
              <button 
                onClick={() => setActiveTab('analyze')}
                className={`flex-1 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2
                  ${activeTab === 'analyze' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <MessageSquare className="w-4 h-4" /> Analyze
              </button>
              <button 
                onClick={() => setActiveTab('generate')}
                className={`flex-1 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2
                  ${activeTab === 'generate' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <RefreshCw className="w-4 h-4" /> Variation Studio
              </button>
            </div>

            {/* Tab Content */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              {activeTab === 'analyze' ? (
                <>
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Select Analysis Type</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {ANALYSIS_PROMPTS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPrompt(p)}
                          className={`flex items-center gap-4 p-4 rounded-2xl text-left transition-all border-2
                            ${selectedPrompt.id === p.id 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                              : 'bg-white border-transparent text-slate-600 hover:bg-slate-50'}`}
                        >
                          <div className={`p-2.5 rounded-xl ${selectedPrompt.id === p.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                            {p.icon}
                          </div>
                          <span className="font-bold">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {processedImage && !loading && (
                    <button
                      onClick={analyzeImage}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-5 h-5" /> Run AI Analysis
                    </button>
                  )}

                  <div className="pt-6 border-t border-slate-100 min-h-[200px]">
                    <AnimatePresence mode="wait">
                      {loading ? (
                        <div className="flex flex-col items-center justify-center h-full py-12 space-y-4">
                          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                          <p className="text-indigo-600 font-bold">Analyzing details...</p>
                        </div>
                      ) : analysis ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose prose-slate prose-sm max-w-none">
                          <ReactMarkdown>{analysis}</ReactMarkdown>
                        </motion.div>
                      ) : (
                        <div className="text-center py-12 text-slate-400 font-medium">
                          <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                          <p>Results will appear here</p>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Select New Pose</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {POSES.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPose(p)}
                          className={`flex items-center gap-4 p-4 rounded-2xl text-left transition-all border-2
                            ${selectedPose.id === p.id 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                              : 'bg-white border-transparent text-slate-600 hover:bg-slate-50'}`}
                        >
                          <div className={`p-2.5 rounded-xl ${selectedPose.id === p.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                            <Layout className="w-5 h-5" />
                          </div>
                          <span className="font-bold">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                      <strong>Tip:</strong> AI will maintain the model's identity and the Islamic attire (Borka/Panjabi) while changing the pose and background.
                    </p>
                  </div>

                  {processedImage && !generating && (
                    <button
                      onClick={generateVariation}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Zap className="w-5 h-5" /> Generate Variation
                    </button>
                  )}

                  {generating && (
                    <div className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-bold text-lg flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Creating Masterpiece...
                    </div>
                  )}

                  {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
          <p>© 2026 AI Image Studio Pro • Powered by Gemini 2.5 Flash Image</p>
        </footer>
      </div>
    </div>
  );
}
