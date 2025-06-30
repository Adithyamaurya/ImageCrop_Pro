import React, { useState } from 'react';
import { Download, Settings, Image as ImageIcon, CheckSquare, Square } from 'lucide-react';
import { CropArea } from '../App';

interface ExportPanelProps {
  originalImage: HTMLImageElement | null;
  cropAreas: CropArea[];
  imageScale: number;
  imageOffset: { x: number; y: number };
  canvasSize: { width: number; height: number };
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  originalImage,
  cropAreas,
  imageScale,
  imageOffset,
  canvasSize
}) => {
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [exportQuality, setExportQuality] = useState(0.9);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedCrops, setSelectedCrops] = useState<Set<string>>(new Set());

  const cropImage = (crop: CropArea): Promise<string> => {
    return new Promise((resolve) => {
      if (!originalImage) {
        resolve('');
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('');
        return;
      }

      // Get device pixel ratio for high-DPI displays (especially mobile)
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // For mobile devices, we need to be more precise with coordinate calculations
      const isMobile = window.innerWidth < 768;
      
      // The crop coordinates are already in image space, so we can use them directly
      // No need to convert from canvas coordinates since crops are stored in image coordinates
      let cropX = crop.x;
      let cropY = crop.y;
      let cropWidth = crop.width;
      let cropHeight = crop.height;

      // Ensure crop coordinates are within image bounds
      cropX = Math.max(0, Math.min(cropX, originalImage.width));
      cropY = Math.max(0, Math.min(cropY, originalImage.height));
      cropWidth = Math.max(1, Math.min(cropWidth, originalImage.width - cropX));
      cropHeight = Math.max(1, Math.min(cropHeight, originalImage.height - cropY));

      // Set canvas size to the exact crop dimensions
      // For mobile, we might want to scale up for better quality
      const outputScale = isMobile ? Math.min(2, devicePixelRatio) : 1;
      canvas.width = cropWidth * outputScale;
      canvas.height = cropHeight * outputScale;

      // Scale the context for high-DPI output
      if (outputScale !== 1) {
        ctx.scale(outputScale, outputScale);
      }

      // Fill with white background for transparent areas
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cropWidth, cropHeight);

      // Apply rotation if present
      const rotation = crop.rotation || 0;
      if (rotation !== 0) {
        // Move to center of canvas for rotation
        ctx.translate(cropWidth / 2, cropHeight / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-cropWidth / 2, -cropHeight / 2);
      }

      // Draw the cropped portion of the image
      // Use the exact crop coordinates from image space
      ctx.drawImage(
        originalImage,
        cropX,           // Source X in original image
        cropY,           // Source Y in original image  
        cropWidth,       // Source width in original image
        cropHeight,      // Source height in original image
        0,               // Destination X in canvas
        0,               // Destination Y in canvas
        cropWidth,       // Destination width in canvas
        cropHeight       // Destination height in canvas
      );

      const mimeType = exportFormat === 'jpeg' ? 'image/jpeg' : 
                      exportFormat === 'webp' ? 'image/webp' : 'image/png';
      
      // For mobile, ensure we get the best quality
      const quality = exportFormat === 'png' ? undefined : 
                     isMobile ? Math.max(0.9, exportQuality) : exportQuality;
      
      const dataUrl = canvas.toDataURL(mimeType, quality);
      resolve(dataUrl);
    });
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    
    // For mobile browsers, we need to handle download differently
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // For mobile, open in new tab/window so user can save manually if needed
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSelected = async () => {
    if (selectedCrops.size === 0) return;
    
    setIsExporting(true);
    try {
      const cropsToExport = cropAreas.filter(crop => selectedCrops.has(crop.id));
      for (const crop of cropsToExport) {
        const dataUrl = await cropImage(crop);
        if (dataUrl) {
          const filename = `${crop.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${exportFormat}`;
          downloadImage(dataUrl, filename);
          // Add a longer delay for mobile to handle downloads properly
          const delay = window.innerWidth < 768 ? 500 : 200;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      console.error('Selected export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    if (cropAreas.length === 0) return;
    
    setIsExporting(true);
    try {
      for (const crop of cropAreas) {
        const dataUrl = await cropImage(crop);
        if (dataUrl) {
          const filename = `${crop.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${exportFormat}`;
          downloadImage(dataUrl, filename);
          // Add a longer delay for mobile to handle downloads properly
          const delay = window.innerWidth < 768 ? 500 : 200;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      console.error('Bulk export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleCropSelection = (cropId: string) => {
    const newSelected = new Set(selectedCrops);
    if (newSelected.has(cropId)) {
      newSelected.delete(cropId);
    } else {
      newSelected.add(cropId);
    }
    setSelectedCrops(newSelected);
  };

  const selectAllCrops = () => {
    if (selectedCrops.size === cropAreas.length) {
      setSelectedCrops(new Set());
    } else {
      setSelectedCrops(new Set(cropAreas.map(crop => crop.id)));
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Download className="h-5 w-5 mr-2" />
          Export Center
        </h3>
        <p className="text-sm text-gray-400 mt-1">Configure and download your crops</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {/* Export Settings */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
            <Settings className="h-4 w-4 mr-2" />
            Export Settings
          </h4>
          
          <div className="space-y-4">
            {/* Format Selection */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'png' | 'jpeg' | 'webp')}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="png">PNG (Lossless)</option>
                <option value="jpeg">JPEG (Small size)</option>
                <option value="webp">WebP (Modern)</option>
              </select>
            </div>

            {/* Quality Setting */}
            {(exportFormat === 'jpeg' || exportFormat === 'webp') && (
              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  Quality: {Math.round(exportQuality * 100)}%
                  {window.innerWidth < 768 && (
                    <span className="ml-2 text-blue-400">(Mobile: Min 90%)</span>
                  )}
                </label>
                <input
                  type="range"
                  min={window.innerWidth < 768 ? "0.9" : "0.1"}
                  max="1"
                  step="0.1"
                  value={exportQuality}
                  onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Mobile-specific notice */}
        {window.innerWidth < 768 && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-300">
              <strong>Mobile Note:</strong> Downloads are optimized for mobile devices with enhanced quality and proper coordinate handling.
            </p>
          </div>
        )}

        {/* Crop Selection */}
        {cropAreas.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-300">Select Crops</h4>
              <button
                onClick={selectAllCrops}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {selectedCrops.size === cropAreas.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto thin-scrollbar">
              {cropAreas.map((crop) => (
                <div
                  key={crop.id}
                  className="flex items-center space-x-3 p-2 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer transition-colors"
                  onClick={() => toggleCropSelection(crop.id)}
                >
                  {selectedCrops.has(crop.id) ? (
                    <CheckSquare className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  ) : (
                    <Square className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{crop.name}</p>
                    <p className="text-xs text-gray-400">
                      {Math.round(crop.width)} × {Math.round(crop.height)}
                      {crop.rotation && crop.rotation !== 0 && (
                        <span className="ml-2 text-orange-400">
                          ↻ {Math.round(crop.rotation)}°
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Export Actions */}
        <div className="space-y-3">
          {/* Export Selected */}
          {selectedCrops.size > 0 && (
            <button
              onClick={handleExportSelected}
              disabled={isExporting}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg py-3 px-4 text-sm font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>
                {isExporting ? 'Exporting...' : `Export Selected (${selectedCrops.size})`}
              </span>
            </button>
          )}

          {/* Export All */}
          {cropAreas.length > 0 && (
            <button
              onClick={handleExportAll}
              disabled={isExporting}
              className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white rounded-lg py-3 px-4 text-sm font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>
                {isExporting ? 'Exporting...' : `Export All (${cropAreas.length})`}
              </span>
            </button>
          )}

          {cropAreas.length === 0 && (
            <div className="text-center py-8">
              <ImageIcon className="h-12 w-12 text-gray-500 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Create crop areas to export</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};