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

      // Set canvas size to crop dimensions
      canvas.width = crop.width;
      canvas.height = crop.height;

      // Fill with white background for transparent areas
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate the actual crop coordinates relative to the original image
      // Convert canvas coordinates back to image coordinates
      const imageX = (crop.x - imageOffset.x) / imageScale;
      const imageY = (crop.y - imageOffset.y) / imageScale;
      const imageWidth = crop.width / imageScale;
      const imageHeight = crop.height / imageScale;

      // Apply rotation if present
      const rotation = crop.rotation || 0;
      if (rotation !== 0) {
        // Move to center of canvas for rotation
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }

      // Ensure crop is within image bounds
      const cropX = Math.max(0, Math.min(imageX, originalImage.width));
      const cropY = Math.max(0, Math.min(imageY, originalImage.height));
      const cropWidth = Math.max(1, Math.min(imageWidth, originalImage.width - cropX));
      const cropHeight = Math.max(1, Math.min(imageHeight, originalImage.height - cropY));

      // Draw the cropped portion of the image
      ctx.drawImage(
        originalImage,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        crop.width,
        crop.height
      );

      const mimeType = exportFormat === 'jpeg' ? 'image/jpeg' : 
                      exportFormat === 'webp' ? 'image/webp' : 'image/png';
      
      const dataUrl = canvas.toDataURL(mimeType, exportQuality);
      resolve(dataUrl);
    });
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
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
          // Add a small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 200));
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
          // Add a small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 200));
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
        </div>

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