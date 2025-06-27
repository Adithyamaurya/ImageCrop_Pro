import React, { useState, useRef, useEffect } from 'react';
import { CropCanvas } from './CropCanvas';
import { CropControls } from './CropControls';
import { ExportPanel } from './ExportPanel';
import { AdvancedCropEditor } from './AdvancedCropEditor';
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
        id: `crop-${Date.now()}`
      };
    } else {
      // Create default crop in center
      const centerX = canvasSize.width / 2 - 100;
      const centerY = canvasSize.height / 2 - 100;
      
      newCrop = {
        id: `crop-${Date.now()}`,
        x: Math.max(50, centerX),
        y: Math.max(50, centerY),
        width: 200,
        height: 200,
        aspectRatio: 1,
        rotation: 0,
        name: `Crop ${cropAreas.length + 1}`
      };
    }
    
    setCropAreas([...cropAreas, newCrop]);
    setSelectedCropId(newCrop.id);
  };

  const copyCropStyle = (sourceCropId: string) => {
    const sourceCrop = cropAreas.find(crop => crop.id === sourceCropId);
    if (!sourceCrop) return;

    // Create a new crop with the same dimensions, aspect ratio, and rotation but different position
    const offset = 30; // Offset to avoid overlapping
    const newCrop: CropArea = {
      id: `crop-${Date.now()}`,
      x: sourceCrop.x + offset,
      y: sourceCrop.y + offset,
      width: sourceCrop.width,
      height: sourceCrop.height,
      aspectRatio: sourceCrop.aspectRatio,
      rotation: sourceCrop.rotation || 0,
      name: `${sourceCrop.name} Copy`
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
      updateCropArea(advancedEditingCrop.id, updates);
      setAdvancedEditingCrop(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const selectedCrop = cropAreas.find(crop => crop.id === selectedCropId);

  return (
    <>
      <div className="flex h-[calc(100vh-80px)]">
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
          />
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 bg-gray-800 relative overflow-hidden">
          <CropCanvas
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
        />
      )}
    </>
  );
};