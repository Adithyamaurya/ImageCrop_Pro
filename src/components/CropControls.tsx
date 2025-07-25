import React, { useState } from 'react';
import { Plus, Trash2, Square, Crop, RotateCw, Grid3X3, Link, Unlink } from 'lucide-react';
import { CropArea } from '../App';

interface CropControlsProps {
  cropAreas: CropArea[];
  selectedCrop: CropArea | undefined;
  onAddCrop: () => void;
  onUpdateCrop: (id: string, updates: Partial<CropArea>) => void;
  onDeleteCrop: (id: string) => void;
  onSelectCrop: (id: string | null) => void;
  onCopyCropStyle: (cropId: string) => void;
  onAddMultipleCrops: (rows: number, cols: number, startX: number, startY: number, cropSize?: number, spacing?: number) => void;
  onUpdateGridCrops: (gridId: string, updates: Partial<CropArea>) => void;
  onUnlinkFromGrid: (cropId: string) => void;
  editingCropName: string | null;
  onSetEditingCropName: (cropId: string | null) => void;
}

const ASPECT_RATIOS = [
  { label: 'Free', value: 0 },
  { label: 'Square (1:1)', value: 1 },
  { label: 'Portrait (3:4)', value: 3/4 },
  { label: 'Landscape (4:3)', value: 4/3 },
  { label: 'Widescreen (16:9)', value: 16/9 },
  { label: 'Ultra Wide (21:9)', value: 21/9 },
];

