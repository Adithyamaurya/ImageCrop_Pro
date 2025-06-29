import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Settings, ChevronLeft, ChevronRight, RotateCw, Download, Eye, EyeOff, Undo, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
  const [canvasToImageScale, setCanvasToImageScale] = useState({ x: 1, y: 1 });
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

  // Mobile responsive states
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 1024);

  // Store the original crop state when the editor opens or when switching crops
  useEffect(() => {
    if (isOpen && crop) {
      setOriginalCropState({ ...crop });
    }
  }, [isOpen, crop.id]); // Only reset when crop ID changes or editor opens

  // Handle window resize for mobile responsiveness
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      const shouldCollapse = window.innerWidth < 1024;
      setIsMobile(mobile);
      setSidebarCollapsed(shouldCollapse);
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

  // Convert canvas coordinates to image coordinates (for the advanced editor)
  const canvasToImageCoords = useCallback((canvasX: number, canvasY: number) => {
    if (showUncropped) {
      // Account for zoom and pan in context view
      const adjustedX = (canvasX - previewOffset.x) / previewScale;
      const adjustedY = (canvasY - previewOffset.y) / previewScale;
      
      // Convert to image coordinates
      const imageX = adjustedX / canvasToImageScale.x;
      const imageY = adjustedY / canvasToImageScale.y;
      
      return { x: imageX, y: imageY };
    } else {
      // In crop-only view, account for zoom and pan
      const imageX = (canvasX - previewOffset.x) / previewScale;
      const imageY = (canvasY - previewOffset.y) / previewScale;
      return { x: imageX, y: imageY };
    }
  }, [showUncropped, canvasToImageScale, previewScale, previewOffset]);

  // Convert image coordinates to canvas coordinates (for the advanced editor)
  const imageToCanvasCoords = useCallback((imageX: number, imageY: number) => {
    if (showUncropped) {
      // Convert to canvas coords and apply zoom/pan
      const canvasX = imageX * canvasToImageScale.x * previewScale + previewOffset.x;
      const canvasY = imageY * canvasToImageScale.y * previewScale + previewOffset.y;
      
      return { x: canvasX, y: canvasY };
    } else {
      // In crop-only view, apply zoom and pan
      return { 
        x: imageX * previewScale + previewOffset.x, 
        y: imageY * previewScale + previewOffset.y 
      };
    }
  }, [showUncropped, canvasToImageScale, previewScale, previewOffset]);

  // Check if a point is within the crop area
  const isPointInCrop = useCallback((canvasX: number, canvasY: number) => {
    if (!showUncropped) return true; // In crop-only mode, entire canvas is draggable
    
    const cropCanvas = imageToCanvasCoords(crop.x, crop.y);
    const cropCanvasEnd = imageToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
    
    return canvasX >= cropCanvas.x && canvasX <= cropCanvasEnd.x &&
           canvasY >= cropCanvas.y && canvasY <= cropCanvasEnd.y;
  }, [crop, showUncropped, imageToCanvasCoords]);

  // Get resize handle at position
  const getResizeHandle = useCallback((canvasX: number, canvasY: number) => {
    if (!showUncropped) return null;
    
    const cropCanvas = imageToCanvasCoords(crop.x, crop.y);
    const cropCanvasEnd = imageToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
    const cropCanvasWidth = cropCanvasEnd.x - cropCanvas.x;
    const cropCanvasHeight = cropCanvasEnd.y - cropCanvas.y;
    
    const handleSize = (isMobile ? 16 : 12) * previewScale; // Larger handles on mobile, scale with zoom
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
  }, [crop, showUncropped, imageToCanvasCoords, previewScale, isMobile]);

  // Constrain crop to image boundaries
  const constrainCropToImage = useCallback((newCrop: CropArea): CropArea => {
    if (!originalImage) return newCrop;

    let constrainedCrop = { ...newCrop };

    // Ensure crop doesn't go outside image boundaries
    constrainedCrop.x = Math.max(0, Math.min(constrainedCrop.x, originalImage.width - constrainedCrop.width));
    constrainedCrop.y = Math.max(0, Math.min(constrainedCrop.y, originalImage.height - constrainedCrop.height));

    // Ensure crop doesn't become larger than image
    constrainedCrop.width = Math.min(constrainedCrop.width, originalImage.width - constrainedCrop.x);
    constrainedCrop.height = Math.min(constrainedCrop.height, originalImage.height - constrainedCrop.y);

    // Ensure minimum crop size
    const minCropSize = 10;
    constrainedCrop.width = Math.max(minCropSize, constrainedCrop.width);
    constrainedCrop.height = Math.max(minCropSize, constrainedCrop.height);

    return constrainedCrop;
  }, [originalImage]);

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
      
      if (imgAspect > 1) {
        baseWidth = Math.min(maxWidth, originalImage.width * (isMobile ? 0.3 : 0.5));
        baseHeight = baseWidth / imgAspect;
      } else {
        baseHeight = Math.min(maxHeight, originalImage.height * (isMobile ? 0.3 : 0.5));
        baseWidth = baseHeight * imgAspect;
      }
      
      // Ensure base size fits in container
      if (baseWidth > maxWidth) {
        baseWidth = maxWidth;
        baseHeight = baseWidth / imgAspect;
      }
      if (baseHeight > maxHeight) {
        baseHeight = maxHeight;
        baseWidth = baseHeight * imgAspect;
      }
      
      // Update coordinate transformation scales
      setCanvasToImageScale({
        x: baseWidth / originalImage.width,
        y: baseHeight / originalImage.height
      });
      
    } else {
      // Show only the crop area
      const cropAspect = crop.width / crop.height;
      
      if (cropAspect > 1) {
        baseWidth = Math.min(maxWidth, isMobile ? 400 : 600);
        baseHeight = baseWidth / cropAspect;
      } else {
        baseHeight = Math.min(maxHeight, isMobile ? 400 : 600);
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
      
      // Use crop coordinates directly (they're already in image space)
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
      const clampedImageX = Math.max(0, Math.min(crop.x, originalImage.width));
      const clampedImageY = Math.max(0, Math.min(crop.y, originalImage.height));
      const clampedImageWidth = Math.max(1, Math.min(crop.width, originalImage.width - clampedImageX));
      const clampedImageHeight = Math.max(1, Math.min(crop.height, originalImage.height - clampedImageY));

      // Draw the cropped portion at full opacity
      ctx.drawImage(
        originalImage,
        clampedImageX,
        clampedImageY,
        clampedImageWidth,
        clampedImageHeight,
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
      const handleSize = (isMobile ? 16 : 10) * previewScale; // Larger handles on mobile, scale with zoom
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

    // Draw grid overlay if enabled (after restoring pan offset)
    if (showGrid) {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      
      if (showUncropped) {
        // Grid over the entire canvas
        const gridWidth = canvas.width / 9;
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
  }, [originalImage, crop, previewScale, previewOffset, showGrid, showUncropped, isDragging, isResizing, isMobile]);

  useEffect(() => {
    if (isOpen) {
      drawPreview();
    }
  }, [isOpen, drawPreview]);

  // Unified event position getter for mouse and touch
  const getEventPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      // Mouse event
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  // Unified start handler for mouse and touch
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

  // Unified move handler for mouse and touch
  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getEventPos(e);
    const canvas = canvasRef.current;
    
    if (isResizing && resizeHandle) {
      // Handle resizing
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      
      // Convert canvas deltas to image coordinate deltas
      const imageDelta = canvasToImageCoords(deltaX, deltaY);
      const imageOrigin = canvasToImageCoords(0, 0);
      const imageDeltaX = imageDelta.x - imageOrigin.x;
      const imageDeltaY = imageDelta.y - imageOrigin.y;
      
      let newCrop = { ...crop };
      
      switch (resizeHandle) {
        case 'nw':
          newCrop.width = originalSize.width - imageDeltaX;
          newCrop.height = originalSize.height - imageDeltaY;
          newCrop.x = originalPosition.x + imageDeltaX;
          newCrop.y = originalPosition.y + imageDeltaY;
          break;
        case 'ne':
          newCrop.width = originalSize.width + imageDeltaX;
          newCrop.height = originalSize.height - imageDeltaY;
          newCrop.y = originalPosition.y + imageDeltaY;
          break;
        case 'sw':
          newCrop.width = originalSize.width - imageDeltaX;
          newCrop.height = originalSize.height + imageDeltaY;
          newCrop.x = originalPosition.x + imageDeltaX;
          break;
        case 'se':
          newCrop.width = originalSize.width + imageDeltaX;
          newCrop.height = originalSize.height + imageDeltaY;
          break;
        case 'n':
          newCrop.height = originalSize.height - imageDeltaY;
          newCrop.y = originalPosition.y + imageDeltaY;
          break;
        case 's':
          newCrop.height = originalSize.height + imageDeltaY;
          break;
        case 'w':
          newCrop.width = originalSize.width - imageDeltaX;
          newCrop.x = originalPosition.x + imageDeltaX;
          break;
        case 'e':
          newCrop.width = originalSize.width + imageDeltaX;
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
      
      // Ensure minimum size
      newCrop.width = Math.max(10, newCrop.width);
      newCrop.height = Math.max(10, newCrop.height);
      
      // Apply image boundary constraints
      newCrop = constrainCropToImage(newCrop);
      
      onUpdateCrop(newCrop);
      
    } else if (isDragging) {
      // Handle dragging
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      
      // Convert canvas delta to image coordinates
      const imageDelta = canvasToImageCoords(deltaX, deltaY);
      const imageOrigin = canvasToImageCoords(0, 0);
      const imageDeltaX = imageDelta.x - imageOrigin.x;
      const imageDeltaY = imageDelta.y - imageOrigin.y;
      
      // Calculate new position
      const newX = originalPosition.x + imageDeltaX;
      const newY = originalPosition.y + imageDeltaY;
      
      let newCrop = {
        ...crop,
        x: newX,
        y: newY
      };

      // Apply image boundary constraints
      newCrop = constrainCropToImage(newCrop);
      
      onUpdateCrop(newCrop);
      
      setDragStart(pos);
      setOriginalPosition({ x: newCrop.x, y: newCrop.y });
      
    } else if (isPanning) {
      // Handle panning
      const deltaX = pos.x - panStart.x;
      const deltaY = pos.y - panStart.y;
      
      setPreviewOffset({
        x: lastPanOffset.x + deltaX,
        y: lastPanOffset.y + deltaY
      });
      
    } else {
      // Update cursor based on what's under mouse (only for mouse events)
      if (canvas && !isDragging && !isResizing && !isPanning && !('touches' in e)) {
        const handle = getResizeHandle(pos.x, pos.y);
        if (handle) {
          // Set resize cursors
          const cursorMap: { [key: string]: string } = {
            'nw': 'nw-resize',
            'ne': 'ne-resize',
            'sw': 'sw-resize',
            'se': 'se-resize',
            'n': 'n-resize',
            's': 's-resize',
            'w': 'w-resize',
            'e': 'e-resize'
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

  // Unified end handler for mouse and touch
  const handleEnd = () => {
    setIsDragging(false);
    setIsResizing(false);
    setIsPanning(false);
    setResizeHandle(null);
    
    // Reset cursor
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleStart(e);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleMove(e);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleEnd();
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleStart(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleMove(e);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  const handleMouseLeave = () => {
    // Reset all interaction states when mouse leaves
    setIsDragging(false);
    setIsResizing(false);
    setIsPanning(false);
    setResizeHandle(null);
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  };

  // Zoom functionality
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const pos = getEventPos(e);
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, previewScale * delta));
    
    // Zoom towards mouse position
    const newOffset = {
      x: pos.x - (pos.x - previewOffset.x) * (newScale / previewScale),
      y: pos.y - (pos.y - previewOffset.y) * (newScale / previewScale)
    };
    
    setPreviewScale(newScale);
    setPreviewOffset(newOffset);
  };

  // Zoom controls
  const zoomIn = () => {
    const newScale = Math.min(5, previewScale * 1.2);
    setPreviewScale(newScale);
  };

  const zoomOut = () => {
    const newScale = Math.max(0.1, previewScale * 0.8);
    setPreviewScale(newScale);
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
      <div className={`bg-gray-900 rounded-xl shadow-2xl w-full h-full md:h-[90vh] flex flex-col ${
        isMobile ? 'max-w-full' : 'max-w-6xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2 md:space-x-4">
            <h2 className={`font-bold text-white ${isMobile ? 'text-lg' : 'text-xl'}`}>
              Advanced Editor
            </h2>
            <div className="text-xs md:text-sm text-gray-400">
              Crop {currentCropIndex + 1} of {allCrops.length}
            </div>
            {hasChanges && (
              <div className="text-xs text-orange-400 bg-orange-400/10 px-2 py-1 rounded">
                Modified
              </div>
            )}
            {(isDragging || isResizing) && (
              <div className="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded animate-pulse">
                {isDragging ? 'Moving' : 'Resizing'}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-1 md:space-x-2">
            {!isMobile && (
              <>
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
              </>
            )}
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
            {/* Mobile View Controls */}
            {isMobile && (
              <div className="flex items-center justify-between p-3 border-b border-gray-700">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowUncropped(!showUncropped)}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      showUncropped ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {showUncropped ? 'Context' : 'Crop Only'}
                  </button>
                  <button
                    onClick={() => setShowGrid(!showGrid)}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      showGrid ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Grid
                  </button>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={zoomOut}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
                  >
                    <ZoomOut className="h-3 w-3" />
                  </button>
                  <span className="text-xs text-gray-300 w-12 text-center">
                    {Math.round(previewScale * 100)}%
                  </span>
                  <button
                    onClick={zoomIn}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
                  >
                    <ZoomIn className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

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
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />

              {/* Zoom Level Indicator */}
              {previewScale !== 1 && (
                <div className="absolute top-2 md:top-4 left-2 md:left-4 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {Math.round(previewScale * 100)}%
                </div>
              )}

              {/* Preview Controls Overlay */}
              <div className="absolute bottom-1 md:bottom-2 left-1 md:left-2 bg-black/70 rounded px-2 py-1 text-xs text-white">
                {showUncropped ? 'Full Image Preview' : 'Crop Preview'} • {Math.round(crop.width)} × {Math.round(crop.height)}
                {crop.rotation && crop.rotation !== 0 && (
                  <span className="ml-2 text-orange-400">
                    ↻ {Math.round(crop.rotation)}°
                  </span>
                )}
                {(isDragging || isResizing) && (
                  <span className="ml-2 text-blue-400">
                    • {isDragging ? 'Moving' : 'Resizing'}
                  </span>
                )}
              </div>

              {/* View Mode Indicator */}
              <div className="absolute top-1 md:top-2 right-1 md:right-2 bg-black/70 rounded px-2 py-1 text-xs text-white">
                {showUncropped ? 'Context View' : 'Crop Only'}
              </div>

              {/* Interaction Instructions */}
              {!isDragging && !isResizing && !isPanning && (
                <div className="absolute bottom-1 md:bottom-2 right-1 md:right-2 bg-black/70 rounded px-2 py-1 text-xs text-white">
                  {isMobile ? 'Pinch to zoom • Drag to pan' : 'Scroll to zoom • Drag to pan • Resize handles • Constrained to image'}
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
                    title="Previous crop"
                  >
                    <ChevronLeft className="h-3 md:h-4 w-3 md:w-4" />
                    <span className="hidden md:inline">Previous</span>
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
                    title="Next crop"
                  >
                    <span className="hidden md:inline">Next</span>
                    <ChevronRight className="h-3 md:h-4 w-3 md:w-4" />
                  </button>
                </div>

                {/* Enhanced Zoom Controls - Desktop Only */}
                {!isMobile && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={zoomOut}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors flex items-center"
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-3 w-3" />
                    </button>
                    <span className="text-sm text-gray-300 w-16 text-center">
                      {Math.round(previewScale * 100)}%
                    </span>
                    <button
                      onClick={zoomIn}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors flex items-center"
                      title="Zoom In"
                    >
                      <ZoomIn className="h-3 w-3" />
                    </button>
                    <button
                      onClick={resetZoom}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors flex items-center"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Settings */}
          <div className={`bg-gray-900 border-l border-gray-700 flex flex-col ${
            isMobile ? 'w-full max-h-80' : sidebarCollapsed ? 'w-64' : 'w-80'
          }`}>
            <div className="p-3 md:p-4 border-b border-gray-700">
              <h3 className={`font-semibold text-white flex items-center ${isMobile ? 'text-base' : 'text-lg'}`}>
                <Settings className="h-4 md:h-5 w-4 md:w-5 mr-2" />
                Settings
              </h3>
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

              {/* Mobile View Options */}
              {isMobile && (
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
              )}

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
                        let newCrop = { ...crop, width };
                        newCrop = constrainCropToImage(newCrop);
                        onUpdateCrop(newCrop);
                      }}
                      className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      min="1"
                      max={originalImage?.width || 1000}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Height</label>
                    <input
                      type="number"
                      value={Math.round(crop.height)}
                      onChange={(e) => {
                        const height = parseInt(e.target.value) || 1;
                        let newCrop = { ...crop, height };
                        newCrop = constrainCropToImage(newCrop);
                        onUpdateCrop(newCrop);
                      }}
                      className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      min="1"
                      max={originalImage?.height || 1000}
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
                        let newCrop = { ...crop, x };
                        newCrop = constrainCropToImage(newCrop);
                        onUpdateCrop(newCrop);
                      }}
                      className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      min="0"
                      max={originalImage ? originalImage.width - crop.width : 1000}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Y Position</label>
                    <input
                      type="number"
                      value={Math.round(crop.y)}
                      onChange={(e) => {
                        const y = parseInt(e.target.value) || 0;
                        let newCrop = { ...crop, y };
                        newCrop = constrainCropToImage(newCrop);
                        onUpdateCrop(newCrop);
                      }}
                      className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      min="0"
                      max={originalImage ? originalImage.height - crop.height : 1000}
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

              {/* Image Boundary Info */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-blue-300 mb-2">Image Boundaries</h4>
                <div className="text-xs text-blue-200 space-y-1">
                  <div><strong>Image Size:</strong> {originalImage?.width || 0} × {originalImage?.height || 0}</div>
                  <div><strong>Crop Position:</strong> {Math.round(crop.x)}, {Math.round(crop.y)}</div>
                  <div><strong>Crop Size:</strong> {Math.round(crop.width)} × {Math.round(crop.height)}</div>
                  <div className="text-xs text-blue-300 mt-2">
                    Crops are automatically constrained to image boundaries
                  </div>
                </div>
              </div>
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