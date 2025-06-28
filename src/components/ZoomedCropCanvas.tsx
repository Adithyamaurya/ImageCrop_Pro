import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CropArea } from '../App';

interface ZoomedCropCanvasProps {
  imageUrl: string;
  originalImage: HTMLImageElement | null;
  crop: CropArea;
  onCropUpdate: (updates: Partial<CropArea>) => void;
  imageScale: number;
  imageOffset: { x: number; y: number };
  className?: string;
}

interface SizeIndicator {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export const ZoomedCropCanvas: React.FC<ZoomedCropCanvasProps> = ({
  imageUrl,
  originalImage,
  crop,
  onCropUpdate,
  imageScale,
  imageOffset,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Zoom and pan state
  const [zoomLevel, setZoomLevel] = useState(2); // Start with 2x zoom for pixel precision
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  
  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [originalCropState, setOriginalCropState] = useState<CropArea | null>(null);
  
  // Size indicator state
  const [sizeIndicator, setSizeIndicator] = useState<SizeIndicator>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false
  });

  // Calculate the visible area around the crop
  const getVisibleArea = useCallback(() => {
    if (!originalImage || !crop) return { x: 0, y: 0, width: 0, height: 0 };
    
    // Expand the visible area around the crop for context
    const contextPadding = Math.min(crop.width, crop.height) * 0.5;
    
    return {
      x: Math.max(0, crop.x - contextPadding),
      y: Math.max(0, crop.y - contextPadding),
      width: Math.min(originalImage.width * imageScale, crop.width + contextPadding * 2),
      height: Math.min(originalImage.height * imageScale, crop.height + contextPadding * 2)
    };
  }, [originalImage, crop, imageScale]);

  // Convert canvas coordinates to crop coordinates
  const canvasToCropCoords = useCallback((canvasX: number, canvasY: number) => {
    const visibleArea = getVisibleArea();
    
    // Account for zoom and pan
    const adjustedX = (canvasX - panOffset.x) / zoomLevel;
    const adjustedY = (canvasY - panOffset.y) / zoomLevel;
    
    // Convert to crop coordinate space
    const cropX = visibleArea.x + adjustedX;
    const cropY = visibleArea.y + adjustedY;
    
    return { x: cropX, y: cropY };
  }, [getVisibleArea, zoomLevel, panOffset]);

  // Convert crop coordinates to canvas coordinates
  const cropToCanvasCoords = useCallback((cropX: number, cropY: number) => {
    const visibleArea = getVisibleArea();
    
    // Convert from crop space to visible area space
    const areaX = cropX - visibleArea.x;
    const areaY = cropY - visibleArea.y;
    
    // Apply zoom and pan
    const canvasX = areaX * zoomLevel + panOffset.x;
    const canvasY = areaY * zoomLevel + panOffset.y;
    
    return { x: canvasX, y: canvasY };
  }, [getVisibleArea, zoomLevel, panOffset]);

  // Update size indicator position
  const updateSizeIndicator = useCallback(() => {
    if (!crop) return;
    
    const cropCanvas = cropToCanvasCoords(crop.x, crop.y);
    const cropCanvasEnd = cropToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
    
    // Position indicator next to the crop area
    const indicatorX = cropCanvasEnd.x + 10;
    const indicatorY = cropCanvas.y + (cropCanvasEnd.y - cropCanvas.y) / 2;
    
    setSizeIndicator({
      x: indicatorX,
      y: indicatorY,
      width: Math.round(crop.width),
      height: Math.round(crop.height),
      visible: true
    });
  }, [crop, cropToCanvasCoords]);

  // Get resize handle at position
  const getResizeHandle = useCallback((canvasX: number, canvasY: number) => {
    if (!crop) return null;
    
    const cropCanvas = cropToCanvasCoords(crop.x, crop.y);
    const cropCanvasEnd = cropToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
    const cropCanvasWidth = cropCanvasEnd.x - cropCanvas.x;
    const cropCanvasHeight = cropCanvasEnd.y - cropCanvas.y;
    
    const handleSize = 8 * Math.max(1, zoomLevel * 0.5); // Scale handles with zoom
    const tolerance = handleSize;
    
    // Define handles
    const handles = [
      { name: 'nw', x: cropCanvas.x, y: cropCanvas.y },
      { name: 'ne', x: cropCanvas.x + cropCanvasWidth, y: cropCanvas.y },
      { name: 'sw', x: cropCanvas.x, y: cropCanvas.y + cropCanvasHeight },
      { name: 'se', x: cropCanvas.x + cropCanvasWidth, y: cropCanvas.y + cropCanvasHeight },
      { name: 'n', x: cropCanvas.x + cropCanvasWidth / 2, y: cropCanvas.y },
      { name: 's', x: cropCanvas.x + cropCanvasWidth / 2, y: cropCanvas.y + cropCanvasHeight },
      { name: 'w', x: cropCanvas.x, y: cropCanvas.y + cropCanvasHeight / 2 },
      { name: 'e', x: cropCanvas.x + cropCanvasWidth, y: cropCanvas.y + cropCanvasHeight / 2 },
    ];
    
    for (const handle of handles) {
      if (Math.abs(canvasX - handle.x) <= tolerance && Math.abs(canvasY - handle.y) <= tolerance) {
        return handle.name;
      }
    }
    
    return null;
  }, [crop, cropToCanvasCoords, zoomLevel]);