export const CropControls: React.FC<CropControlsProps> = ({
  cropAreas,
  selectedCrop,
  onAddCrop,
  onUpdateCrop,
  onDeleteCrop,
  onSelectCrop,
  onCopyCropStyle,
  onAddMultipleCrops,
  onUpdateGridCrops,
  onUnlinkFromGrid,
  editingCropName,
  onSetEditingCropName
}) => {
  const [tempName, setTempName] = useState('');
  const [showMultipleDialog, setShowMultipleDialog] = useState(false);
  const [gridRows, setGridRows] = useState(2);
  const [gridCols, setGridCols] = useState(2);
  const [gridStartX, setGridStartX] = useState(100);
  const [gridStartY, setGridStartY] = useState(100);
  const [gridCropSize, setGridCropSize] = useState(150);
  const [gridSpacing, setGridSpacing] = useState(0);

  const handleAspectRatioChange = (ratio: number) => {
    if (!selectedCrop) return;
    
    let newHeight = selectedCrop.height;
    if (ratio > 0) {
      newHeight = selectedCrop.width / ratio;
    }
    
    const updates = { 
      aspectRatio: ratio || undefined,
      height: newHeight
    };

    // If this crop is part of a grid, update all crops in the grid
    if (selectedCrop.gridId) {
      onUpdateGridCrops(selectedCrop.gridId, updates);
    } else {
      onUpdateCrop(selectedCrop.id, updates);
    }
  };

  const resetRotation = () => {
    if (selectedCrop) {
      const updates = { rotation: 0 };
      
      if (selectedCrop.gridId) {
        onUpdateGridCrops(selectedCrop.gridId, updates);
      } else {
        onUpdateCrop(selectedCrop.id, updates);
      }
    }
  };

  const handleRotationChange = (value: string) => {
    if (!selectedCrop) return;
    
    let rotation = parseFloat(value);
    if (isNaN(rotation)) rotation = 0;
    
    // Normalize to 0-360 range
    rotation = ((rotation % 360) + 360) % 360;
    
    const updates = { rotation };
    
    if (selectedCrop.gridId) {
      onUpdateGridCrops(selectedCrop.gridId, updates);
    } else {
      onUpdateCrop(selectedCrop.id, updates);
    }
  };

  const handleCreateMultipleCrops = () => {
    if (gridRows > 0 && gridCols > 0) {
      onAddMultipleCrops(gridRows, gridCols, gridStartX, gridStartY, gridCropSize, gridSpacing);
      setShowMultipleDialog(false);
    }
  };

  const handleMultipleDialogKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateMultipleCrops();
    } else if (e.key === 'Escape') {
      setShowMultipleDialog(false);
    }
  };

  const handleCropUpdate = (updates: Partial<CropArea>) => {
    if (!selectedCrop) return;
    
    if (selectedCrop.gridId) {
      onUpdateGridCrops(selectedCrop.gridId, updates);
    } else {
      onUpdateCrop(selectedCrop.id, updates);
    }
  };

  // Get grid information for selected crop
  const getGridInfo = (crop: CropArea) => {
    if (!crop.gridId) return null;
    
    const gridCrops = cropAreas.filter(c => c.gridId === crop.gridId);
    const rows = Math.max(...gridCrops.map(c => c.gridPosition?.row || 0)) + 1;
    const cols = Math.max(...gridCrops.map(c => c.gridPosition?.col || 0)) + 1;
    
    return {
      totalCrops: gridCrops.length,
      rows,
      cols,
      gridId: crop.gridId
    };
  };

  const gridInfo = selectedCrop ? getGridInfo(selectedCrop) : null;

  return (
    <div className="p-4 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
      {/* Add Crop Buttons */}
      <div className="space-y-3">
        <button
          onClick={onAddCrop}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 px-4 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Add Crop Area</span>
        </button>

        <button
          onClick={() => setShowMultipleDialog(true)}
          className="w-full flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-3 px-4 transition-colors"
        >
          <Grid3X3 className="h-5 w-5" />
          <span>Add Uniform Grid</span>
        </button>
      </div>

      {/* Multiple Crops Dialog */}
      {showMultipleDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <Grid3X3 className="h-5 w-5 mr-2" />
                  Create Uniform Grid
                </h3>
                <button
                  onClick={() => setShowMultipleDialog(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <Plus className="h-5 w-5 rotate-45" />
                </button>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto modal-scrollbar">
                {/* Grid Dimensions */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Rows (M)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={gridRows}
                      onChange={(e) => setGridRows(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                      onKeyDown={handleMultipleDialogKeyPress}
                      className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Columns (N)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={gridCols}
                      onChange={(e) => setGridCols(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                      onKeyDown={handleMultipleDialogKeyPress}
                      className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Crop Size and Spacing */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Crop Size (px)
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="500"
                      value={gridCropSize}
                      onChange={(e) => setGridCropSize(Math.max(50, Math.min(500, parseInt(e.target.value) || 150)))}
                      onKeyDown={handleMultipleDialogKeyPress}
                      className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Spacing (px)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={gridSpacing}
                      onChange={(e) => setGridSpacing(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      onKeyDown={handleMultipleDialogKeyPress}
                      className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Starting Position */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Start X Position
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={gridStartX}
                      onChange={(e) => setGridStartX(Math.max(0, parseInt(e.target.value) || 0))}
                      onKeyDown={handleMultipleDialogKeyPress}
                      className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Start Y Position
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={gridStartY}
                      onChange={(e) => setGridStartY(Math.max(0, parseInt(e.target.value) || 0))}
                      onKeyDown={handleMultipleDialogKeyPress}
                      className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowMultipleDialog(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white rounded-lg py-2 px-4 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMultipleCrops}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 px-4 transition-colors"
                >
                  Create Uniform Grid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crop Areas List */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
          <Crop className="h-4 w-4 mr-2" />
          Crop Areas ({cropAreas.length})
        </h3>
        
        {cropAreas.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">No crop areas created yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto thin-scrollbar">
            {cropAreas.map((crop) => (
              <div
                key={crop.id}
                className={`p-3 rounded-lg transition-colors cursor-pointer ${
                  selectedCrop?.id === crop.id
                    ? 'bg-blue-600/20 border border-blue-500'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => onSelectCrop(crop.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-white">{crop.name}</span>
                      {crop.gridId && (
                        <div className="flex items-center space-x-1">
                          <Link className="h-3 w-3 text-purple-400" />
                          <span className="text-xs text-purple-400">Grid</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {crop.gridId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnlinkFromGrid(crop.id);
                        }}
                        className="text-purple-400 hover:text-purple-300 p-1 rounded transition-colors"
                        title="Unlink from grid"
                      >
                        <Unlink className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCrop(crop.id);
                      }}
                      className="text-red-400 hover:text-red-300 p-1 rounded transition-colors"
                      title="Delete crop"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {Math.round(crop.width)} × {Math.round(crop.height)}
                  {crop.rotation && crop.rotation !== 0 && (
                    <span className="ml-2 text-orange-400">
                      ↻ {Math.round(crop.rotation)}°
                    </span>
                  )}
                  {crop.aspectRatio && crop.aspectRatio > 0 && (
                    <span className="ml-2 text-blue-400">
                      ({crop.aspectRatio === 1 ? '1:1' : 
                        crop.aspectRatio === 4/3 ? '4:3' : 
                        crop.aspectRatio === 3/4 ? '3:4' : 
                        crop.aspectRatio === 16/9 ? '16:9' : 
                        crop.aspectRatio === 21/9 ? '21:9' : 
                        `${crop.aspectRatio.toFixed(2)}:1`})
                    </span>
                  )}
                  {crop.gridPosition && (
                    <span className="ml-2 text-purple-400">
                      [{crop.gridPosition.row + 1},{crop.gridPosition.col + 1}]
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Crop Controls */}
      {selectedCrop && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
            <Square className="h-4 w-4 mr-2" />
            Edit Crop Area
            {gridInfo && (
              <div className="ml-2 flex items-center space-x-1 text-purple-400">
                <Link className="h-3 w-3" />
                <span className="text-xs">Grid ({gridInfo.rows}×{gridInfo.cols})</span>
              </div>
            )}
          </h3>
          
          {gridInfo && (
            <div className="mb-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
              <div className="text-xs text-purple-300 space-y-1">
                <div><strong>Grid Mode:</strong> Changes apply to all {gridInfo.totalCrops} crops</div>
                <div><strong>Position:</strong> Row {(selectedCrop.gridPosition?.row || 0) + 1}, Column {(selectedCrop.gridPosition?.col || 0) + 1}</div>
                <div><strong>Synchronized:</strong> Size, rotation, aspect ratio</div>
              </div>
            </div>
          )}
          
          <div className="space-y-4 max-h-96 overflow-y-auto thin-scrollbar">
            {/* Name */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={selectedCrop.name}
                  onChange={(e) => onUpdateCrop(selectedCrop.id, { name: e.target.value })}
                  className="flex-1 bg-gray-700 text-white rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                {selectedCrop.gridId && (
                  <button
                    onClick={() => onUnlinkFromGrid(selectedCrop.id)}
                    className="text-purple-400 hover:text-purple-300 p-2 rounded transition-colors"
                    title="Unlink from grid"
                  >
                    <Unlink className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Rotation Control */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">
                Rotation {gridInfo && <span className="text-purple-400">(Grid Synchronized)</span>}
              </label>
              <div className="space-y-2">
                {/* Slider */}
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={selectedCrop.rotation || 0}
                    onChange={(e) => handleRotationChange(e.target.value)}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <button
                    onClick={resetRotation}
                    className="text-orange-400 hover:text-orange-300 p-1 rounded transition-colors"
                    title="Reset rotation"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                </div>
                
                {/* Number Input */}
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="360"
                    step="1"
                    value={Math.round(selectedCrop.rotation || 0)}
                    onChange={(e) => handleRotationChange(e.target.value)}
                    className="w-20 bg-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">degrees</span>
                </div>
              </div>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Aspect Ratio {gridInfo && <span className="text-purple-400">(Grid Synchronized)</span>}
              </label>
              <select
                value={selectedCrop.aspectRatio || 0}
                onChange={(e) => handleAspectRatioChange(parseFloat(e.target.value))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {ASPECT_RATIOS.map((ratio) => (
                  <option key={ratio.value} value={ratio.value}>
                    {ratio.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Width {gridInfo && <span className="text-purple-400">(Grid)</span>}
                </label>
                <input
                  type="number"
                  value={Math.round(selectedCrop.width)}
                  onChange={(e) => {
                    const width = parseInt(e.target.value);
                    const updates: Partial<CropArea> = { width };
                    if (selectedCrop.aspectRatio) {
                      updates.height = width / selectedCrop.aspectRatio;
                    }
                    handleCropUpdate(updates);
                  }}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Height {gridInfo && <span className="text-purple-400">(Grid)</span>}
                </label>
                <input
                  type="number"
                  value={Math.round(selectedCrop.height)}
                  onChange={(e) => {
                    const height = parseInt(e.target.value);
                    const updates: Partial<CropArea> = { height };
                    if (selectedCrop.aspectRatio) {
                      updates.width = height * selectedCrop.aspectRatio;
                    }
                    handleCropUpdate(updates);
                  }}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  min="1"
                />
              </div>
            </div>

            {/* Position */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">X Position</label>
                <input
                  type="number"
                  value={Math.round(selectedCrop.x)}
                  onChange={(e) => onUpdateCrop(selectedCrop.id, { x: parseInt(e.target.value) })}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Y Position</label>
                <input
                  type="number"
                  value={Math.round(selectedCrop.y)}
                  onChange={(e) => onUpdateCrop(selectedCrop.id, { y: parseInt(e.target.value) })}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};