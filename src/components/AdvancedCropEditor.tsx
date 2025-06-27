import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Settings, ChevronLeft, ChevronRight, RotateCw, Download, Eye, EyeOff, Undo } from 'lucide-react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showUncropped, setShowUncropped] = useState(true);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [exportQuality, setExportQuality] = useState(0.9);
  const [originalCropState, setOriginalCropState] = useState<CropArea | null>(null);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [dragAnimation, setDragAnimation] = useState(false);
  const [originalPosition, setOriginalPosition] = useState({ x: 0, y: 0 });

  // Store the original crop state when the editor opens or when switching crops
  useEffect(() => {
    if (isOpen && crop) {
      setOriginalCropState({ ...crop });
    }
  }, [isOpen, crop.id]); // Only reset when crop ID changes or editor opens

  const currentCropIndex = allCrops.findIndex(c => c.id === crop.id);
  const canGoPrevious = currentCropIndex > 0;
  const canGoNext = currentCropIndex < allCrops.length - 1;

  // Calculate crop bounds within the image
  const getCropBounds = useCallback(() => {
    if (!originalImage) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    
    const imageWidth = originalImage.width * previewScale;
    const imageHeight = originalImage.height * previewScale;
    
    return {
      minX: 0,
      minY: 0,
      maxX: imageWidth - (crop.width / imageScale) * previewScale,
      maxY: imageHeight - (crop.height / imageScale) * previewScale
    };
  }, [originalImage, previewScale, crop.width, crop.height, imageScale]);

  // Check if a point is within the crop area
  const isPointInCrop = useCallback((x: number, y: number) => {
    if (!showUncropped) return true; // In crop-only mode, entire canvas is draggable
    
    const cropCanvasX = ((crop.x - imageOffset.x) / imageScale) * previewScale;
    const cropCanvasY = ((crop.y - imageOffset.y) / imageScale) * previewScale;
    const cropCanvasWidth = (crop.width / imageScale) * previewScale;
    const cropCanvasHeight = (crop.height / imageScale) * previewScale;
    
    return x >= cropCanvasX && x <= cropCanvasX + cropCanvasWidth &&
           y >= cropCanvasY && y <= cropCanvasY + cropCanvasHeight;
  }, [crop, imageScale, imageOffset, previewScale, showUncropped]);

  // Convert canvas coordinates to image coordinates
  const canvasToImageCoords = useCallback((canvasX: number, canvasY: number) => {
    const imageX = (canvasX / previewScale) * imageScale + imageOffset.x;
    const imageY = (canvasY / previewScale) * imageScale + imageOffset.y;
    return { x: imageX, y: imageY };
  }, [previewScale, imageScale, imageOffset]);

  // Constrain crop position within image bounds
  const constrainCropPosition = useCallback((x: number, y: number) => {
    if (!originalImage) return { x, y };
    
    const bounds = getCropBounds();
    const imageCoords = canvasToImageCoords(x, y);
    
    // Convert back to canvas coordinates after constraining
    const constrainedImageX = Math.max(imageOffset.x, Math.min(imageCoords.x, imageOffset.x + originalImage.width * imageScale - crop.width));
    const constrainedImageY = Math.max(imageOffset.y, Math.min(imageCoords.y, imageOffset.y + originalImage.height * imageScale - crop.height));
    
    return { x: constrainedImageX, y: constrainedImageY };
  }, [originalImage, getCropBounds, canvasToImageCoords, imageOffset, imageScale, crop.width, crop.height]);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !originalImage || !crop) return;

    // Calculate canvas size to show both cropped and uncropped areas
    let canvasWidth, canvasHeight;
    
    if (showUncropped) {
      // Show the full image with crop highlighted
      const imgAspect = originalImage.width / originalImage.height;
      const maxSize = 600; // Maximum canvas size
      
      if (imgAspect > 1) {
        canvasWidth = Math.min(maxSize, originalImage.width * previewScale);
        canvasHeight = canvasWidth / imgAspect;
      } else {
        canvasHeight = Math.min(maxSize, originalImage.height * previewScale);
        canvasWidth = canvasHeight * imgAspect;
      }
    } else {
      // Show only the crop area
      canvasWidth = crop.width * previewScale;
      canvasHeight = crop.height * previewScale;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showUncropped) {
      // Draw the full image at reduced opacity
      ctx.globalAlpha = 0.3;
      ctx.drawImage(
        originalImage,
        0,
        0,
        canvasWidth,
        canvasHeight
      );

      // Calculate crop area position on the full image canvas
      const cropCanvasX = ((crop.x - imageOffset.x) / imageScale) * previewScale;
      const cropCanvasY = ((crop.y - imageOffset.y) / imageScale) * previewScale;
      const cropCanvasWidth = (crop.width / imageScale) * previewScale;
      const cropCanvasHeight = (crop.height / imageScale) * previewScale;

      // Draw the crop area at full opacity
      ctx.globalAlpha = 1.0;
      
      // Apply rotation if present for the crop area
      const rotation = crop.rotation || 0;
      if (rotation !== 0) {
        ctx.save();
        const centerX = cropCanvasX + cropCanvasWidth / 2;
        const centerY = cropCanvasY + cropCanvasHeight / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      // Calculate source crop coordinates
      const sourceX = (crop.x - imageOffset.x) / imageScale;
      const sourceY = (crop.y - imageOffset.y) / imageScale;
      const sourceWidth = crop.width / imageScale;
      const sourceHeight = crop.height / imageScale;

      // Ensure crop is within image bounds
      const clampedSourceX = Math.max(0, Math.min(sourceX, originalImage.width));
      const clampedSourceY = Math.max(0, Math.min(sourceY, originalImage.height));
      const clampedSourceWidth = Math.max(1, Math.min(sourceWidth, originalImage.width - clampedSourceX));
      const clampedSourceHeight = Math.max(1, Math.min(sourceHeight, originalImage.height - clampedSourceY));

      // Draw the cropped portion at full opacity
      ctx.drawImage(
        originalImage,
        clampedSourceX,
        clampedSourceY,
        clampedSourceWidth,
        clampedSourceHeight,
        cropCanvasX,
        cropCanvasY,
        cropCanvasWidth,
        cropCanvasHeight
      );

      if (rotation !== 0) {
        ctx.restore();
      }

      // Draw crop area border - only show enhanced styling during drag, no hover effects
      const borderColor = isDragging ? '#F59E0B' : '#3B82F6';
      const borderWidth = isDragging ? 4 : 2;
      
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.setLineDash(isDragging ? [8, 4] : []);
      ctx.strokeRect(cropCanvasX, cropCanvasY, cropCanvasWidth, cropCanvasHeight);

      // Draw crop area overlay - enhanced opacity only during drag
      const overlayOpacity = isDragging ? 0.2 : 0.1;
      ctx.fillStyle = `rgba(59, 130, 246, ${overlayOpacity})`;
      ctx.fillRect(cropCanvasX, cropCanvasY, cropCanvasWidth, cropCanvasHeight);

      // Draw drag handles only during drag (no hover handles)
      if (isDragging) {
        const handleSize = 8;
        const handleColor = '#F59E0B';
        
        ctx.fillStyle = handleColor;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        
        // Corner handles
        const handles = [
          { x: cropCanvasX, y: cropCanvasY }, // top-left
          { x: cropCanvasX + cropCanvasWidth, y: cropCanvasY }, // top-right
          { x: cropCanvasX, y: cropCanvasY + cropCanvasHeight }, // bottom-left
          { x: cropCanvasX + cropCanvasWidth, y: cropCanvasY + cropCanvasHeight }, // bottom-right
        ];
        
        handles.forEach(handle => {
          ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
          ctx.strokeRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
        });
        
        // Center handle for dragging
        const centerX = cropCanvasX + cropCanvasWidth / 2;
        const centerY = cropCanvasY + cropCanvasHeight / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, handleSize/2 + 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }

    } else {
      // Show only the crop area (original behavior)
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

      // Add border for crop-only mode - only enhanced during drag
      if (isDragging) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        ctx.setLineDash([]);
      }
    }

    // Draw grid overlay if enabled
    if (showGrid) {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      
      if (showUncropped) {
        // Grid over the entire canvas
        const gridWidth = canvas.width / 9; // 3x3 grid over full image
        const gridHeight = canvas.height / 9;
        
        // Vertical lines
        for (let i = 1; i < 9; i++) {
          ctx.beginPath();
          ctx.moveTo(i * gridWidth, 0);
          ctx.lineTo(i * gridWidth, canvas.height);
          ctx.stroke();
        }
        
        // Horizontal lines
        for (let i = 1; i < 9; i++) {
          ctx.beginPath();
          ctx.moveTo(0, i * gridHeight);
          ctx.lineTo(canvas.width, i * gridHeight);
          ctx.stroke();
        }
      } else {
        // Rule of thirds grid over crop area only
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
      }
      
      ctx.setLineDash([]);
    }

    // Reset global alpha
    ctx.globalAlpha = 1.0;
  }, [originalImage, crop, imageScale, imageOffset, previewScale, showGrid, showUncropped, isDragging]);

  useEffect(() => {
    if (isOpen) {
      drawPreview();
    }
  }, [isOpen, drawPreview]);

  // Mouse event handlers for dragging
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
    
    if (isPointInCrop(pos.x, pos.y)) {
      setIsDragging(true);
      setDragStart(pos);
      setDragOffset({ x: 0, y: 0 });
      setOriginalPosition({ x: crop.x, y: crop.y });
      setDragAnimation(true);
      setIsHovering(false); // Completely disable hover during drag
      
      // Add drag cursor
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = 'grabbing';
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    const canvas = canvasRef.current;
    
    if (isDragging) {
      // Calculate drag offset
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      setDragOffset({ x: deltaX, y: deltaY });
      
      // Convert canvas delta to image coordinates
      const imageDeltaX = (deltaX / previewScale) * imageScale;
      const imageDeltaY = (deltaY / previewScale) * imageScale;
      
      // Calculate new position
      let newX = originalPosition.x + imageDeltaX;
      let newY = originalPosition.y + imageDeltaY;
      
      // Maintain aspect ratio if locked
      if (crop.aspectRatio && crop.aspectRatio > 0) {
        // Keep the same aspect ratio constraint during drag
        // This is mainly for visual consistency
      }
      
      // Constrain to image bounds
      const constrainedPos = constrainCropPosition(newX, newY);
      
      // Update crop position with smooth animation
      onUpdateCrop({
        x: constrainedPos.x,
        y: constrainedPos.y
      });
      
    } else {
      // Only handle hover state when NOT dragging
      if (!isDragging) {
        const wasHovering = isHovering;
        const nowHovering = isPointInCrop(pos.x, pos.y);
        
        if (nowHovering !== wasHovering) {
          setIsHovering(nowHovering);
          
          // Update cursor only when not dragging
          if (canvas) {
            canvas.style.cursor = nowHovering ? 'grab' : 'default';
          }
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      // Check if crop is within valid bounds
      const bounds = getCropBounds();
      const cropCanvasX = ((crop.x - imageOffset.x) / imageScale) * previewScale;
      const cropCanvasY = ((crop.y - imageOffset.y) / imageScale) * previewScale;
      
      // If crop is outside bounds, animate back to original position
      if (originalImage && (
        cropCanvasX < bounds.minX || 
        cropCanvasY < bounds.minY || 
        cropCanvasX > bounds.maxX || 
        cropCanvasY > bounds.maxY
      )) {
        // Animate back to original position
        setDragAnimation(true);
        setTimeout(() => {
          onUpdateCrop({
            x: originalPosition.x,
            y: originalPosition.y
          });
          setDragAnimation(false);
        }, 150);
      } else {
        // Valid position, end drag animation
        setTimeout(() => setDragAnimation(false), 100);
      }
    }
    
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    
    // Reset cursor and allow hover detection to resume
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
    
    // Re-enable hover detection after drag completes
    setTimeout(() => {
      if (!isDragging) {
        setIsHovering(false);
      }
    }, 100);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      // If dragging and mouse leaves, reset to original position
      setDragAnimation(true);
      setTimeout(() => {
        onUpdateCrop({
          x: originalPosition.x,
          y: originalPosition.y
        });
        setDragAnimation(false);
      }, 200);
    }
    
    setIsDragging(false);
    setIsHovering(false);
    setDragOffset({ x: 0, y: 0 });
    
    // Reset cursor
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  };

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

  const handleDiscardChanges = () => {
    if (originalCropState) {
      // Revert all changes back to the original state
      onUpdateCrop({
        name: originalCropState.name,
        x: originalCropState.x,
        y: originalCropState.y,
        width: originalCropState.width,
        height: originalCropState.height,
        rotation: originalCropState.rotation,
        aspectRatio: originalCropState.aspectRatio
      });
      
      // Close the editor
      onClose();
    }
  };

  // Check if there are any changes to show the discard button state
  const hasChanges = originalCropState && (
    crop.name !== originalCropState.name ||
    crop.x !== originalCropState.x ||
    crop.y !== originalCropState.y ||
    crop.width !== originalCropState.width ||
    crop.height !== originalCropState.height ||
    crop.rotation !== originalCropState.rotation ||
    crop.aspectRatio !== originalCropState.aspectRatio
  );

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
            {hasChanges && (
              <div className="text-xs text-orange-400 bg-orange-400/10 px-2 py-1 rounded">
                Modified
              </div>
            )}
            {isDragging && (
              <div className="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded animate-pulse">
                Dragging
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowUncropped(!showUncropped)}
              className={`p-2 rounded-lg transition-colors ${
                showUncropped ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Toggle uncropped area preview"
            >
              {showUncropped ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
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
              <div 
                ref={containerRef}
                className={`relative bg-gray-700 rounded-lg p-4 shadow-lg max-w-full max-h-full overflow-auto transition-all duration-200 ${
                  dragAnimation ? 'scale-105' : ''
                } ${isDragging ? 'shadow-2xl' : ''}`}
              >
                <canvas
                  ref={canvasRef}
                  className={`max-w-full max-h-full rounded border border-gray-600 transition-all duration-150 ${
                    isDragging ? 'border-orange-400 shadow-lg' : ''
                  }`}
                  style={{ 
                    imageRendering: 'pixelated',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    cursor: isDragging ? 'grabbing' : 'grab'
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                />
                
                {/* Preview Controls Overlay */}
                <div className="absolute bottom-2 left-2 bg-black/70 rounded px-2 py-1 text-xs text-white">
                  {showUncropped ? 'Full Image Preview' : 'Crop Preview'} • {Math.round(crop.width)} × {Math.round(crop.height)}
                  {crop.rotation && crop.rotation !== 0 && (
                    <span className="ml-2 text-orange-400">
                      ↻ {Math.round(crop.rotation)}°
                    </span>
                  )}
                  {isDragging && (
                    <span className="ml-2 text-blue-400">
                      • Dragging
                    </span>
                  )}
                </div>

                {/* View Mode Indicator */}
                <div className="absolute top-2 right-2 bg-black/70 rounded px-2 py-1 text-xs text-white">
                  {showUncropped ? 'Context View' : 'Crop Only'}
                </div>

                {/* Drag Instructions - Only show when not dragging and not hovering */}
                {showUncropped && !isDragging && (
                  <div className="absolute top-2 left-2 bg-black/70 rounded px-2 py-1 text-xs text-white">
                    Click and drag the crop area to move it
                  </div>
                )}
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

              {/* Drag Controls Info */}
              <div className="bg-gray-800 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Drag Controls</h4>
                <div className="text-xs text-gray-400 space-y-1">
                  <div>• Click and drag crop area to move</div>
                  <div>• No hover effects during drag</div>
                  <div>• Canvas stays completely stationary</div>
                  <div>• Maintains aspect ratio if locked</div>
                  <div>• Auto-constrains to image bounds</div>
                  <div>• Returns to original if dragged outside</div>
                  <div>• Visual feedback only during active drag</div>
                </div>
              </div>

              {/* View Options */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-300">View Options</h4>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Show uncropped area</span>
                  <button
                    onClick={() => setShowUncropped(!showUncropped)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showUncropped ? 'bg-purple-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showUncropped ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Show grid</span>
                  <button
                    onClick={() => setShowGrid(!showGrid)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showGrid ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showGrid ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {showUncropped && (
                  <div className="text-xs text-gray-400 bg-gray-800 rounded p-2">
                    <strong>Context View:</strong> Shows the full image with the crop area highlighted. 
                    Uncropped areas are displayed at 30% opacity. Click and drag the blue highlighted area to move the crop.
                    No hover effects during drag operations.
                  </div>
                )}
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
                  onClick={handleDiscardChanges}
                  className={`flex-1 flex items-center justify-center space-x-2 rounded-lg py-2 px-4 text-sm transition-colors ${
                    hasChanges 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                  title={hasChanges ? "Discard all changes and close" : "Close without changes"}
                >
                  <Undo className="h-4 w-4" />
                  <span>Discard Changes</span>
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