  // Check if point is within crop area
  const isPointInCrop = useCallback((canvasX: number, canvasY: number) => {
    if (!crop) return false;
    
    const cropCanvas = cropToCanvasCoords(crop.x, crop.y);
    const cropCanvasEnd = cropToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
    
    return canvasX >= cropCanvas.x && canvasX <= cropCanvasEnd.x &&
           canvasY >= cropCanvas.y && canvasY <= cropCanvasEnd.y;
  }, [crop, cropToCanvasCoords]);

  // Draw the zoomed canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const container = containerRef.current;
    if (!canvas || !ctx || !originalImage || !crop || !container) return;

    // Set canvas size to container size
    const containerRect = container.getBoundingClientRect();
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get visible area
    const visibleArea = getVisibleArea();
    
    // Calculate source coordinates in original image
    const sourceX = (visibleArea.x - imageOffset.x) / imageScale;
    const sourceY = (visibleArea.y - imageOffset.y) / imageScale;
    const sourceWidth = visibleArea.width / imageScale;
    const sourceHeight = visibleArea.height / imageScale;
    
    // Clamp to image bounds
    const clampedSourceX = Math.max(0, Math.min(sourceX, originalImage.width));
    const clampedSourceY = Math.max(0, Math.min(sourceY, originalImage.height));
    const clampedSourceWidth = Math.max(1, Math.min(sourceWidth, originalImage.width - clampedSourceX));
    const clampedSourceHeight = Math.max(1, Math.min(sourceHeight, originalImage.height - clampedSourceY));

