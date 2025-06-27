import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Settings, ChevronLeft, ChevronRight, RotateCw, Download, Eye, EyeOff } from 'lucide-react';
import { CropArea } from '../App';

interface AdvancedCropEditorProps {
  isOpen: boolean;
  onClose: () => void;
  crop: CropArea;
  originalImage: HTMLImageElement | null;
  onUpdateCrop: (updates: Partial<CropArea>) => void;
  imageScale: number;
  imageOffset: { x: number; y: number };
  allCrops: CropArea[];
  onSwitchCrop: (cropId: string) => void;
}

export const AdvancedCropEditor: React.FC<AdvancedCropEditorProps> = ({
  isOpen,
  onClose,
  crop,
  originalImage,
  onUpdateCrop,
  imageScale,
  imageOffset,
  allCrops,
  onSwitchCrop
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [exportQuality, setExportQuality] = useState(0.9);

  const currentCropIndex = allCrops.findIndex(c => c.id === crop.id);
  const canGoPrevious = currentCropIndex > 0;
  const canGoNext = currentCropIndex < allCrops.length - 1;

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !originalImage || !crop) return;

    // Set canvas size to crop dimensions
    canvas.width = crop.width * previewScale;
    canvas.height = crop.height * previewScale;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate the actual crop coordinates relative to the original image
    const imageX = (crop.x - imageOffset.x) / imageScale;
    const imageY = (crop.y - imageOffset.y) / imageScale;
    const imageWidth = crop.width / imageScale;
    const imageHeight = crop.height / imageScale;

    // Apply rotation if present
    const rotation = crop.rotation || 0;
    if (rotation !== 0) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }

    // Ensure crop is within image bounds
    const cropX = Math.max(0, Math.min(imageX, originalImage.width));
    const cropY = Math.max(0, Math.min(imageY, originalImage.height));
    const cropWidth = Math.max(1, Math.min(imageWidth, originalImage.width - cropX));
    const cropHeight = Math.max(1, Math.min(imageHeight, originalImage.height - cropY));

    // Draw the cropped portion
    ctx.drawImage(
      originalImage,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    if (rotation !== 0) {
      ctx.restore();
    }

    // Draw grid overlay if enabled
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      
      // Rule of thirds grid
      const gridWidth = canvas.width / 3;
      const gridHeight = canvas.height / 3;
      
      // Vertical lines
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridWidth, 0);
        ctx.lineTo(i * gridWidth, canvas.height);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * gridHeight);
        ctx.lineTo(canvas.width, i * gridHeight);
        ctx.stroke();
      }
      
      ctx.setLineDash([]);
    }
  }, [originalImage, crop, imageScale, imageOffset, previewScale, showGrid]);

  useEffect(() => {
    if (isOpen) {
      drawPreview();
    }
  }, [isOpen, drawPreview]);

  const handleExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mimeType = exportFormat === 'jpeg' ? 'image/jpeg' : 
                    exportFormat === 'webp' ? 'image/webp' : 'image/png';
    
    const dataUrl = canvas.toDataURL(mimeType, exportQuality);
    
    const link = document.createElement('a');
    link.download = `${crop.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${exportFormat}`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const goToPreviousCrop = () => {
    if (canGoPrevious) {
      const previousCrop = allCrops[currentCropIndex - 1];
      onSwitchCrop(previousCrop.id);
    }
  };

  const goToNextCrop = () => {
    if (canGoNext) {
      const nextCrop = allCrops[currentCropIndex + 1];
      onSwitchCrop(nextCrop.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-white">Advanced Editor</h2>
            <div className="text-sm text-gray-400">
              Crop {currentCropIndex + 1} of {allCrops.length}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded-lg transition-colors ${
                showGrid ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Toggle grid"
            >
              {showGrid ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Preview Area */}
          <div className="flex-1 bg-gray-800 flex flex-col">
            {/* Preview Canvas */}
            <div className="flex-1 flex items-center justify-center p-4 relative">
              <div className="relative bg-gray-700 rounded-lg p-4 shadow-lg">
                <canvas
                  ref={canvasRef}
                  className="max-w-full max-h-full rounded border border-gray-600"
                  style={{ 
                    imageRendering: 'pixelated',
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                />
                
                {/* Preview Controls Overlay */}
                <div className="absolute bottom-2 left-2 bg-black/70 rounded px-2 py-1 text-xs text-white">
                  {Math.round(crop.width)} × {Math.round(crop.height)}
                  {crop.rotation && crop.rotation !== 0 && (
                    <span className="ml-2 text-orange-400">
                      ↻ {Math.round(crop.rotation)}°
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Crop Navigation Controls */}
            <div className="bg-gray-900 p-4 border-t border-gray-700">
              <div className="flex items-center justify-between">
                {/* Crop Navigation */}
                <div className="flex items-center space-x-4">
                  <button
                    onClick={goToPreviousCrop}
                    disabled={!canGoPrevious}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      canGoPrevious 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                    title="Previous crop"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>
                  
                  <div className="text-center">
                    <div className="text-white font-medium">{crop.name}</div>
                    <div className="text-xs text-gray-400">
                      {currentCropIndex + 1} of {allCrops.length}
                    </div>
                  </div>
                  
                  <button
                    onClick={goToNextCrop}
                    disabled={!canGoNext}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      canGoNext 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                    title="Next crop"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPreviewScale(Math.max(0.25, previewScale - 0.25))}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
                  >
                    -
                  </button>
                  <span className="text-sm text-gray-300 w-16 text-center">
                    {Math.round(previewScale * 100)}%
                  </span>
                  <button
                    onClick={() => setPreviewScale(Math.min(4, previewScale + 0.25))}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Settings */}
          <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Output File Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Output file name
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={crop.name}
                    onChange={(e) => onUpdateCrop({ name: e.target.value })}
                    className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'png' | 'jpeg' | 'webp')}
                    className="bg-gray-800 text-white rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="png">png</option>
                    <option value="jpeg">jpg</option>
                    <option value="webp">webp</option>
                  </select>
                </div>
              </div>

              {/* Crop Properties */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-300">Crop Properties</h4>
                
                {/* Dimensions */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Width</label>
                    <input
                      type="number"
                      value={Math.round(crop.width)}
                      onChange={(e) => onUpdateCrop({ width: parseInt(e.target.value) || 1 })}
                      className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Height</label>
                    <input
                      type="number"
                      value={Math.round(crop.height)}
                      onChange={(e) => onUpdateCrop({ height: parseInt(e.target.value) || 1 })}
                      className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      min="1"
                    />
                  </div>
                </div>

                {/* Position */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">X Position</label>
                    <input
                      type="number"
                      value={Math.round(crop.x)}
                      onChange={(e) => onUpdateCrop({ x: parseInt(e.target.value) || 0 })}
                      className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Y Position</label>
                    <input
                      type="number"
                      value={Math.round(crop.y)}
                      onChange={(e) => onUpdateCrop({ y: parseInt(e.target.value) || 0 })}
                      className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Rotation */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Rotation</label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="1"
                      value={crop.rotation || 0}
                      onChange={(e) => onUpdateCrop({ rotation: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max="360"
                        step="1"
                        value={Math.round(crop.rotation || 0)}
                        onChange={(e) => {
                          let rotation = parseFloat(e.target.value) || 0;
                          rotation = ((rotation % 360) + 360) % 360;
                          onUpdateCrop({ rotation });
                        }}
                        className="w-20 bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <span className="text-xs text-gray-400">degrees</span>
                      <button
                        onClick={() => onUpdateCrop({ rotation: 0 })}
                        className="text-orange-400 hover:text-orange-300 p-1 rounded transition-colors"
                        title="Reset rotation"
                      >
                        <RotateCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Export Quality */}
              {(exportFormat === 'jpeg' || exportFormat === 'webp') && (
                <div>
                  <label className="block text-xs text-gray-400 mb-2">
                    Quality: {Math.round(exportQuality * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={exportQuality}
                    onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-gray-700 space-y-3">
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 px-4 font-medium transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export Crop</span>
              </button>
              
              <div className="flex space-x-2">
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 px-4 text-sm transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    // Apply changes and close
                    onClose();
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 px-4 text-sm transition-colors"
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};