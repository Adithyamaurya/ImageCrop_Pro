import React, { useState, useRef, useEffect } from 'react';
import { ViewportAwareCropCanvas } from './ViewportAwareCropCanvas';
import { CropControls } from './CropControls';
import { ExportPanel } from './ExportPanel';
import { AdvancedCropEditor } from './AdvancedCropEditor';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { CropArea } from '../App';

interface CropEditorProps {
  imageUrl: string;
  originalImage: HTMLImageElement | null;
  onReset: () => void;
}

export const CropEditor: React.FC<CropEditorProps> = ({ 
  imageUrl, 
  originalImage, 
  onReset 
}) => {
  const [cropAreas, setCropAreas] = useState<CropArea[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [advancedEditorOpen, setAdvancedEditorOpen] = useState(false);
  const [advancedEditingCrop, setAdvancedEditingCrop] = useState<CropArea | null>(null);
  const [editingCropName, setEditingCropName] = useState<string | null>(null);
  const [selectedCrops, setSelectedCrops] = useState<Set<string>>(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'crops' | 'export'>('crops');

  // Initialize image position when image loads
  useEffect(() => {
    if (originalImage && canvasSize.width > 0 && canvasSize.height > 0) {
      const imgAspect = originalImage.width / originalImage.height;
      const canvasAspect = canvasSize.width / canvasSize.height;
      
      let scale = 1;
      if (imgAspect > canvasAspect) {
        scale = (canvasSize.width * 0.8) / originalImage.width;
      } else {
        scale = (canvasSize.height * 0.8) / originalImage.height;
      }
      
      const scaledWidth = originalImage.width * scale;
      const scaledHeight = originalImage.height * scale;
      
      setImageScale(scale);
      setImageOffset({
        x: (canvasSize.width - scaledWidth) / 2,
        y: (canvasSize.height - scaledHeight) / 2
      });
    }
  }, [originalImage, canvasSize]);

  const addCropArea = (cropData?: Omit<CropArea, 'id'>) => {
    let newCrop: CropArea;
    
    if (cropData) {
      // Use provided crop data (from drag creation)
      newCrop = {
        ...cropData,
        id: `crop-${Date.now()}`,
        visible: true,
        zIndex: cropAreas.length
      };
    } else {
      // Create default crop in center, ensuring it stays within viewport
      const centerX = Math.max(100, Math.min(canvasSize.width / 2 - 100, canvasSize.width - 300));
      const centerY = Math.max(100, Math.min(canvasSize.height / 2 - 100, canvasSize.height - 300));
      
      newCrop = {
        id: `crop-${Date.now()}`,
        x: centerX,
        y: centerY,
        width: 200,
        height: 200,
        aspectRatio: 1,
        rotation: 0,
        name: `Crop ${cropAreas.length + 1}`,
        visible: true,
        zIndex: cropAreas.length
      };
    }
    
    setCropAreas([...cropAreas, newCrop]);
    setSelectedCropId(newCrop.id);
  };

  const addMultipleCrops = (rows: number, cols: number, startX: number, startY: number, cropSize: number = 150, spacing: number = 0) => {
    const newCrops: CropArea[] = [];
    
    // Generate unique grid ID
    const gridId = `grid-${Date.now()}`;
    
    // Calculate total grid dimensions
    const totalGridWidth = cols * cropSize + (cols - 1) * spacing;
    const totalGridHeight = rows * cropSize + (rows - 1) * spacing;
    
    // Adjust starting position if grid would extend beyond canvas
    const adjustedStartX = Math.min(startX, Math.max(50, canvasSize.width - totalGridWidth - 50));
    const adjustedStartY = Math.min(startY, Math.max(50, canvasSize.height - totalGridHeight - 50));
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cropX = adjustedStartX + (col * (cropSize + spacing));
        const cropY = adjustedStartY + (row * (cropSize + spacing));
        
        const newCrop: CropArea = {
          id: `grid-crop-${Date.now()}-${row}-${col}`,
          x: cropX,
          y: cropY,
          width: cropSize,
          height: cropSize,
          aspectRatio: 1, // Square crops by default
          rotation: 0,
          name: `Grid_R${rows}C${cols}_${row + 1}_${col + 1}`,
          gridId: gridId,
          gridPosition: { row, col },
          visible: true,
          zIndex: cropAreas.length + newCrops.length
        };
        
        newCrops.push(newCrop);
      }
    }
    
    // Add all crops at once
    setCropAreas(prev => [...prev, ...newCrops]);
    
    // Select the first crop in the grid
    if (newCrops.length > 0) {
      setSelectedCropId(newCrops[0].id);
    }
  };

  const updateGridCrops = (gridId: string, updates: Partial<CropArea>) => {
    setCropAreas(crops => 
      crops.map(crop => {
        if (crop.gridId === gridId) {
          const updatedCrop = { ...crop, ...updates };
          
          // For grid crops, maintain relative positioning when resizing
          if (updates.width !== undefined || updates.height !== undefined) {
            const gridCrops = crops.filter(c => c.gridId === gridId);
            const firstCrop = gridCrops.find(c => c.gridPosition?.row === 0 && c.gridPosition?.col === 0);
            
            if (firstCrop && crop.gridPosition) {
              const newWidth = updates.width || crop.width;
              const newHeight = updates.height || crop.height;
              const spacing = 0; // No spacing for perfect alignment
              
              updatedCrop.x = firstCrop.x + (crop.gridPosition.col * (newWidth + spacing));
              updatedCrop.y = firstCrop.y + (crop.gridPosition.row * (newHeight + spacing));
            }
          }
          
          return updatedCrop;
        }
        return crop;
      })
    );
  };

  const unlinkFromGrid = (cropId: string) => {
    setCropAreas(crops => 
      crops.map(crop => 
        crop.id === cropId 
          ? { ...crop, gridId: undefined, gridPosition: undefined }
          : crop
      )
    );
  };

  const copyCropStyle = (sourceCropId: string) => {
    const sourceCrop = cropAreas.find(crop => crop.id === sourceCropId);
    if (!sourceCrop) return;

    // Create a new crop with the same dimensions, aspect ratio, and rotation but different position
    const offset = 30; // Offset to avoid overlapping
    
    // Ensure the copied crop stays within reasonable bounds
    const newX = Math.min(sourceCrop.x + offset, canvasSize.width - sourceCrop.width - 50);
    const newY = Math.min(sourceCrop.y + offset, canvasSize.height - sourceCrop.height - 50);
    
    const maxZIndex = Math.max(...cropAreas.map(c => c.zIndex || 0));
    
    const newCrop: CropArea = {
      id: `crop-${Date.now()}`,
      x: Math.max(50, newX),
      y: Math.max(50, newY),
      width: sourceCrop.width,
      height: sourceCrop.height,
      aspectRatio: sourceCrop.aspectRatio,
      rotation: sourceCrop.rotation || 0,
      name: `${sourceCrop.name} Copy`,
      visible: true,
      zIndex: maxZIndex + 1
      // Note: Don't copy gridId or gridPosition for individual copies
    };

    setCropAreas([...cropAreas, newCrop]);
    setSelectedCropId(newCrop.id);
  };

  const updateCropArea = (id: string, updates: Partial<CropArea>) => {
    setCropAreas(crops => 
      crops.map(crop => 
        crop.id === id ? { ...crop, ...updates } : crop
      )
    );
  };

  const deleteCropArea = (id: string) => {
    setCropAreas(crops => crops.filter(crop => crop.id !== id));
    if (selectedCropId === id) {
      setSelectedCropId(null);
    }
    // Remove from selected crops if it was selected
    setSelectedCrops(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleCropDoubleClick = (cropId: string) => {
    const crop = cropAreas.find(c => c.id === cropId);
    if (crop) {
      setAdvancedEditingCrop(crop);
      setAdvancedEditorOpen(true);
    }
  };

  const handleAdvancedCropUpdate = (updates: Partial<CropArea>) => {
    if (advancedEditingCrop) {
      if (advancedEditingCrop.gridId) {
        updateGridCrops(advancedEditingCrop.gridId, updates);
      } else {
        updateCropArea(advancedEditingCrop.id, updates);
      }
      setAdvancedEditingCrop(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleSwitchCrop = (cropId: string) => {
    const crop = cropAreas.find(c => c.id === cropId);
    if (crop) {
      setAdvancedEditingCrop(crop);
      setSelectedCropId(cropId);
    }
  };

  // Export functions for keyboard shortcuts
  const handleExportAll = async () => {
    // This would trigger export of all crops
    console.log('Export all crops');
  };

  const handleExportSelected = async () => {
    // This would trigger export of selected crops
    console.log('Export selected crops:', Array.from(selectedCrops));
  };

  // Context menu handlers
  const handleCropExport = (cropId: string) => {
    console.log('Export crop:', cropId);
  };

  const selectedCrop = cropAreas.find(crop => crop.id === selectedCropId);

  // Set up keyboard shortcuts
  const { shortcuts } = useKeyboardShortcuts({
    cropAreas,
    selectedCropId,
    onCropSelect: setSelectedCropId,
    onCropUpdate: updateCropArea,
    onCropDelete: deleteCropArea,
    onCropCopy: copyCropStyle,
    onAddCrop: () => addCropArea(),
    onCropDoubleClick: handleCropDoubleClick,
    onUpdateGridCrops: updateGridCrops,
    onUnlinkFromGrid: unlinkFromGrid,
    onExportAll: handleExportAll,
    onExportSelected: handleExportSelected,
    onReset,
    isAdvancedEditorOpen: advancedEditorOpen,
    onCloseAdvancedEditor: () => {
      setAdvancedEditorOpen(false);
      setAdvancedEditingCrop(null);
    }
  });

  // Handle ? key for help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !advancedEditorOpen) {
        e.preventDefault();
        // Toggle help - this would be handled by KeyboardShortcutsHelp component
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [advancedEditorOpen]);

  return (
    <>
      {/* Desktop Layout (unchanged) */}
      <div className="hidden lg:flex h-[calc(100vh-80px)]">
        {/* Left Sidebar - Crop Tools */}
        <div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col">
          <CropControls
            cropAreas={cropAreas}
            selectedCrop={selectedCrop}
            onAddCrop={() => addCropArea()}
            onUpdateCrop={updateCropArea}
            onDeleteCrop={deleteCropArea}
            onSelectCrop={setSelectedCropId}
            onCopyCropStyle={copyCropStyle}
            onAddMultipleCrops={addMultipleCrops}
            onUpdateGridCrops={updateGridCrops}
            onUnlinkFromGrid={unlinkFromGrid}
            editingCropName={editingCropName}
            onSetEditingCropName={setEditingCropName}
          />
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 bg-gray-800 relative overflow-hidden">
          <ViewportAwareCropCanvas
            imageUrl={imageUrl}
            originalImage={originalImage}
            cropAreas={cropAreas}
            selectedCropId={selectedCropId}
            onCropSelect={setSelectedCropId}
            onCropUpdate={updateCropArea}
            onCropAdd={addCropArea}
            imageScale={imageScale}
            imageOffset={imageOffset}
            onImageTransform={({ scale, offset }) => {
              setImageScale(scale);
              setImageOffset(offset);
            }}
            onCanvasResize={setCanvasSize}
            onCropDoubleClick={handleCropDoubleClick}
            onUpdateGridCrops={updateGridCrops}
            onCropDelete={deleteCropArea}
            onCropCopy={copyCropStyle}
            onCropRename={(cropId) => setEditingCropName(cropId)}
            onUnlinkFromGrid={unlinkFromGrid}
            onCropExport={handleCropExport}
          />
        </div>

        {/* Right Sidebar - Export Panel */}
        <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col">
          <ExportPanel
            originalImage={originalImage}
            cropAreas={cropAreas}
            imageScale={imageScale}
            imageOffset={imageOffset}
            canvasSize={canvasSize}
          />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col h-[calc(100vh-80px)]">
        {/* Main Canvas Area - Full height on mobile */}
        <div className="flex-1 bg-gray-800 relative overflow-hidden">
          <ViewportAwareCropCanvas
            imageUrl={imageUrl}
            originalImage={originalImage}
            cropAreas={cropAreas}
            selectedCropId={selectedCropId}
            onCropSelect={setSelectedCropId}
            onCropUpdate={updateCropArea}
            onCropAdd={addCropArea}
            imageScale={imageScale}
            imageOffset={imageOffset}
            onImageTransform={({ scale, offset }) => {
              setImageScale(scale);
              setImageOffset(offset);
            }}
            onCanvasResize={setCanvasSize}
            onCropDoubleClick={handleCropDoubleClick}
            onUpdateGridCrops={updateGridCrops}
            onCropDelete={deleteCropArea}
            onCropCopy={copyCropStyle}
            onCropRename={(cropId) => setEditingCropName(cropId)}
            onUnlinkFromGrid={unlinkFromGrid}
            onCropExport={handleCropExport}
          />
        </div>

        {/* Mobile Bottom Panel */}
        <div className="bg-gray-900 border-t border-gray-700">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveMobileTab('crops')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeMobileTab === 'crops'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Crop Tools ({cropAreas.length})
            </button>
            <button
              onClick={() => setActiveMobileTab('export')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeMobileTab === 'export'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Export
            </button>
          </div>

          {/* Tab Content */}
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {activeMobileTab === 'crops' ? (
              <div className="p-4">
                <CropControls
                  cropAreas={cropAreas}
                  selectedCrop={selectedCrop}
                  onAddCrop={() => addCropArea()}
                  onUpdateCrop={updateCropArea}
                  onDeleteCrop={deleteCropArea}
                  onSelectCrop={setSelectedCropId}
                  onCopyCropStyle={copyCropStyle}
                  onAddMultipleCrops={addMultipleCrops}
                  onUpdateGridCrops={updateGridCrops}
                  onUnlinkFromGrid={unlinkFromGrid}
                  editingCropName={editingCropName}
                  onSetEditingCropName={setEditingCropName}
                />
              </div>
            ) : (
              <div className="p-4">
                <ExportPanel
                  originalImage={originalImage}
                  cropAreas={cropAreas}
                  imageScale={imageScale}
                  imageOffset={imageOffset}
                  canvasSize={canvasSize}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Crop Editor Modal */}
      {advancedEditingCrop && (
        <AdvancedCropEditor
          isOpen={advancedEditorOpen}
          onClose={() => {
            setAdvancedEditorOpen(false);
            setAdvancedEditingCrop(null);
          }}
          crop={advancedEditingCrop}
          originalImage={originalImage}
          onUpdateCrop={handleAdvancedCropUpdate}
          imageScale={imageScale}
          imageOffset={imageOffset}
          allCrops={cropAreas}
          onSwitchCrop={handleSwitchCrop}
        />
      )}

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp shortcuts={shortcuts} />
    </>
  );
};