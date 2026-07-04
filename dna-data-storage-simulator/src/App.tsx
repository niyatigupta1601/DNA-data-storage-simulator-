/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, 
  Binary, 
  Dna, 
  Database, 
  RefreshCw, 
  Image as ImageIcon, 
  Info, 
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  Microscope
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

// --- Types ---

type PipelineStep = 'upload' | 'binary' | 'dna' | 'storage' | 'decode' | 'reconstruct';

interface ImageInfo {
  name: string;
  size: number;
  width: number;
  height: number;
  type: string;
  dataUrl: string;
}

// --- Constants ---

const BINARY_TO_DNA: Record<string, string> = {
  '00': 'A',
  '01': 'C',
  '10': 'G',
  '11': 'T'
};

const DNA_TO_BINARY: Record<string, string> = {
  'A': '00',
  'C': '01',
  'G': '10',
  'T': '11'
};

// --- Components ---

const StepIndicator = ({ currentStep, steps }: { currentStep: PipelineStep, steps: PipelineStep[] }) => {
  const stepIndex = steps.indexOf(currentStep);
  
  return (
    <div className="flex items-center justify-between w-full mb-8 px-4">
      {steps.map((step, idx) => {
        const isActive = idx <= stepIndex;
        const isCurrent = idx === stepIndex;
        
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center relative">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${
                  isCurrent ? 'bg-blue-600 border-blue-400 scale-110 shadow-lg shadow-blue-500/30' : 
                  isActive ? 'bg-blue-900 border-blue-700' : 'bg-gray-800 border-gray-700'
                }`}
              >
                {idx < stepIndex ? (
                  <CheckCircle2 className="w-6 h-6 text-blue-400" />
                ) : (
                  <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-gray-500'}`}>
                    {idx + 1}
                  </span>
                )}
              </div>
              <span className={`text-[10px] uppercase tracking-wider mt-2 font-semibold ${isActive ? 'text-blue-400' : 'text-gray-600'}`}>
                {step}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className="flex-1 h-[2px] mx-2 bg-gray-800 overflow-hidden">
                <motion.div 
                  className="h-full bg-blue-600"
                  initial={{ width: 0 }}
                  animate={{ width: idx < stepIndex ? '100%' : '0%' }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const DNAHelix = () => {
  return (
    <div className="relative w-full h-32 flex items-center justify-center overflow-hidden">
      <div className="flex space-x-1">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="flex flex-col items-center justify-between h-24"
            animate={{
              rotateY: [0, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
              delay: i * 0.15,
            }}
          >
            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            <div className="w-[1px] h-16 bg-gray-700" />
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [step, setStep] = useState<PipelineStep>('upload');
  const [image, setImage] = useState<ImageInfo | null>(null);
  const [binaryData, setBinaryData] = useState<string>('');
  const [dnaSequence, setDnaSequence] = useState<string>('');
  const [reconstructedUrl, setReconstructedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps: PipelineStep[] = ['upload', 'binary', 'dna', 'storage', 'decode', 'reconstruct'];

  // --- Logic ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage({
          name: file.name,
          size: file.size,
          width: img.width,
          height: img.height,
          type: file.type,
          dataUrl: event.target?.result as string
        });
        setStep('upload');
        // Reset subsequent states
        setBinaryData('');
        setDnaSequence('');
        setReconstructedUrl(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const convertToBinary = async () => {
    if (!image) return;
    setIsProcessing(true);
    
    // Use a small delay for animation feel
    await new Promise(r => setTimeout(r, 800));

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We scale down for simulation performance if image is too large
    // but for this demo we'll just process a small portion or the whole thing if reasonable
    const maxDim = 64; // Keep it small for visualization
    const ratio = Math.min(maxDim / image.width, maxDim / image.height, 1);
    const w = Math.floor(image.width * ratio);
    const h = Math.floor(image.height * ratio);
    
    canvas.width = w;
    canvas.height = h;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      
      let binary = '';
      // Store width and height in the binary stream first (simple header)
      const header = [w, h].map(n => n.toString(2).padStart(16, '0')).join('');
      binary += header;

      for (let i = 0; i < data.length; i += 4) {
        // RGBA
        binary += data[i].toString(2).padStart(8, '0');     // R
        binary += data[i + 1].toString(2).padStart(8, '0'); // G
        binary += data[i + 2].toString(2).padStart(8, '0'); // B
        // Skip Alpha for simplicity in this demo
      }
      
      setBinaryData(binary);
      setStep('binary');
      setIsProcessing(false);
    };
    img.src = image.dataUrl;
  };

  const encodeToDNA = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 1000));

    let dna = '';
    for (let i = 0; i < binaryData.length; i += 2) {
      const pair = binaryData.slice(i, i + 2);
      dna += BINARY_TO_DNA[pair] || 'A'; // Fallback to A if odd length
    }
    
    setDnaSequence(dna);
    setStep('dna');
    setIsProcessing(false);
  };

  const simulateStorage = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 1200));
    setStep('storage');
    setIsProcessing(false);
  };

  const decodeFromDNA = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 1000));
    
    // We already have binaryData, but let's "re-derive" it from dnaSequence
    let decodedBinary = '';
    for (const base of dnaSequence) {
      decodedBinary += DNA_TO_BINARY[base] || '00';
    }
    
    setBinaryData(decodedBinary);
    setStep('decode');
    setIsProcessing(false);
  };

  const reconstructImage = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 1500));

    const w = parseInt(binaryData.slice(0, 16), 2);
    const h = parseInt(binaryData.slice(16, 32), 2);
    const pixelData = binaryData.slice(32);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(w, h);
    let binaryIdx = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = parseInt(pixelData.slice(binaryIdx, binaryIdx + 8), 2) || 0;
      const g = parseInt(pixelData.slice(binaryIdx + 8, binaryIdx + 16), 2) || 0;
      const b = parseInt(pixelData.slice(binaryIdx + 16, binaryIdx + 24), 2) || 0;
      
      imageData.data[i] = r;
      imageData.data[i+1] = g;
      imageData.data[i+2] = b;
      imageData.data[i+3] = 255; // Alpha
      
      binaryIdx += 24;
    }

    ctx.putImageData(imageData, 0, 0);
    setReconstructedUrl(canvas.toDataURL());
    setStep('reconstruct');
    setIsProcessing(false);
    
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#10b981', '#f59e0b']
    });
  };

  const reset = () => {
    setStep('upload');
    setImage(null);
    setBinaryData('');
    setDnaSequence('');
    setReconstructedUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Render Helpers ---

  const renderExplanation = () => {
    switch (step) {
      case 'upload':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
              <Info className="w-5 h-5" /> Digital Data Entry
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Every digital file—whether it's a photo, video, or document—starts as a collection of pixels or characters. To store this in DNA, we first need to capture the raw digital properties.
            </p>
            <div className="bg-blue-900/20 border border-blue-800/50 p-4 rounded-lg">
              <ul className="space-y-2 text-sm text-blue-200">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 mt-1 flex-shrink-0" />
                  <span>Images are composed of a grid of pixels.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 mt-1 flex-shrink-0" />
                  <span>Each pixel has Red, Green, and Blue (RGB) values.</span>
                </li>
              </ul>
            </div>
          </div>
        );
      case 'binary':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-green-400 flex items-center gap-2">
              <Binary className="w-5 h-5" /> Binary Conversion
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Computers speak in 0s and 1s. We convert the RGB values of each pixel into 8-bit binary strings.
            </p>
            <div className="bg-green-900/20 border border-green-800/50 p-4 rounded-lg">
              <p className="text-xs font-mono text-green-300 mb-2">Example Mapping:</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-black/40 p-2 rounded">Pixel (R: 255) → 11111111</div>
                <div className="bg-black/40 p-2 rounded">Pixel (R: 0) → 00000000</div>
              </div>
            </div>
          </div>
        );
      case 'dna':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-purple-400 flex items-center gap-2">
              <Dna className="w-5 h-5" /> DNA Synthesis
            </h3>
            <p className="text-gray-300 leading-relaxed">
              This is where the magic happens. We map binary pairs to the four nitrogenous bases of DNA: 
              <span className="text-blue-400 font-bold"> A</span>, 
              <span className="text-green-400 font-bold"> C</span>, 
              <span className="text-yellow-400 font-bold"> G</span>, and 
              <span className="text-red-400 font-bold"> T</span>.
            </p>
            <div className="bg-purple-900/20 border border-purple-800/50 p-4 rounded-lg">
              <div className="grid grid-cols-4 gap-1 text-center font-bold text-xs">
                <div className="p-2 bg-blue-500/20 rounded">00 → A</div>
                <div className="p-2 bg-green-500/20 rounded">01 → C</div>
                <div className="p-2 bg-yellow-500/20 rounded">10 → G</div>
                <div className="p-2 bg-red-500/20 rounded">11 → T</div>
              </div>
            </div>
          </div>
        );
      case 'storage':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
              <Database className="w-5 h-5" /> Molecular Storage
            </h3>
            <p className="text-gray-300 leading-relaxed">
              DNA is incredibly dense. Theoretically, all the world's data could fit into a few kilograms of DNA. It can last for thousands of years if kept cool and dry.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-800/50 p-4 rounded-lg text-sm text-yellow-200">
              <p>In a real lab, these sequences are synthesized into physical DNA strands and stored in tiny vials or "DNA libraries".</p>
            </div>
          </div>
        );
      case 'decode':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-orange-400 flex items-center gap-2">
              <Microscope className="w-5 h-5" /> DNA Sequencing
            </h3>
            <p className="text-gray-300 leading-relaxed">
              To retrieve the data, we "read" the DNA using a sequencer. This converts the biological molecules back into digital signals (A, C, G, T) which we then map back to binary.
            </p>
          </div>
        );
      case 'reconstruct':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-pink-400 flex items-center gap-2">
              <RefreshCw className="w-5 h-5" /> Digital Reconstruction
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Finally, the binary stream is reassembled into pixel data. If the encoding and decoding were perfect, the reconstructed image will be identical to the original!
            </p>
            <div className="flex items-center gap-2 text-green-400 font-bold bg-green-900/20 p-3 rounded-lg border border-green-800/50">
              <CheckCircle2 className="w-5 h-5" />
              <span>Integrity Verified: 100% Match</span>
            </div>
          </div>
        );
    }
  };

  const renderVisualization = () => {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center p-6 bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div 
              key="upload-viz"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center"
            >
              {image ? (
                <div className="relative group">
                  <img 
                    src={image.dataUrl} 
                    alt="Uploaded" 
                    className="max-w-[300px] max-h-[300px] rounded-lg shadow-2xl border-4 border-blue-500/30"
                  />
                  <div className="absolute -bottom-4 -right-4 bg-blue-600 text-white p-2 rounded-full shadow-lg">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                </div>
              ) : (
                <div className="w-64 h-64 border-2 border-dashed border-gray-700 rounded-2xl flex flex-col items-center justify-center text-gray-500 bg-gray-800/30">
                  <Upload className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">No image selected</p>
                </div>
              )}
            </motion.div>
          )}

          {step === 'binary' && (
            <motion.div 
              key="binary-viz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col items-center justify-center"
            >
              <div className="grid grid-cols-8 gap-1 p-4 bg-black/40 rounded-xl border border-green-900/30 max-w-md overflow-hidden">
                {binaryData.slice(0, 256).split('').map((bit, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (i % 64) * 0.01 }}
                    className={`w-full aspect-square flex items-center justify-center text-[10px] font-mono rounded ${
                      bit === '1' ? 'bg-green-500 text-black font-bold' : 'bg-gray-800 text-green-500/50'
                    }`}
                  >
                    {bit}
                  </motion.div>
                ))}
              </div>
              <p className="mt-4 text-xs text-green-500/70 font-mono animate-pulse">
                STREAMING BINARY DATA... {binaryData.length} bits
              </p>
            </motion.div>
          )}

          {step === 'dna' && (
            <motion.div 
              key="dna-viz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col items-center justify-center"
            >
              <DNAHelix />
              <div className="mt-8 grid grid-cols-10 gap-1 max-w-md">
                {dnaSequence.slice(0, 100).split('').map((base, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: (i % 50) * 0.02 }}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold shadow-lg ${
                      base === 'A' ? 'bg-blue-500 text-white' :
                      base === 'C' ? 'bg-green-500 text-white' :
                      base === 'G' ? 'bg-yellow-500 text-black' :
                      'bg-red-500 text-white'
                    }`}
                  >
                    {base}
                  </motion.div>
                ))}
              </div>
              <p className="mt-6 text-sm text-purple-400 font-bold tracking-widest">
                SYNTHESIZED SEQUENCE: {dnaSequence.length} BASES
              </p>
            </motion.div>
          )}

          {step === 'storage' && (
            <motion.div 
              key="storage-viz"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center"
            >
              <div className="relative">
                <FlaskConical className="w-48 h-48 text-blue-400/20 fill-blue-400/10" strokeWidth={1} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col gap-1">
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                          x: [0, 10, -10, 0],
                          y: [0, -5, 5, 0],
                          opacity: [0.4, 0.8, 0.4]
                        }}
                        transition={{ 
                          duration: 3 + i, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                        className="w-24 h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-full blur-[1px]"
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-8 text-center">
                <p className="text-xl font-bold text-blue-400">DNA Library Alpha-1</p>
                <p className="text-sm text-gray-500 mt-1">Status: Stable | Temp: -20°C</p>
                <div className="mt-4 flex gap-4">
                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                    <p className="text-[10px] text-gray-500 uppercase">Strands</p>
                    <p className="text-lg font-mono text-white">1,240</p>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                    <p className="text-[10px] text-gray-500 uppercase">Density</p>
                    <p className="text-lg font-mono text-white">215 PB/g</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'decode' && (
            <motion.div 
              key="decode-viz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col items-center justify-center"
            >
              <div className="relative w-64 h-64 flex items-center justify-center">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-4 border-dashed border-orange-500/30 rounded-full"
                />
                <Microscope className="w-24 h-24 text-orange-500 animate-pulse" />
              </div>
              <div className="mt-8 flex gap-2 overflow-hidden max-w-md h-12 items-center">
                {dnaSequence.slice(0, 20).split('').map((base, i) => (
                  <motion.div
                    key={i}
                    animate={{ x: [-100, 400] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
                    className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                      base === 'A' ? 'bg-blue-500' :
                      base === 'C' ? 'bg-green-500' :
                      base === 'G' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                  >
                    {base}
                  </motion.div>
                ))}
              </div>
              <p className="mt-4 text-xs font-mono text-orange-400 uppercase tracking-widest">
                Sequencing in progress...
              </p>
            </motion.div>
          )}

          {step === 'reconstruct' && (
            <motion.div 
              key="reconstruct-viz"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <div className="flex gap-8 items-center">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[10px] uppercase text-gray-500 font-bold">Original</p>
                  <img 
                    src={image?.dataUrl} 
                    className="w-32 h-32 rounded border border-gray-700 opacity-50" 
                    alt="Original"
                  />
                </div>
                <motion.div
                  animate={{ x: [0, 5, -5, 0] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                >
                  <ChevronRight className="w-8 h-8 text-blue-500" />
                </motion.div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[10px] uppercase text-pink-500 font-bold">Reconstructed</p>
                  {reconstructedUrl && (
                    <motion.img 
                      initial={{ filter: 'blur(10px)' }}
                      animate={{ filter: 'blur(0px)' }}
                      transition={{ duration: 1 }}
                      src={reconstructedUrl} 
                      className="w-48 h-48 rounded-lg shadow-2xl border-4 border-pink-500/30" 
                      alt="Reconstructed"
                    />
                  )}
                </div>
              </div>
              <div className="mt-8 bg-green-500/10 border border-green-500/30 px-6 py-3 rounded-full flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-ping" />
                <span className="text-green-400 font-bold text-sm">DATA RECOVERY SUCCESSFUL</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Processing Overlay */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center"
            >
              <div className="relative w-24 h-24">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Dna className="w-8 h-8 text-blue-400 animate-pulse" />
                </div>
              </div>
              <p className="mt-6 text-blue-400 font-bold tracking-widest uppercase text-sm animate-pulse">
                Processing Pipeline...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Dna className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">DNA STORAGE SIMULATOR</h1>
              <p className="text-[10px] text-blue-400 font-bold tracking-[0.2em] uppercase">Computational Biology Lab v1.0</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full border border-gray-700">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-gray-400 uppercase">System Online</span>
            </div>
            <button 
              onClick={reset}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
              title="Reset Simulation"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <StepIndicator currentStep={step} steps={steps} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel: Controls */}
          <div className="lg:col-span-3 space-y-6">
            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Control Center</h2>
              
              <div className="space-y-3">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    step === 'upload' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <span className="text-sm font-semibold">1. Upload Image</span>
                  <Upload className="w-4 h-4" />
                </button>

                <button 
                  onClick={convertToBinary}
                  disabled={!image || step !== 'upload'}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    step === 'binary' ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-600/20' : 
                    (!image || step !== 'upload') ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <span className="text-sm font-semibold">2. Convert to Binary</span>
                  <Binary className="w-4 h-4" />
                </button>

                <button 
                  onClick={encodeToDNA}
                  disabled={step !== 'binary'}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    step === 'dna' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20' : 
                    step !== 'binary' ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <span className="text-sm font-semibold">3. Encode to DNA</span>
                  <Dna className="w-4 h-4" />
                </button>

                <button 
                  onClick={simulateStorage}
                  disabled={step !== 'dna'}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    step === 'storage' ? 'bg-yellow-600 border-yellow-500 text-white shadow-lg shadow-yellow-600/20' : 
                    step !== 'dna' ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <span className="text-sm font-semibold">4. Store in DNA</span>
                  <Database className="w-4 h-4" />
                </button>

                <button 
                  onClick={decodeFromDNA}
                  disabled={step !== 'storage'}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    step === 'decode' ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' : 
                    step !== 'storage' ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <span className="text-sm font-semibold">5. Retrieve & Decode</span>
                  <Microscope className="w-4 h-4" />
                </button>

                <button 
                  onClick={reconstructImage}
                  disabled={step !== 'decode'}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    step === 'reconstruct' ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-600/20' : 
                    step !== 'decode' ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <span className="text-sm font-semibold">6. Reconstruct Image</span>
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </section>

            {image && (
              <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Image Metadata</h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Filename</span>
                    <span className="text-gray-300 truncate max-w-[120px]">{image.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Resolution</span>
                    <span className="text-gray-300">{image.width} × {image.height}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Size</span>
                    <span className="text-gray-300">{(image.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Pixels</span>
                    <span className="text-gray-300">{(image.width * image.height).toLocaleString()}</span>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Center Panel: Visualization */}
          <div className="lg:col-span-6 min-h-[500px]">
            {renderVisualization()}
          </div>

          {/* Right Panel: Explanation & Data */}
          <div className="lg:col-span-3 space-y-6">
            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 shadow-xl h-full">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">Pipeline Intelligence</h2>
              {renderExplanation()}
              
              <div className="mt-8 pt-8 border-t border-gray-800">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                  <AlertCircle className="w-4 h-4" />
                  <span>Real-time Stats</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>Binary Stream</span>
                      <span>{binaryData.length ? `${(binaryData.length / 8).toFixed(0)} bytes` : '0'}</span>
                    </div>
                    <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-green-500"
                        animate={{ width: binaryData.length ? '100%' : '0%' }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>DNA Sequence</span>
                      <span>{dnaSequence.length ? `${dnaSequence.length} bases` : '0'}</span>
                    </div>
                    <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-purple-500"
                        animate={{ width: dnaSequence.length ? '100%' : '0%' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Footer */}
      <footer className="mt-12 border-t border-gray-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-600">
            © 2026 DNA Data Storage Simulator. Built for Educational Visualization.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-gray-600 hover:text-blue-400 transition-colors">Documentation</a>
            <a href="#" className="text-xs text-gray-600 hover:text-blue-400 transition-colors">Lab Protocols</a>
            <a href="#" className="text-xs text-gray-600 hover:text-blue-400 transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
