import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Settings, ChevronLeft, ChevronRight, RotateCw, Download, Eye, EyeOff, Undo, ZoomIn, ZoomOut, RotateCcw, Menu } from 'lucide-react';
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
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [showUncropped, setShowUncropped] = useState(true);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [exportQuality, setExportQuality] = useState(0.9);
  const [originalCropState, setOriginalCropState] = useState<CropArea | null>(null);
  
  // Canvas coordinate system state
  const [baseCanvasSize, setBaseCanvasSize] = useState({ width: 0, height: 0 });
  
  // Interaction states
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [originalPosition, setOriginalPosition] = useState({ x: 0, y: 0 });
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [lastPanOffset, setLastPanOffset] = useState({ x: 0, y: 0 });

  // Mobile states
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileSettings, setShowMobileSettings] = useState(false);

  // Store the original crop state when the editor opens or when switching crops
  useEffect(() => {
    if (isOpen && crop) {
      setOriginalCropState({ ...crop });
    }
  }, [isOpen, crop.id]);

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentCropIndex = allCrops.findIndex(c => c.id === crop.id);
  const canGoPrevious = currentCropIndex > 0;
  const canGoNext = currentCropIndex < allCrops.length - 1;

  // Reset zoom and pan when switching between view modes
  useEffect(() => {
    setPreviewScale(1);
    setPreviewOffset({ x: 0, y: 0 });
  }, [showUncropped]);

  // Calculate zoom limits based on mode and crop size
  const getZoomLimits = useCallback(() => {
    if (!originalImage || !crop) return { min: 0.1, max: 5 };

    if (showUncropped) {
      // In context view: min zoom shows full image, max zoom shows crop at 100%
      return { min: 0.1, max: 3 };
    } else {
      // In crop-only view: min zoom shows crop fitting container, max zoom shows crop at actual size
      const container = containerRef.current;
      if (!container) return { min: 0.1, max: 5 };

      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width - 80; // Account for padding
      const containerHeight = containerRect.height - 80;

      // Calculate scale needed to fit crop in container
      const fitScale = Math.min(
        containerWidth / crop.width,
        containerHeight / crop.height
      );

      // Min zoom: crop fits in container
      // Max zoom: crop is shown at actual pixel size (1:1 with image)
      return { 
        min: Math.min(0.5, fitScale), 
        max: Math.max(2, 1 / fitScale) 
      };
    }
  }, [originalImage, crop, showUncropped]);

  // Convert canvas coordinates to crop coordinates with proper zoom handling
  const canvasToCropCoords = useCallback((canvasX: number, canvasY: number) => {
    if (!originalImage || !crop) return { x: 0, y: 0 };

    if (showUncropped) {
      // In context view: account for image positioning and zoom
      const unzoomedX = (canvasX - previewOffset.x) / previewScale;
      const unzoomedY = (canvasY - previewOffset.y) / previewScale;
      
      // Calculate image scale within canvas
      const imageAspect = originalImage.width / originalImage.height;
      const canvasAspect = baseCanvasSize.width / baseCanvasSize.height;
      
      let imageCanvasScale;
      let imageCanvasX, imageCanvasY;
      
      if (imageAspect > canvasAspect) {
        // Image is wider - fit to width
        imageCanvasScale = baseCanvasSize.width / originalImage.width;
        imageCanvasX = 0;
        imageCanvasY = (baseCanvasSize.height - originalImage.height * imageCanvasScale) / 2;
      } else {
        // Image is taller - fit to height
        imageCanvasScale = baseCanvasSize.height / originalImage.height;
        imageCanvasX = (baseCanvasSize.width - originalImage.width * imageCanvasScale) / 2;
        imageCanvasY = 0;
      }
      
      // Convert to image coordinates
      const imageX = (unzoomedX - imageCanvasX) / imageCanvasScale;
      const imageY = (unzoomedY - imageCanvasY) / imageCanvasScale;
      
      return { x: imageX, y: imageY };
    } else {
      // In crop-only view: entire canvas represents the crop area
      const unzoomedX = (canvasX - previewOffset.x) / previewScale;
      const unzoomedY = (canvasY - previewOffset.y) / previewScale;
      
      // Convert from canvas space to crop space
      const cropX = crop.x + (unzoomedX / baseCanvasSize.width) * crop.width;
      const cropY = crop.y + (unzoomedY / baseCanvasSize.height) * crop.height;
      
      return { x: cropX, y: cropY };
    }
  }, [showUncropped, previewScale, previewOffset, baseCanvasSize, originalImage, crop]);

  // Convert crop coordinates to canvas coordinates with proper zoom handling
  const cropToCanvasCoords = useCallback((cropX: number, cropY: number) => {
    if (!originalImage || !crop) return { x: 0, y: 0 };

    if (showUncropped) {
      // In context view: convert from image space to canvas space
      const imageAspect = originalImage.width / originalImage.height;
      const canvasAspect = baseCanvasSize.width / baseCanvasSize.height;
      
      let imageCanvasScale;
      let imageCanvasX, imageCanvasY;
      
      if (imageAspect > canvasAspect) {
        imageCanvasScale = baseCanvasSize.width / originalImage.width;
        imageCanvasX = 0;
        imageCanvasY = (baseCanvasSize.height - originalImage.height * imageCanvasScale) / 2;
      } else {
        imageCanvasScale = baseCanvasSize.height / originalImage.height;
        imageCanvasX = (baseCanvasSize.width - originalImage.width * imageCanvasScale) / 2;
        imageCanvasY = 0;
      }
      
      const canvasX = imageCanvasX + cropX * imageCanvasScale;
      const canvasY = imageCanvasY + cropY * imageCanvasScale;
      
      // Apply zoom and pan
      return { 
        x: canvasX * previewScale + previewOffset.x, 
        y: canvasY * previewScale + previewOffset.y 
      };
    } else {
      // In crop-only view: convert from crop space to canvas space
      const canvasX = ((cropX - crop.x) / crop.width) * baseCanvasSize.width;
      const canvasY = ((cropY - crop.y) / crop.height) * baseCanvasSize.height;
      
      // Apply zoom and pan
      return { 
        x: canvasX * previewScale + previewOffset.x, 
        y: canvasY * previewScale + previewOffset.y 
      };
    }
  }, [showUncropped, previewScale, previewOffset, baseCanvasSize, originalImage, crop]);

  // Check if a point is within the crop area
  const isPointInCrop = useCallback((canvasX: number, canvasY: number) => {
    if (!showUncropped) return true; // In crop-only mode, entire canvas is draggable
    
    const cropCanvas = cropToCanvasCoords(crop.x, crop.y);
    const cropCanvasEnd = cropToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
    
    return canvasX >= cropCanvas.x && canvasX <= cropCanvasEnd.x &&
           canvasY >= cropCanvas.y && canvasY <= cropCanvasEnd.y;
  }, [crop, showUncropped, cropToCanvasCoords]);

  // Get resize handle at position
  const getResizeHandle = useCallback((canvasX: number, canvasY: number) => {
    if (!showUncropped) return null;
    
    const cropCanvas = cropToCanvasCoords(crop.x, crop.y);
    const cropCanvasEnd = cropToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
    const cropCanvasWidth = cropCanvasEnd.x - cropCanvas.x;
    const cropCanvasHeight = cropCanvasEnd.y - cropCanvas.y;
    
    const handleSize = (isMobile ? 20 : 12) * Math.max(0.5, Math.min(2, previewScale)); // Scale handle size with zoom
    const tolerance = handleSize / 2;
    
    // Corner and edge handles
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
  }, [crop, showUncropped, cropToCanvasCoords, previewScale, isMobile]);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const container = containerRef.current;
    if (!canvas || !ctx || !originalImage || !crop || !container) return;

    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    const maxWidth = containerRect.width - (isMobile ? 20 : 40);
    const maxHeight = containerRect.height - (isMobile ? 20 : 40);

    let baseWidth, baseHeight;
    
    if (showUncropped) {
      // Show the full image with crop highlighted
      const imgAspect = originalImage.width / originalImage.height;
      const containerAspect = maxWidth / maxHeight;
      
      if (imgAspect > containerAspect) {
        // Image is wider - fit to width
        baseWidth = maxWidth;
        baseHeight = baseWidth / imgAspect;
      } else {
        // Image is taller - fit to height
        baseHeight = maxHeight;
        baseWidth = baseHeight * imgAspect;
      }
    } else {
      // Show only the crop area
      const cropAspect = crop.width / crop.height;
      const containerAspect = maxWidth / maxHeight;
      
      if (cropAspect > containerAspect) {
        // Crop is wider - fit to width
        baseWidth = maxWidth;
        baseHeight = baseWidth / cropAspect;
      } else {
        // Crop is taller - fit to height
        baseHeight = maxHeight;
        baseWidth = baseHeight * cropAspect;
      }
    }

    // Store base canvas size
    setBaseCanvasSize({ width: baseWidth, height: baseHeight });

    // Apply zoom to canvas size
    const canvasWidth = baseWidth * previewScale;
    const canvasHeight = baseHeight * previewScale;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply pan offset
    ctx.save();
    ctx.translate(previewOffset.x, previewOffset.y);

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

      // Calculate crop area position on the canvas
      const scaleX = canvasWidth / originalImage.width;
      const scaleY = canvasHeight / originalImage.height;
      
      // Crop coordinates are in image space
      const cropCanvasX = crop.x * scaleX;
      const cropCanvasY = crop.y * scaleY;
      const cropCanvasWidth = crop.width * scaleX;
      const cropCanvasHeight = crop.height * scaleY;

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

      // Ensure crop coordinates are within image bounds
      const clampedX = Math.max(0, Math.min(crop.x, originalImage.width));
      const clampedY = Math.max(0, Math.min(crop.y, originalImage.height));
      const clampedWidth = Math.max(1, Math.min(crop.width, originalImage.width - clampedX));
      const clampedHeight = Math.max(1, Math.min(crop.height, originalImage.height - clampedY));

      // Draw the cropped portion at full opacity
      ctx.drawImage(
        originalImage,
        clampedX,
        clampedY,
        clampedWidth,
        clampedHeight,
        cropCanvasX,
        cropCanvasY,
        cropCanvasWidth,
        cropCanvasHeight
      );

      if (rotation !== 0) {
        ctx.restore();
      }

      // Draw crop area border
      const borderColor = (isDragging || isResizing) ? '#F59E0B' : '#3B82F6';
      const borderWidth = (isDragging || isResizing) ? 3 : 2;
      
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.setLineDash([]);
      ctx.strokeRect(cropCanvasX, cropCanvasY, cropCanvasWidth, cropCanvasHeight);

      // Draw crop area overlay
      const overlayOpacity = (isDragging || isResizing) ? 0.15 : 0.08;
      ctx.fillStyle = `rgba(59, 130, 246, ${overlayOpacity})`;
      ctx.fillRect(cropCanvasX, cropCanvasY, cropCanvasWidth, cropCanvasHeight);

      // Draw resize handles
      const handleSize = (isMobile ? 20 : 10) * Math.max(0.5, Math.min(2, previewScale));
      const handleColor = (isDragging || isResizing) ? '#F59E0B' : '#3B82F6';
      
      ctx.fillStyle = handleColor;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      
      // Corner handles
      const handles = [
        { x: cropCanvasX, y: cropCanvasY }, // nw
        { x: cropCanvasX + cropCanvasWidth, y: cropCanvasY }, // ne
        { x: cropCanvasX, y: cropCanvasY + cropCanvasHeight }, // sw
        { x: cropCanvasX + cropCanvasWidth, y: cropCanvasY + cropCanvasHeight }, // se
        { x: cropCanvasX + cropCanvasWidth / 2, y: cropCanvasY }, // n
        { x: cropCanvasX + cropCanvasWidth / 2, y: cropCanvasY + cropCanvasHeight }, // s
        { x: cropCanvasX, y: cropCanvasY + cropCanvasHeight / 2 }, // w
        { x: cropCanvasX + cropCanvasWidth, y: cropCanvasY + cropCanvasHeight / 2 }, // e
      ];
      
      handles.forEach(handle => {
        ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
        ctx.strokeRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
      });

    } else {
      // Show only the crop area (crop-only mode)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply rotation if present
      const rotation = crop.rotation || 0;
      if (rotation !== 0) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }

      // Ensure crop is within image bounds
      const cropX = Math.max(0, Math.min(crop.x, originalImage.width));
      const cropY = Math.max(0, Math.min(crop.y, originalImage.height));
      const cropWidth = Math.max(1, Math.min(crop.width, originalImage.width - cropX));
      const cropHeight = Math.max(1, Math.min(crop.height, originalImage.height - cropY));

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

      // Add border for crop-only mode
      if (isDragging || isResizing) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        ctx.setLineDash([]);
      }
    }

    ctx.restore(); // Restore pan offset

    // Draw grid overlay if enabled
    if (showGrid) {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      
      if (showUncropped) {
        // Grid over the entire canvas
        const gridWidth = canvas.width / 9;
        const gridHeight = canvas.height / 9;
        
        for (let i = 1; i < 9; i++) {
          ctx.beginPath();
          ctx.moveTo(i * gridWidth, 0);
          ctx.lineTo(i * gridWidth, canvas.height);
          ctx.stroke();
        }
        
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
        
        for (let i = 1; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(i * gridWidth, 0);
          ctx.lineTo(i * gridWidth, canvas.height);
          ctx.stroke();
        }
        
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
  }, [originalImage, crop, previewScale, previewOffset, showGrid, showUncropped, isDragging, isResizing, isMobile]);

  useEffect(() => {
    if (isOpen) {
      drawPreview();
    }
  }, [isOpen, drawPreview]);

  // Unified event position getter
  const getEventPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  // Unified start handler
  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getEventPos(e);
    
    // Check for resize handle first
    const handle = getResizeHandle(pos.x, pos.y);
    if (handle) {
      setIsResizing(true);
      setResizeHandle(handle);
      setDragStart(pos);
      setOriginalPosition({ x: crop.x, y: crop.y });
      setOriginalSize({ width: crop.width, height: crop.height });
      return;
    }
    
    // Check if clicking within crop area for dragging
    if (isPointInCrop(pos.x, pos.y)) {
      setIsDragging(true);
      setDragStart(pos);
      setOriginalPosition({ x: crop.x, y: crop.y });
    } else {
      // Start panning
      setIsPanning(true);
      setPanStart(pos);
      setLastPanOffset(previewOffset);
    }
  };

  // Unified move handler
  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getEventPos(e);
    const canvas = canvasRef.current;
    
    if (isResizing && resizeHandle) {
      // Handle resizing
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      
      // Convert canvas deltas to crop coordinate deltas
      const cropDelta = canvasToCropCoords(deltaX, deltaY);
      const cropOrigin = canvasToCropCoords(0, 0);
      const cropDeltaX = cropDelta.x - cropOrigin.x;
      const cropDeltaY = cropDelta.y - cropOrigin.y;
      
      let newCrop = { ...crop };
      
      switch (resizeHandle) {
        case 'nw':
          newCrop.width = Math.max(10, originalSize.width - cropDeltaX);
          newCrop.height = Math.max(10, originalSize.height - cropDeltaY);
          newCrop.x = originalPosition.x + (originalSize.width - newCrop.width);
          newCrop.y = originalPosition.y + (originalSize.height - newCrop.height);
          break;
        case 'ne':
          newCrop.width = Math.max(10, originalSize.width + cropDeltaX);
          newCrop.height = Math.max(10, originalSize.height - cropDeltaY);
          newCrop.y = originalPosition.y + (originalSize.height - newCrop.height);
          break;
        case 'sw':
          newCrop.width = Math.max(10, originalSize.width - cropDeltaX);
          newCrop.height = Math.max(10, originalSize.height + cropDeltaY);
          newCrop.x = originalPosition.x + (originalSize.width - newCrop.width);
          break;
        case 'se':
          newCrop.width = Math.max(10, originalSize.width + cropDeltaX);
          newCrop.height = Math.max(10, originalSize.height + cropDeltaY);
          break;
        case 'n':
          newCrop.height = Math.max(10, originalSize.height - cropDeltaY);
          newCrop.y = originalPosition.y + (originalSize.height - newCrop.height);
          break;
        case 's':
          newCrop.height = Math.max(10, originalSize.height + cropDeltaY);
          break;
        case 'w':
          newCrop.width = Math.max(10, originalSize.width - cropDeltaX);
          newCrop.x = originalPosition.x + (originalSize.width - newCrop.width);
          break;
        case 'e':
          newCrop.width = Math.max(10, originalSize.width + cropDeltaX);
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
      
      // Constrain to image bounds
      if (originalImage) {
        newCrop.x = Math.max(0, Math.min(newCrop.x, originalImage.width - newCrop.width));
        newCrop.y = Math.max(0, Math.min(newCrop.y, originalImage.height - newCrop.height));
        newCrop.width = Math.min(newCrop.width, originalImage.width - newCrop.x);
        newCrop.height = Math.min(newCrop.height, originalImage.height - newCrop.y);
      }
      
      onUpdateCrop(newCrop);
      
    } else if (isDragging) {
      // Handle dragging
      const startCropPos = canvasToCropCoords(dragStart.x, dragStart.y);
      const currentCropPos = canvasToCropCoords(pos.x, pos.y);
      const cropDeltaX = currentCropPos.x - startCropPos.x;
      const cropDeltaY = currentCropPos.y - startCropPos.y;
      
      // Calculate new position
      let newX = originalPosition.x + cropDeltaX;
      let newY = originalPosition.y + cropDeltaY;
      
      // Constrain to image bounds
      if (originalImage) {
        newX = Math.max(0, Math.min(newX, originalImage.width - crop.width));
        newY = Math.max(0, Math.min(newY, originalImage.height - crop.height));
      }
      
      onUpdateCrop({
        x: newX,
        y: newY
      });
      
    } else if (isPanning) {
      // Handle panning
      const deltaX = pos.x - panStart.x;
      const deltaY = pos.y - panStart.y;
      
      setPreviewOffset({
        x: lastPanOffset.x + deltaX,
        y: lastPanOffset.y + deltaY
      });
      
    } else {
      // Update cursor based on what's under mouse (desktop only)
      if (canvas && !isDragging && !isResizing && !isPanning && !isMobile) {
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

  // Unified end handler
  const handleEnd = () => {
    setIsDragging(false);
    setIsResizing(false);
    setIsPanning(false);
    setResizeHandle(null);
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  };

  // Zoom functionality with proper limits
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const pos = getEventPos(e);
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const limits = getZoomLimits();
    const newScale = Math.max(limits.min, Math.min(limits.max, previewScale * delta));
    
    // Zoom towards mouse position
    const scaleRatio = newScale / previewScale;
    const newOffset = {
      x: pos.x - (pos.x - previewOffset.x) * scaleRatio,
      y: pos.y - (pos.y - previewOffset.y) * scaleRatio
    };
    
    setPreviewScale(newScale);
    setPreviewOffset(newOffset);
  };

  // Zoom controls with proper limits
  const zoomIn = () => {
    const centerX = baseCanvasSize.width / 2;
    const centerY = baseCanvasSize.height / 2;
    const delta = 1.2;
    const limits = getZoomLimits();
    const newScale = Math.min(limits.max, previewScale * delta);
    const scaleRatio = newScale / previewScale;
    
    const newOffset = {
      x: centerX - (centerX - previewOffset.x) * scaleRatio,
      y: centerY - (centerY - previewOffset.y) * scaleRatio
    };
    
    setPreviewScale(newScale);
    setPreviewOffset(newOffset);
  };

  const zoomOut = () => {
    const centerX = baseCanvasSize.width / 2;
    const centerY = baseCanvasSize.height / 2;
    const delta = 0.8;
    const limits = getZoomLimits();
    const newScale = Math.max(limits.min, previewScale * delta);
    const scaleRatio = newScale / previewScale;
    
    const newOffset = {
      x: centerX - (centerX - previewOffset.x) * scaleRatio,
      y: centerY - (centerY - previewOffset.y) * scaleRatio
    };
    
    setPreviewScale(newScale);
    setPreviewOffset(newOffset);
  };

  const resetZoom = () => {
    setPreviewScale(1);
    setPreviewOffset({ x: 0, y: 0 });
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
      onUpdateCrop({
        name: originalCropState.name,
        x: originalCropState.x,
        y: originalCropState.y,
        width: originalCropState.width,
        height: originalCropState.height,
        rotation: originalCropState.rotation,
        aspectRatio: originalCropState.aspectRatio
      });
      onClose();
    }
  };

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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
      <div className={`bg-gray-900 rounded-xl shadow-2xl w-full h-full md:max-w-6xl md:h-[90vh] flex flex-col ${isMobile ? 'max-w-full' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2 md:space-x-4">
            <h2 className="text-lg md:text-xl font-bold text-white">Advanced Editor</h2>
            <div className="text-xs md:text-sm text-gray-400">
              {currentCropIndex + 1} of {allCrops.length}
            </div>
            {hasChanges && (
              <div className="text-xs text-orange-400 bg-orange-400/10 px-2 py-1 rounded">
                Modified
              </div>
            )}
          </div>
          <div className="flex items-center space-x-1 md:space-x-2">
            {/* Mobile Settings Toggle */}
            {isMobile && (
              <button
                onClick={() => setShowMobileSettings(!showMobileSettings)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                title="Settings"
              >
                <Menu className="h-4 w-4 text-white" />
              </button>
            )}
            
            {/* Zoom Controls */}
            <button
              onClick={zoomOut}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4 text-white" />
            </button>
            <button
              onClick={zoomIn}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4 text-white" />
            </button>
            <button
              onClick={resetZoom}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="h-4 w-4 text-white" />
            </button>
            
            {/* View Toggle Buttons */}
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
              <X className="h-4 md:h-5 w-4 md:w-5 text-white" />
            </button>
          </div>
        </div>

        <div className={`flex flex-1 overflow-hidden ${isMobile ? 'flex-col' : ''}`}>
          {/* Main Preview Area */}
          <div className="flex-1 bg-gray-800 flex flex-col">
            {/* Preview Canvas */}
            <div 
              ref={containerRef}
              className="flex-1 flex items-center justify-center p-2 md:p-4 relative bg-gray-700 rounded-lg shadow-lg max-w-full max-h-full overflow-hidden"
            >
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full border border-gray-600 rounded touch-none"
                style={{ 
                  imageRendering: previewScale > 2 ? 'pixelated' : 'auto',
                  cursor: isPanning ? 'grabbing' : 'default'
                }}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onWheel={handleWheel}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
              />

              {/* Zoom Level Indicator */}
              {previewScale !== 1 && (
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {Math.round(previewScale * 100)}%
                </div>
              )}

              {/* View Mode Indicator */}
              <div className="absolute top-2 right-2 bg-black/70 rounded px-2 py-1 text-xs text-white">
                {showUncropped ? 'Context View' : 'Crop Only'}
              </div>

              {/* Interaction Instructions */}
              {!isDragging && !isResizing && !isPanning && (
                <div className="absolute bottom-2 right-2 bg-black/70 rounded px-2 py-1 text-xs text-white">
                  {isMobile ? 'Pinch to zoom • Drag to pan' : 'Scroll to zoom • Drag to pan'}
                </div>
              )}
            </div>

            {/* Crop Navigation Controls */}
            <div className="bg-gray-900 p-2 md:p-4 border-t border-gray-700">
              <div className="flex items-center justify-between">
                {/* Crop Navigation */}
                <div className="flex items-center space-x-2 md:space-x-4">
                  <button
                    onClick={goToPreviousCrop}
                    disabled={!canGoPrevious}
                    className={`flex items-center space-x-1 md:space-x-2 px-2 md:px-4 py-2 rounded-lg transition-colors text-sm ${
                      canGoPrevious 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                  
                  <div className="text-center">
                    <div className="text-white font-medium text-sm md:text-base">{crop.name}</div>
                    <div className="text-xs text-gray-400">
                      {currentCropIndex + 1} of {allCrops.length}
                    </div>
                  </div>
                  
                  <button
                    onClick={goToNextCrop}
                    disabled={!canGoNext}
                    className={`flex items-center space-x-1 md:space-x-2 px-2 md:px-4 py-2 rounded-lg transition-colors text-sm ${
                      canGoNext 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Zoom Level Display */}
                <div className="text-sm text-gray-300 text-center">
                  {Math.round(previewScale * 100)}%
                </div>
              </div>
            </div>
          </div>

          {/* Settings Panel - Desktop Sidebar / Mobile Overlay */}
          {(!isMobile || showMobileSettings) && (
            <div className={`bg-gray-900 border-l border-gray-700 flex flex-col ${
              isMobile 
                ? 'absolute inset-x-0 bottom-0 top-16 z-10 max-h-[70vh]' 
                : 'w-80'
            }`}>
              <div className="p-3 md:p-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Settings
                </h3>
                {isMobile && (
                  <button
                    onClick={() => setShowMobileSettings(false)}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-4 space-y-4 md:space-y-6">
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
                        onChange={(e) => {
                          const width = parseInt(e.target.value) || 1;
                          const constrainedWidth = originalImage ? Math.min(width, originalImage.width - crop.x) : width;
                          onUpdateCrop({ width: Math.max(10, constrainedWidth) });
                        }}
                        className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        min="10"
                        max={originalImage ? originalImage.width - crop.x : undefined}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Height</label>
                      <input
                        type="number"
                        value={Math.round(crop.height)}
                        onChange={(e) => {
                          const height = parseInt(e.target.value) || 1;
                          const constrainedHeight = originalImage ? Math.min(height, originalImage.height - crop.y) : height;
                          onUpdateCrop({ height: Math.max(10, constrainedHeight) });
                        }}
                        className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        min="10"
                        max={originalImage ? originalImage.height - crop.y : undefined}
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
                        onChange={(e) => {
                          const x = parseInt(e.target.value) || 0;
                          const constrainedX = originalImage ? Math.min(x, originalImage.width - crop.width) : x;
                          onUpdateCrop({ x: Math.max(0, constrainedX) });
                        }}
                        className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        min="0"
                        max={originalImage ? originalImage.width - crop.width : undefined}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Y Position</label>
                      <input
                        type="number"
                        value={Math.round(crop.y)}
                        onChange={(e) => {
                          const y = parseInt(e.target.value) || 0;
                          const constrainedY = originalImage ? Math.min(y, originalImage.height - crop.height) : y;
                          onUpdateCrop({ y: Math.max(0, constrainedY) });
                        }}
                        className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        min="0"
                        max={originalImage ? originalImage.height - crop.height : undefined}
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
              <div className="p-3 md:p-4 border-t border-gray-700 space-y-3">
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
                    <span>Discard</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 px-4 text-sm transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};