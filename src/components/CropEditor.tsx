import React, { useState, useRef, useEffect } from 'react';
import { ViewportAwareCropCanvas } from './ViewportAwareCropCanvas';
import { CropControls } from './CropControls';
import { ExportPanel } from './ExportPanel';
import { AdvancedCropEditor } from './AdvancedCropEditor';
import { UndoRedoControls } from './UndoRedoControls';
import { CropArea } from '../App';
import { useUndoRedo } from '../hooks/useUndoRedo';

interface CropEditorProps {
  imageUrl: string;
  originalImage: HTMLImageElement | null;
  onReset: () => void;
  onUndoRedoActionsReady?: (actions: any) => void;
}

interface EditorState {
  cropAreas: CropArea[];
  selectedCropId: string | null;
  imageScale: number;
  imageOffset: { x: number; y: number };
}

export const CropEditor: React.FC<CropEditorProps> = ({ 
  imageUrl, 
  originalImage, 
  onReset,
  onUndoRedoActionsReady
}) => {
  const initialState: EditorState = {
    cropAreas: [],
    selectedCropId: null,
    imageScale: 1,
    imageOffset: { x: 0, y: 0 }
  };

  const [editorState, undoRedoActions] = useUndoRedo<EditorState>(initialState);
  const { cropAreas, selectedCropId, imageScale, imageOffset } = editorState;

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [advancedEditorOpen, setAdvancedEditorOpen] = useState(false);
  const [advancedEditingCrop, setAdvancedEditingCrop] = useState<CropArea | null>(null);
  const [editingCropName, setEditingCropName] = useState<string | null>(null);

  // Track if we're in the middle of an interaction to avoid pushing every small change
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout>();

  // Pass undo/redo actions to parent for global shortcuts
  useEffect(() => {
    if (onUndoRedoActionsReady) {
      onUndoRedoActionsReady(undoRedoActions);
    }
  }, [undoRedoActions, onUndoRedoActionsReady]);

  // Helper function to update state and manage history
  const updateEditorState = (updates: Partial<EditorState>, forceHistory = false) => {
    const newState = { ...editorState, ...updates };
    
    if (forceHistory || !isInteracting) {
      (undoRedoActions as any).forcePush(newState);
    } else {
      undoRedoActions.push(newState);
    }
  };

  // Debounced function to end interaction and force history push
  const endInteraction = () => {
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
      // Force push the current state to history when interaction ends
      (undoRedoActions as any).forcePush(editorState);
    }, 300);
  };

  // Start interaction (prevents history spam during dragging/resizing)
  const startInteraction = () => {
    setIsInteracting(true);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
  };

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
      
      const newImageState = {
        imageScale: scale,
        imageOffset: {
          x: (canvasSize.width - scaledWidth) / 2,
          y: (canvasSize.height - scaledHeight) / 2
        }
      };
      
      updateEditorState(newImageState, true);
    }
  }, [originalImage, canvasSize]);

  // Reset undo/redo history when image changes
  useEffect(() => {
    undoRedoActions.reset(initialState);
  }, [imageUrl]);

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
    
    updateEditorState({
      cropAreas: [...cropAreas, newCrop],
      selectedCropId: newCrop.id
    }, true);
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
    updateEditorState({
      cropAreas: [...cropAreas, ...newCrops],
      selectedCropId: newCrops.length > 0 ? newCrops[0].id : selectedCropId
    }, true);
  };

  const updateGridCrops = (gridId: string, updates: Partial<CropArea>) => {
    startInteraction();
    
    const updatedCrops = cropAreas.map(crop => {
      if (crop.gridId === gridId) {
        const updatedCrop = { ...crop, ...updates };
        
        // For grid crops, maintain relative positioning when resizing
        if (updates.width !== undefined || updates.height !== undefined) {
          const gridCrops = cropAreas.filter(c => c.gridId === gridId);
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
    });
    
    updateEditorState({ cropAreas: updatedCrops });
    endInteraction();
  };

  const unlinkFromGrid = (cropId: string) => {
    const updatedCrops = cropAreas.map(crop => 
      crop.id === cropId 
        ? { ...crop, gridId: undefined, gridPosition: undefined }
        : crop
    );
    
    updateEditorState({ cropAreas: updatedCrops }, true);
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

    updateEditorState({
      cropAreas: [...cropAreas, newCrop],
      selectedCropId: newCrop.id
    }, true);
  };

  const updateCropArea = (id: string, updates: Partial<CropArea>) => {
    startInteraction();
    
    const updatedCrops = cropAreas.map(crop => 
      crop.id === id ? { ...crop, ...updates } : crop
    );
    
    updateEditorState({ cropAreas: updatedCrops });
    endInteraction();
  };

  const deleteCropArea = (id: string) => {
    const updatedCrops = cropAreas.filter(crop => crop.id !== id);
    const newSelectedId = selectedCropId === id ? null : selectedCropId;
    
    updateEditorState({
      cropAreas: updatedCrops,
      selectedCropId: newSelectedId
    }, true);
  };

  const selectCrop = (id: string | null) => {
    updateEditorState({ selectedCropId: id });
  };

  const handleImageTransform = (transform: { scale: number; offset: { x: number; y: number } }) => {
    startInteraction();
    
    updateEditorState({
      imageScale: transform.scale,
      imageOffset: transform.offset
    });
    
    endInteraction();
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
      selectCrop(cropId);
    }
  };

  // Context menu handlers
  const handleCropExport = (cropId: string) => {
    console.log('Export crop:', cropId);
  };

  const selectedCrop = cropAreas.find(crop => crop.id === selectedCropId);

  return (
    <>
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Sidebar - Crop Tools */}
        <div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col">
          {/* Undo/Redo Controls */}
          <UndoRedoControls
            canUndo={undoRedoActions.canUndo}
            canRedo={undoRedoActions.canRedo}
            onUndo={undoRedoActions.undo}
            onRedo={undoRedoActions.redo}
            onClearHistory={undoRedoActions.clear}
          />
          
          <CropControls
            cropAreas={cropAreas}
            selectedCrop={selectedCrop}
            onAddCrop={() => addCropArea()}
            onUpdateCrop={updateCropArea}
            onDeleteCrop={deleteCropArea}
            onSelectCrop={selectCrop}
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
            onCropSelect={selectCrop}
            onCropUpdate={updateCropArea}
            onCropAdd={addCropArea}
            imageScale={imageScale}
            imageOffset={imageOffset}
            onImageTransform={handleImageTransform}
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
    </>
  );
};