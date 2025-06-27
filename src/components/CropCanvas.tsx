import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CropArea } from '../App';

interface CropCanvasProps {
  imageUrl: string;
  originalImage: HTMLImageElement | null;
  cropAreas: CropArea[];
  selectedCropId: string | null;
  onCropSelect: (id: string | null) => void;
  onCropUpdate: (id: string, updates: Partial<CropArea>) => void;
  onCropAdd: (crop: Omit<CropArea, 'id'>) => void;
  imageScale: number;
  imageOffset: { x: number; y: number };
  onImageTransform: (transform: { scale: number; offset: { x: number; y: number } }) => void;
  onCanvasResize: (size: { width: number; height: number }) => void;
}

export const CropCanvas: React.FC<CropCanvasProps> = ({
  imageUrl,
  originalImage,
  cropAreas,
  selectedCropId,
  onCropSelect,
  onCropUpdate,
  onCropAdd,
  imageScale,
  imageOffset,
  onImageTransform,
  onCanvasResize
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState<{ cropId: string; handle: string } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [lastPanOffset, setLastPanOffset] = useState({ x: 0, y: 0 });
  const [isCreatingCrop, setIsCreatingCrop] = useState(false);
  const [newCropStart, setNewCropStart] = useState({ x: 0, y: 0 });
  const [newCropEnd, setNewCropEnd] = useState({ x: 0, y: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !originalImage) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw checkerboard background
    const checkSize = 20;
    ctx.fillStyle = '#374151';
    for (let x = 0; x < canvas.width; x += checkSize) {
      for (let y = 0; y < canvas.height; y += checkSize) {
        if ((Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0) {
          ctx.fillRect(x, y, checkSize, checkSize);
        }
      }
    }

    // Draw image
    const imgWidth = originalImage.width * imageScale;
    const imgHeight = originalImage.height * imageScale;
    
    ctx.drawImage(
      originalImage,
      imageOffset.x,
      imageOffset.y,
      imgWidth,
      imgHeight
    );

    // Draw crop areas
    cropAreas.forEach(crop => {
      const isSelected = crop.id === selectedCropId;
      
      // Draw crop rectangle
      ctx.strokeStyle = isSelected ? '#3B82F6' : '#10B981';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [] : [5, 5]);
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

      // Draw overlay
      ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.05)';
      ctx.fillRect(crop.x, crop.y, crop.width, crop.height);

      // Draw resize handles for selected crop
      if (isSelected) {
        const handleSize = 10;
        ctx.fillStyle = '#3B82F6';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        
        // Corner handles
        const handles = [
          { x: crop.x - handleSize/2, y: crop.y - handleSize/2 }, // top-left
          { x: crop.x + crop.width - handleSize/2, y: crop.y - handleSize/2 }, // top-right
          { x: crop.x - handleSize/2, y: crop.y + crop.height - handleSize/2 }, // bottom-left
          { x: crop.x + crop.width - handleSize/2, y: crop.y + crop.height - handleSize/2 }, // bottom-right
        ];
        
        handles.forEach(handle => {
          ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
          ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
        });

        // Edge handles
        const edgeHandles = [
          { x: crop.x + crop.width/2 - handleSize/2, y: crop.y - handleSize/2 }, // top
          { x: crop.x + crop.width/2 - handleSize/2, y: crop.y + crop.height - handleSize/2 }, // bottom
          { x: crop.x - handleSize/2, y: crop.y + crop.height/2 - handleSize/2 }, // left
          { x: crop.x + crop.width - handleSize/2, y: crop.y + crop.height/2 - handleSize/2 }, // right
        ];
        
        edgeHandles.forEach(handle => {
          ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
          ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
        });
      }

      // Draw label with background
      if (crop.name) {
        ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        const textWidth = ctx.measureText(crop.name).width;
        const padding = 8;
        
        // Label background
        ctx.fillStyle = isSelected ? '#3B82F6' : '#10B981';
        ctx.fillRect(crop.x, crop.y - 28, textWidth + padding * 2, 24);
        
        // Label text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(crop.name, crop.x + padding, crop.y - 8);
      }
    });

    // Draw new crop being created
    if (isCreatingCrop) {
      const x = Math.min(newCropStart.x, newCropEnd.x);
      const y = Math.min(newCropStart.y, newCropEnd.y);
      const width = Math.abs(newCropEnd.x - newCropStart.x);
      const height = Math.abs(newCropEnd.y - newCropStart.y);

      if (width > 5 && height > 5) {
        // Draw dashed rectangle for new crop
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(x, y, width, height);

        // Draw semi-transparent overlay
        ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
        ctx.fillRect(x, y, width, height);

        // Draw dimensions label
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x + 5, y + 5, 80, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(`${Math.round(width)} × ${Math.round(height)}`, x + 10, y + 18);
      }
    }
  }, [originalImage, imageScale, imageOffset, cropAreas, selectedCropId, isCreatingCrop, newCropStart, newCropEnd]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      onCanvasResize({ width: rect.width, height: rect.height });
      draw();
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [draw, onCanvasResize]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const getCropAt = (x: number, y: number) => {
    // Check from top to bottom (reverse order) to prioritize top crops
    for (let i = cropAreas.length - 1; i >= 0; i--) {
      const crop = cropAreas[i];
      if (x >= crop.x && x <= crop.x + crop.width &&
          y >= crop.y && y <= crop.y + crop.height) {
        return crop;
      }
    }
    return null;
  };

  const getResizeHandle = (x: number, y: number, crop: CropArea) => {
    const handleSize = 10;
    const handles = [
      { name: 'tl', x: crop.x - handleSize/2, y: crop.y - handleSize/2 },
      { name: 'tr', x: crop.x + crop.width - handleSize/2, y: crop.y - handleSize/2 },
      { name: 'bl', x: crop.x - handleSize/2, y: crop.y + crop.height - handleSize/2 },
      { name: 'br', x: crop.x + crop.width - handleSize/2, y: crop.y + crop.height - handleSize/2 },
      { name: 't', x: crop.x + crop.width/2 - handleSize/2, y: crop.y - handleSize/2 },
      { name: 'b', x: crop.x + crop.width/2 - handleSize/2, y: crop.y + crop.height - handleSize/2 },
      { name: 'l', x: crop.x - handleSize/2, y: crop.y + crop.height/2 - handleSize/2 },
      { name: 'r', x: crop.x + crop.width - handleSize/2, y: crop.y + crop.height/2 - handleSize/2 },
    ];

    return handles.find(handle => 
      x >= handle.x && x <= handle.x + handleSize &&
      y >= handle.y && y <= handle.y + handleSize
    )?.name;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    const selectedCrop = cropAreas.find(crop => crop.id === selectedCropId);
    
    // Check for resize handles first
    if (selectedCrop) {
      const handle = getResizeHandle(pos.x, pos.y, selectedCrop);
      if (handle) {
        setResizing({ cropId: selectedCrop.id, handle });
        return;
      }
    }

    // Check for crop selection
    const cropAtPos = getCropAt(pos.x, pos.y);
    if (cropAtPos) {
      onCropSelect(cropAtPos.id);
      setIsDragging(true);
      setDragStart(pos);
    } else {
      // Start creating new crop or panning
      onCropSelect(null);
      if (e.button === 0) { // Left mouse button
        // Check if we're over the image area to decide between creating crop or panning
        const imgWidth = originalImage ? originalImage.width * imageScale : 0;
        const imgHeight = originalImage ? originalImage.height * imageScale : 0;
        const isOverImage = pos.x >= imageOffset.x && pos.x <= imageOffset.x + imgWidth &&
                           pos.y >= imageOffset.y && pos.y <= imageOffset.y + imgHeight;
        
        if (isOverImage) {
          // Start creating new crop
          setIsCreatingCrop(true);
          setNewCropStart(pos);
          setNewCropEnd(pos);
        } else {
          // Start panning
          setIsPanning(true);
          setPanStart(pos);
          setLastPanOffset(imageOffset);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    
    if (resizing) {
      const crop = cropAreas.find(c => c.id === resizing.cropId);
      if (!crop) return;

      let newCrop = { ...crop };
      
      switch (resizing.handle) {
        case 'tl':
          newCrop.width = crop.width + (crop.x - pos.x);
          newCrop.height = crop.height + (crop.y - pos.y);
          newCrop.x = pos.x;
          newCrop.y = pos.y;
          break;
        case 'tr':
          newCrop.width = pos.x - crop.x;
          newCrop.height = crop.height + (crop.y - pos.y);
          newCrop.y = pos.y;
          break;
        case 'bl':
          newCrop.width = crop.width + (crop.x - pos.x);
          newCrop.height = pos.y - crop.y;
          newCrop.x = pos.x;
          break;
        case 'br':
          newCrop.width = pos.x - crop.x;
          newCrop.height = pos.y - crop.y;
          break;
        case 't':
          newCrop.height = crop.height + (crop.y - pos.y);
          newCrop.y = pos.y;
          break;
        case 'b':
          newCrop.height = pos.y - crop.y;
          break;
        case 'l':
          newCrop.width = crop.width + (crop.x - pos.x);
          newCrop.x = pos.x;
          break;
        case 'r':
          newCrop.width = pos.x - crop.x;
          break;
      }

      // Maintain aspect ratio if set
      if (crop.aspectRatio && crop.aspectRatio > 0) {
        if (['br', 'tl'].includes(resizing.handle)) {
          newCrop.height = newCrop.width / crop.aspectRatio;
        } else if (['tr', 'bl'].includes(resizing.handle)) {
          newCrop.width = newCrop.height * crop.aspectRatio;
        }
      }

      // Ensure minimum size
      newCrop.width = Math.max(20, newCrop.width);
      newCrop.height = Math.max(20, newCrop.height);

      onCropUpdate(crop.id, newCrop);
    } else if (isDragging && selectedCropId) {
      const crop = cropAreas.find(c => c.id === selectedCropId);
      if (crop) {
        const deltaX = pos.x - dragStart.x;
        const deltaY = pos.y - dragStart.y;
        
        onCropUpdate(crop.id, {
          x: crop.x + deltaX,
          y: crop.y + deltaY
        });
        
        setDragStart(pos);
      }
    } else if (isCreatingCrop) {
      setNewCropEnd(pos);
    } else if (isPanning) {
      const deltaX = pos.x - panStart.x;
      const deltaY = pos.y - panStart.y;
      
      onImageTransform({
        scale: imageScale,
        offset: {
          x: lastPanOffset.x + deltaX,
          y: lastPanOffset.y + deltaY
        }
      });
    }

    // Update cursor based on context
    const canvas = canvasRef.current;
    if (canvas) {
      const selectedCrop = cropAreas.find(crop => crop.id === selectedCropId);
      if (selectedCrop && getResizeHandle(pos.x, pos.y, selectedCrop)) {
        canvas.style.cursor = 'nw-resize';
      } else if (getCropAt(pos.x, pos.y)) {
        canvas.style.cursor = 'move';
      } else if (isCreatingCrop) {
        canvas.style.cursor = 'crosshair';
      } else {
        canvas.style.cursor = isPanning ? 'grabbing' : 'grab';
      }
    }
  };

  const handleMouseUp = () => {
    // Handle crop creation completion
    if (isCreatingCrop) {
      const x = Math.min(newCropStart.x, newCropEnd.x);
      const y = Math.min(newCropStart.y, newCropEnd.y);
      const width = Math.abs(newCropEnd.x - newCropStart.x);
      const height = Math.abs(newCropEnd.y - newCropStart.y);

      // Only create crop if it's large enough
      if (width > 20 && height > 20) {
        const newCrop: Omit<CropArea, 'id'> = {
          x,
          y,
          width,
          height,
          name: `Crop ${cropAreas.length + 1}`
        };
        onCropAdd(newCrop);
      }

      setIsCreatingCrop(false);
      setNewCropStart({ x: 0, y: 0 });
      setNewCropEnd({ x: 0, y: 0 });
    }

    setIsDragging(false);
    setResizing(null);
    setIsPanning(false);
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'grab';
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getMousePos(e);
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, imageScale * delta));
    
    // Zoom towards mouse position
    const newOffset = {
      x: pos.x - (pos.x - imageOffset.x) * (newScale / imageScale),
      y: pos.y - (pos.y - imageOffset.y) * (newScale / imageScale)
    };
    
    onImageTransform({ scale: newScale, offset: newOffset });
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: 'grab' }}
      />
      
      {cropAreas.length === 0 && !isCreatingCrop && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-800/90 rounded-lg p-8 text-center max-w-md">
            <h3 className="text-xl font-semibold text-white mb-3">Ready to Crop!</h3>
            <p className="text-gray-300 mb-2">Click and drag on the image to create a crop area</p>
            <p className="text-sm text-gray-400">
              • Drag on image to create crops<br/>
              • Drag crops to move them<br/>
              • Scroll to zoom<br/>
              • Drag empty space to pan
            </p>
          </div>
        </div>
      )}

      {/* Instructions overlay */}
      <div className="absolute top-4 right-4 bg-gray-800/90 rounded-lg p-3 text-xs text-gray-300 max-w-48">
        <div className="space-y-1">
          <div>🖱️ <strong>Drag on image:</strong> Create crop</div>
          <div>✋ <strong>Drag crop:</strong> Move crop</div>
          <div>🔄 <strong>Scroll:</strong> Zoom in/out</div>
          <div>✋ <strong>Drag empty:</strong> Pan image</div>
          <div>📐 <strong>Handles:</strong> Resize crop</div>
        </div>
      </div>
    </div>
  );
};