    // Apply pan and zoom transformations
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoomLevel, zoomLevel);

    // Draw the image section
    ctx.drawImage(
      originalImage,
      clampedSourceX,
      clampedSourceY,
      clampedSourceWidth,
      clampedSourceHeight,
      0,
      0,
      visibleArea.width / imageScale,
      visibleArea.height / imageScale
    );

    ctx.restore();

    // Draw pixel grid if zoomed in enough
    if (zoomLevel >= 4) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([]);
      
      const gridSize = zoomLevel;
      for (let x = panOffset.x % gridSize; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = panOffset.y % gridSize; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Draw crop area overlay
    const cropCanvas = cropToCanvasCoords(crop.x, crop.y);
    const cropCanvasEnd = cropToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
    const cropCanvasWidth = cropCanvasEnd.x - cropCanvas.x;
    const cropCanvasHeight = cropCanvasEnd.y - cropCanvas.y;

    // Crop area border
    ctx.strokeStyle = (isDragging || isResizing) ? '#F59E0B' : '#3B82F6';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(cropCanvas.x, cropCanvas.y, cropCanvasWidth, cropCanvasHeight);

    // Crop area fill
    ctx.fillStyle = (isDragging || isResizing) ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)';
    ctx.fillRect(cropCanvas.x, cropCanvas.y, cropCanvasWidth, cropCanvasHeight);

    // Draw resize handles
    const handleSize = 6 * Math.max(1, zoomLevel * 0.3);
    const handleColor = (isDragging || isResizing) ? '#F59E0B' : '#3B82F6';
    
    ctx.fillStyle = handleColor;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    
    const handles = [
      { x: cropCanvas.x, y: cropCanvas.y }, // nw
      { x: cropCanvas.x + cropCanvasWidth, y: cropCanvas.y }, // ne
      { x: cropCanvas.x, y: cropCanvas.y + cropCanvasHeight }, // sw
      { x: cropCanvas.x + cropCanvasWidth, y: cropCanvas.y + cropCanvasHeight }, // se
      { x: cropCanvas.x + cropCanvasWidth / 2, y: cropCanvas.y }, // n
      { x: cropCanvas.x + cropCanvasWidth / 2, y: cropCanvas.y + cropCanvasHeight }, // s
      { x: cropCanvas.x, y: cropCanvas.y + cropCanvasHeight / 2 }, // w
      { x: cropCanvas.x + cropCanvasWidth, y: cropCanvas.y + cropCanvasHeight / 2 }, // e
    ];
    
    handles.forEach(handle => {
      ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
    });

    // Update size indicator position
    updateSizeIndicator();
  }, [originalImage, crop, imageScale, imageOffset, zoomLevel, panOffset, isDragging, isResizing, getVisibleArea, cropToCanvasCoords, updateSizeIndicator]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Auto-center crop when it changes
  useEffect(() => {
    if (crop) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Center the view on the crop
      const visibleArea = getVisibleArea();
      const centerX = canvas.width / 2 - (visibleArea.width * zoomLevel) / 2;
      const centerY = canvas.height / 2 - (visibleArea.height * zoomLevel) / 2;
      
      setPanOffset({ x: centerX, y: centerY });
    }
  }, [crop?.id]); // Only re-center when crop changes

  // Mouse event handlers
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    
    // Check for resize handle first
    const handle = getResizeHandle(pos.x, pos.y);
    if (handle) {
      setIsResizing(true);
      setResizeHandle(handle);
      setDragStart(pos);
      setOriginalCropState({ ...crop });
      return;
    }
    
    // Check if clicking within crop area for dragging
    if (isPointInCrop(pos.x, pos.y)) {
      setIsDragging(true);
      setDragStart(pos);
      setOriginalCropState({ ...crop });
    } else {
      // Start panning
      setIsPanning(true);
      setDragStart(pos);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    const canvas = canvasRef.current;
    
    if (isResizing && resizeHandle && originalCropState) {
      // Handle resizing with pixel precision
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      
      // Convert canvas deltas to crop coordinate deltas
      const cropDeltaX = deltaX / zoomLevel;
      const cropDeltaY = deltaY / zoomLevel;
      
      let newCrop = { ...originalCropState };
      
      switch (resizeHandle) {
        case 'nw':
          newCrop.width = Math.max(10, originalCropState.width - cropDeltaX);
          newCrop.height = Math.max(10, originalCropState.height - cropDeltaY);
          newCrop.x = originalCropState.x + (originalCropState.width - newCrop.width);
          newCrop.y = originalCropState.y + (originalCropState.height - newCrop.height);
          break;
        case 'ne':
          newCrop.width = Math.max(10, originalCropState.width + cropDeltaX);
          newCrop.height = Math.max(10, originalCropState.height - cropDeltaY);
          newCrop.y = originalCropState.y + (originalCropState.height - newCrop.height);
          break;
        case 'sw':
          newCrop.width = Math.max(10, originalCropState.width - cropDeltaX);
          newCrop.height = Math.max(10, originalCropState.height + cropDeltaY);
          newCrop.x = originalCropState.x + (originalCropState.width - newCrop.width);
          break;
        case 'se':
          newCrop.width = Math.max(10, originalCropState.width + cropDeltaX);
          newCrop.height = Math.max(10, originalCropState.height + cropDeltaY);
          break;
        case 'n':
          newCrop.height = Math.max(10, originalCropState.height - cropDeltaY);
          newCrop.y = originalCropState.y + (originalCropState.height - newCrop.height);
          break;
        case 's':
          newCrop.height = Math.max(10, originalCropState.height + cropDeltaY);
          break;
        case 'w':
          newCrop.width = Math.max(10, originalCropState.width - cropDeltaX);
          newCrop.x = originalCropState.x + (originalCropState.width - newCrop.width);
          break;
        case 'e':
          newCrop.width = Math.max(10, originalCropState.width + cropDeltaX);
          break;
      }
      
      // Maintain aspect ratio if set
      if (crop.aspectRatio && crop.aspectRatio > 0) {
        if (['nw', 'ne', 'sw', 'se'].includes(resizeHandle)) {
          if (resizeHandle === 'nw' || resizeHandle === 'se') {
            newCrop.height = newCrop.width / crop.aspectRatio;
          } else {
            newCrop.width = newCrop.height * crop.aspectRatio;
          }
        }
      }
      
      onCropUpdate(newCrop);
      
    } else if (isDragging && originalCropState) {
      // Handle dragging with pixel precision
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      
      const cropDeltaX = deltaX / zoomLevel;
      const cropDeltaY = deltaY / zoomLevel;
      
      onCropUpdate({
        x: originalCropState.x + cropDeltaX,
        y: originalCropState.y + cropDeltaY
      });
      
    } else if (isPanning) {
      // Handle panning
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      
      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setDragStart(pos);
      
    } else {
      // Update cursor based on what's under mouse
      if (canvas) {
        const handle = getResizeHandle(pos.x, pos.y);
        if (handle) {
          const cursorMap: { [key: string]: string } = {
            'nw': 'nw-resize', 'ne': 'ne-resize', 'sw': 'sw-resize', 'se': 'se-resize',
            'n': 'n-resize', 's': 's-resize', 'w': 'w-resize', 'e': 'e-resize'
          };
          canvas.style.cursor = cursorMap[handle] || 'default';
        } else if (isPointInCrop(pos.x, pos.y)) {
          canvas.style.cursor = 'move';
        } else {
          canvas.style.cursor = 'grab';
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setIsPanning(false);
    setResizeHandle(null);
    setOriginalCropState(null);
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const pos = getMousePos(e);
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(10, zoomLevel * delta));
    
    // Zoom towards mouse position
    const newPanOffset = {
      x: pos.x - (pos.x - panOffset.x) * (newZoom / zoomLevel),
      y: pos.y - (pos.y - panOffset.y) * (newZoom / zoomLevel)
    };
    
    setZoomLevel(newZoom);
    setPanOffset(newPanOffset);
  };

  // Zoom controls
  const zoomIn = () => {
    const newZoom = Math.min(10, zoomLevel * 1.2);
    setZoomLevel(newZoom);
  };

  const zoomOut = () => {
    const newZoom = Math.max(0.5, zoomLevel * 0.8);
    setZoomLevel(newZoom);
  };

  const resetZoom = () => {
    setZoomLevel(2);
    // Re-center on crop
    const canvas = canvasRef.current;
    if (canvas && crop) {
      const visibleArea = getVisibleArea();
      const centerX = canvas.width / 2 - (visibleArea.width * 2) / 2;
      const centerY = canvas.height / 2 - (visibleArea.height * 2) / 2;
      setPanOffset({ x: centerX, y: centerY });
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Canvas Container */}
      <div 
        ref={containerRef}
        className="w-full h-full bg-gray-800 rounded-lg overflow-hidden relative border border-gray-600"
        style={{ minHeight: '400px' }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ 
            imageRendering: zoomLevel > 4 ? 'pixelated' : 'auto',
            cursor: isPanning ? 'grabbing' : 'default'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* Dynamic Size Indicator */}
        {sizeIndicator.visible && (
          <div
            className="absolute bg-gray-900/90 text-white px-3 py-2 rounded-lg shadow-lg border border-gray-600 pointer-events-none z-10"
            style={{
              left: Math.min(sizeIndicator.x, containerRef.current?.clientWidth ? containerRef.current.clientWidth - 120 : sizeIndicator.x),
              top: Math.max(10, Math.min(sizeIndicator.y - 15, containerRef.current?.clientHeight ? containerRef.current.clientHeight - 50 : sizeIndicator.y)),
              transform: 'translateY(-50%)'
            }}
          >
            <div className="text-sm font-semibold">
              {sizeIndicator.width} × {sizeIndicator.height}
            </div>
            <div className="text-xs text-gray-400">
              {(isDragging || isResizing) ? 'Adjusting...' : 'Crop Size'}
            </div>
          </div>
        )}

        {/* Zoom Level Indicator */}
        <div className="absolute top-4 left-4 bg-gray-900/90 text-white px-2 py-1 rounded text-xs">
          {Math.round(zoomLevel * 100)}%
        </div>

        {/* Pixel Grid Indicator */}
        {zoomLevel >= 4 && (
          <div className="absolute top-4 right-4 bg-gray-900/90 text-white px-2 py-1 rounded text-xs">
            Pixel Grid
          </div>
        )}

        {/* Zoom Controls */}
        <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
          <button
            onClick={zoomIn}
            className="w-8 h-8 bg-gray-900/90 hover:bg-gray-800 text-white rounded flex items-center justify-center text-sm font-bold transition-colors"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={zoomOut}
            className="w-8 h-8 bg-gray-900/90 hover:bg-gray-800 text-white rounded flex items-center justify-center text-sm font-bold transition-colors"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={resetZoom}
            className="w-8 h-8 bg-gray-900/90 hover:bg-gray-800 text-white rounded flex items-center justify-center text-xs font-bold transition-colors"
            title="Reset Zoom"
          >
            ⌂
          </button>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 bg-gray-900/90 text-white px-3 py-2 rounded text-xs max-w-64">
          <div className="space-y-1">
            <div><strong>Scroll:</strong> Zoom in/out</div>
            <div><strong>Drag crop:</strong> Move position</div>
            <div><strong>Drag handles:</strong> Resize</div>
            <div><strong>Drag empty:</strong> Pan view</div>
          </div>
        </div>
      </div>
    </div>
  );
};