import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CropArea } from '../App';
import { CropContextMenu } from './CropContextMenu';

interface ViewportAwareCropCanvasProps {
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
  onCropDoubleClick: (cropId: string) => void;
  onUpdateGridCrops: (gridId: string, updates: Partial<CropArea>) => void;
  onCropDelete: (cropId: string) => void;
  onCropCopy: (cropId: string) => void;
  onCropRename: (cropId: string) => void;
  onUnlinkFromGrid: (cropId: string) => void;
  onCropExport: (cropId: string) => void;
}

interface ImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ViewportAwareCropCanvas: React.FC<ViewportAwareCropCanvasProps> = ({
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
  onCanvasResize,
  onCropDoubleClick,
  onUpdateGridCrops,
  onCropDelete,
  onCropCopy,
  onCropRename,
  onUnlinkFromGrid,
  onCropExport
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState<{ cropId: string; handle: string } | null>(null);
  const [rotating, setRotating] = useState<{ cropId: string; startAngle: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [lastPanOffset, setLastPanOffset] = useState({ x: 0, y: 0 });
  const [isCreatingCrop, setIsCreatingCrop] = useState(false);
  const [newCropStart, setNewCropStart] = useState({ x: 0, y: 0 });
  const [newCropEnd, setNewCropEnd] = useState({ x: 0, y: 0 });
  const [lastClickTime, setLastClickTime] = useState(0);
  const [lastClickedCrop, setLastClickedCrop] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    cropId: string | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    cropId: null
  });

  // Calculate image boundaries in canvas coordinates
  const getImageBounds = useCallback((): ImageBounds => {
    if (!originalImage) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    return {
      x: imageOffset.x,
      y: imageOffset.y,
      width: originalImage.width * imageScale,
      height: originalImage.height * imageScale
    };
  }, [originalImage, imageScale, imageOffset]);

  // Convert canvas coordinates to image coordinates
  const canvasToImageCoords = useCallback((canvasX: number, canvasY: number) => {
    if (!originalImage) return { x: 0, y: 0 };

    const imageX = (canvasX - imageOffset.x) / imageScale;
    const imageY = (canvasY - imageOffset.y) / imageScale;

    return { x: imageX, y: imageY };
  }, [originalImage, imageScale, imageOffset]);

  // Convert image coordinates to canvas coordinates
  const imageToCanvasCoords = useCallback((imageX: number, imageY: number) => {
    const canvasX = imageX * imageScale + imageOffset.x;
    const canvasY = imageY * imageScale + imageOffset.y;

    return { x: canvasX, y: canvasY };
  }, [imageScale, imageOffset]);

  // Constrain crop to image boundaries
  const constrainCropToImage = useCallback((crop: CropArea): CropArea => {
    if (!originalImage) return crop;

    let constrainedCrop = { ...crop };

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

  // Check if a point is within the image bounds
  const isPointInImage = useCallback((canvasX: number, canvasY: number): boolean => {
    const imageBounds = getImageBounds();
    return canvasX >= imageBounds.x && 
           canvasX <= imageBounds.x + imageBounds.width &&
           canvasY >= imageBounds.y && 
           canvasY <= imageBounds.y + imageBounds.height;
  }, [getImageBounds]);

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

    // Draw image boundary indicator
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(imageOffset.x, imageOffset.y, imgWidth, imgHeight);
    ctx.setLineDash([]);

    // Group crops by grid for visual consistency and sort by zIndex
    const gridGroups = new Map<string, CropArea[]>();
    const individualCrops: CropArea[] = [];
    
    // Filter visible crops and sort by zIndex
    const visibleCrops = cropAreas
      .filter(crop => crop.visible !== false)
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    
    visibleCrops.forEach(crop => {
      if (crop.gridId) {
        if (!gridGroups.has(crop.gridId)) {
          gridGroups.set(crop.gridId, []);
        }
        gridGroups.get(crop.gridId)!.push(crop);
      } else {
        individualCrops.push(crop);
      }
    });

    // Draw grid connections first (behind crops)
    gridGroups.forEach((gridCrops, gridId) => {
      if (gridCrops.length > 1) {
        ctx.strokeStyle = 'rgba(147, 51, 234, 0.3)'; // Purple connection lines
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        
        // Convert grid crop coordinates to canvas coordinates for drawing
        const canvasGridCrops = gridCrops.map(crop => {
          const canvasPos = imageToCanvasCoords(crop.x, crop.y);
          const canvasEnd = imageToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
          return {
            x: canvasPos.x,
            y: canvasPos.y,
            width: canvasEnd.x - canvasPos.x,
            height: canvasEnd.y - canvasPos.y
          };
        });
        
        // Draw grid outline
        const minX = Math.min(...canvasGridCrops.map(c => c.x));
        const minY = Math.min(...canvasGridCrops.map(c => c.y));
        const maxX = Math.max(...canvasGridCrops.map(c => c.x + c.width));
        const maxY = Math.max(...canvasGridCrops.map(c => c.y + c.height));
        
        ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
        ctx.setLineDash([]);
      }
    });

    // Draw crop areas with image boundary awareness
    const allCrops = [...individualCrops, ...Array.from(gridGroups.values()).flat()];
    
    allCrops.forEach(crop => {
      const isSelected = crop.id === selectedCropId;
      const isGridCrop = !!crop.gridId;
      const rotation = crop.rotation || 0;
      
      // Convert crop coordinates (image space) to canvas coordinates for drawing
      const canvasPos = imageToCanvasCoords(crop.x, crop.y);
      const canvasEnd = imageToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
      const canvasWidth = canvasEnd.x - canvasPos.x;
      const canvasHeight = canvasEnd.y - canvasPos.y;
      
      // Check if crop extends beyond image boundaries
      const isWithinImageBounds = crop.x >= 0 && 
                                  crop.y >= 0 && 
                                  crop.x + crop.width <= originalImage.width && 
                                  crop.y + crop.height <= originalImage.height;
      
      // Calculate rotation values
      const centerX = canvasPos.x + canvasWidth / 2;
      const centerY = canvasPos.y + canvasHeight / 2;
      const cos = Math.cos((rotation * Math.PI) / 180);
      const sin = Math.sin((rotation * Math.PI) / 180);
      
      // Save context for rotation
      ctx.save();
      
      // Move to crop center for rotation
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
      
      // Draw crop rectangle with boundary awareness
      let strokeColor = '#10B981'; // Default green
      if (isSelected) {
        strokeColor = '#3B82F6'; // Blue for selected
      } else if (isGridCrop) {
        strokeColor = '#9333EA'; // Purple for grid crops
      } else if (!isWithinImageBounds) {
        strokeColor = '#EF4444'; // Red for out of bounds
      }
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [] : (isWithinImageBounds ? [5, 5] : [10, 5]));
      ctx.strokeRect(canvasPos.x, canvasPos.y, canvasWidth, canvasHeight);

      // Draw overlay with different opacity based on status
      let overlayOpacity = 0.05;
      let overlayColor = '16, 185, 129'; // Green
      
      if (isSelected) {
        overlayOpacity = 0.1;
        overlayColor = '59, 130, 246'; // Blue
      } else if (isGridCrop) {
        overlayOpacity = 0.08;
        overlayColor = '147, 51, 234'; // Purple
      } else if (!isWithinImageBounds) {
        overlayOpacity = 0.15;
        overlayColor = '239, 68, 68'; // Red
      }
      
      ctx.fillStyle = `rgba(${overlayColor}, ${overlayOpacity})`;
      ctx.fillRect(canvasPos.x, canvasPos.y, canvasWidth, canvasHeight);

      // Restore context
      ctx.restore();

      // Draw resize handles and rotation handle for selected crop
      if (isSelected) {
        const handleSize = 10;
        ctx.fillStyle = isGridCrop ? '#9333EA' : '#3B82F6';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        
        const rotatePoint = (x: number, y: number) => {
          const dx = x - centerX;
          const dy = y - centerY;
          return {
            x: centerX + dx * cos - dy * sin,
            y: centerY + dx * sin + dy * cos
          };
        };
        
        // Corner handles
        const corners = [
          { x: canvasPos.x, y: canvasPos.y }, // top-left
          { x: canvasPos.x + canvasWidth, y: canvasPos.y }, // top-right
          { x: canvasPos.x, y: canvasPos.y + canvasHeight }, // bottom-left
          { x: canvasPos.x + canvasWidth, y: canvasPos.y + canvasHeight }, // bottom-right
        ];
        
        corners.forEach(corner => {
          const rotated = rotatePoint(corner.x, corner.y);
          ctx.fillRect(rotated.x - handleSize/2, rotated.y - handleSize/2, handleSize, handleSize);
          ctx.strokeRect(rotated.x - handleSize/2, rotated.y - handleSize/2, handleSize, handleSize);
        });

        // Edge handles
        const edges = [
          { x: canvasPos.x + canvasWidth/2, y: canvasPos.y }, // top
          { x: canvasPos.x + canvasWidth/2, y: canvasPos.y + canvasHeight }, // bottom
          { x: canvasPos.x, y: canvasPos.y + canvasHeight/2 }, // left
          { x: canvasPos.x + canvasWidth, y: canvasPos.y + canvasHeight/2 }, // right
        ];
        
        edges.forEach(edge => {
          const rotated = rotatePoint(edge.x, edge.y);
          ctx.fillRect(rotated.x - handleSize/2, rotated.y - handleSize/2, handleSize, handleSize);
          ctx.strokeRect(rotated.x - handleSize/2, rotated.y - handleSize/2, handleSize, handleSize);
        });

        // Rotation handle (circle above the crop)
        const rotationHandleDistance = 30;
        const rotationHandle = rotatePoint(
          canvasPos.x + canvasWidth/2, 
          canvasPos.y - rotationHandleDistance
        );
        
        // Draw line from crop to rotation handle
        ctx.strokeStyle = isGridCrop ? '#9333EA' : '#3B82F6';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        const topCenter = rotatePoint(canvasPos.x + canvasWidth/2, canvasPos.y);
        ctx.beginPath();
        ctx.moveTo(topCenter.x, topCenter.y);
        ctx.lineTo(rotationHandle.x, rotationHandle.y);
        ctx.stroke();
        
        // Draw rotation handle (circle)
        ctx.setLineDash([]);
        ctx.fillStyle = rotating?.cropId === crop.id ? '#F59E0B' : '#F59E0B';
        ctx.strokeStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(rotationHandle.x, rotationHandle.y, handleSize/2 + 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Draw rotation icon (curved arrow)
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rotationHandle.x, rotationHandle.y, 4, -Math.PI/2, Math.PI/2);
        ctx.stroke();
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(rotationHandle.x + 2, rotationHandle.y + 4);
        ctx.lineTo(rotationHandle.x + 4, rotationHandle.y + 2);
        ctx.lineTo(rotationHandle.x + 4, rotationHandle.y + 6);
        ctx.closePath();
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }

      // Draw label with background (always horizontal) with boundary awareness
      if (crop.name) {
        ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        const textWidth = ctx.measureText(crop.name).width;
        const padding = 8;
        
        // Position label above the crop (accounting for rotation)
        const labelY = Math.min(canvasPos.y, centerY - canvasHeight/2 * Math.abs(cos) - canvasWidth/2 * Math.abs(sin)) - 35;
        
        // Label background with appropriate color
        let labelColor = '#10B981'; // Green
        if (isSelected) {
          labelColor = '#3B82F6'; // Blue
        } else if (isGridCrop) {
          labelColor = '#9333EA'; // Purple
        } else if (!isWithinImageBounds) {
          labelColor = '#EF4444'; // Red
        }
        
        ctx.fillStyle = labelColor;
        ctx.fillRect(canvasPos.x, labelY, textWidth + padding * 2, 24);
        
        // Label text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(crop.name, canvasPos.x + padding, labelY + 16);
      }
    });

    // Draw new crop being created with image boundary constraints
    if (isCreatingCrop) {
      const x = Math.min(newCropStart.x, newCropEnd.x);
      const y = Math.min(newCropStart.y, newCropEnd.y);
      const width = Math.abs(newCropEnd.x - newCropStart.x);
      const height = Math.abs(newCropEnd.y - newCropStart.y);

      if (width > 5 && height > 5) {
        // Check if new crop would be within image bounds
        const imageBounds = getImageBounds();
        const newCropInImageBounds = x >= imageBounds.x && 
                                     x + width <= imageBounds.x + imageBounds.width &&
                                     y >= imageBounds.y && 
                                     y + height <= imageBounds.y + imageBounds.height;

        // Draw dashed rectangle for new crop
        ctx.strokeStyle = newCropInImageBounds ? '#F59E0B' : '#EF4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(x, y, width, height);

        // Draw semi-transparent overlay
        const overlayColor = newCropInImageBounds ? '245, 158, 11' : '239, 68, 68';
        ctx.fillStyle = `rgba(${overlayColor}, 0.1)`;
        ctx.fillRect(x, y, width, height);

        // Draw dimensions label
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x + 5, y + 5, 140, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        
        // Convert canvas dimensions to image dimensions for display
        const imageCoords = canvasToImageCoords(x, y);
        const imageEnd = canvasToImageCoords(x + width, y + height);
        const imageWidth = Math.round(imageEnd.x - imageCoords.x);
        const imageHeight = Math.round(imageEnd.y - imageCoords.y);
        
        const statusText = newCropInImageBounds ? 
          `${imageWidth} × ${imageHeight}` : 
          `${imageWidth} × ${imageHeight} (Out of bounds)`;
        ctx.fillText(statusText, x + 10, y + 18);
      }
    }
  }, [originalImage, imageScale, imageOffset, cropAreas, selectedCropId, isCreatingCrop, newCropStart, newCropEnd, rotating, getImageBounds, imageToCanvasCoords, canvasToImageCoords]);

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
    // Also consider zIndex for proper layering
    const sortedCrops = [...cropAreas]
      .filter(crop => crop.visible !== false)
      .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    
    for (const crop of sortedCrops) {
      const rotation = crop.rotation || 0;
      
      // Convert crop coordinates to canvas coordinates
      const canvasPos = imageToCanvasCoords(crop.x, crop.y);
      const canvasEnd = imageToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
      
      // Transform point to crop's local coordinate system
      const centerX = canvasPos.x + (canvasEnd.x - canvasPos.x) / 2;
      const centerY = canvasPos.y + (canvasEnd.y - canvasPos.y) / 2;
      const cos = Math.cos((-rotation * Math.PI) / 180);
      const sin = Math.sin((-rotation * Math.PI) / 180);
      
      const dx = x - centerX;
      const dy = y - centerY;
      const localX = centerX + dx * cos - dy * sin;
      const localY = centerY + dx * sin + dy * cos;
      
      if (localX >= canvasPos.x && localX <= canvasEnd.x &&
          localY >= canvasPos.y && localY <= canvasEnd.y) {
        return crop;
      }
    }
    return null;
  };

  const getResizeHandle = (x: number, y: number, crop: CropArea) => {
    const handleSize = 10;
    const rotation = crop.rotation || 0;
    
    // Convert crop coordinates to canvas coordinates
    const canvasPos = imageToCanvasCoords(crop.x, crop.y);
    const canvasEnd = imageToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
    const canvasWidth = canvasEnd.x - canvasPos.x;
    const canvasHeight = canvasEnd.y - canvasPos.y;
    
    const centerX = canvasPos.x + canvasWidth / 2;
    const centerY = canvasPos.y + canvasHeight / 2;
    const cos = Math.cos((rotation * Math.PI) / 180);
    const sin = Math.sin((rotation * Math.PI) / 180);
    
    const rotatePoint = (px: number, py: number) => {
      const dx = px - centerX;
      const dy = py - centerY;
      return {
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos
      };
    };
    
    const handles = [
      { name: 'tl', x: canvasPos.x, y: canvasPos.y },
      { name: 'tr', x: canvasPos.x + canvasWidth, y: canvasPos.y },
      { name: 'bl', x: canvasPos.x, y: canvasPos.y + canvasHeight },
      { name: 'br', x: canvasPos.x + canvasWidth, y: canvasPos.y + canvasHeight },
      { name: 't', x: canvasPos.x + canvasWidth/2, y: canvasPos.y },
      { name: 'b', x: canvasPos.x + canvasWidth/2, y: canvasPos.y + canvasHeight },
      { name: 'l', x: canvasPos.x, y: canvasPos.y + canvasHeight/2 },
      { name: 'r', x: canvasPos.x + canvasWidth, y: canvasPos.y + canvasHeight/2 },
    ];

    for (const handle of handles) {
      const rotated = rotatePoint(handle.x, handle.y);
      if (x >= rotated.x - handleSize/2 && x <= rotated.x + handleSize/2 &&
          y >= rotated.y - handleSize/2 && y <= rotated.y + handleSize/2) {
        return handle.name;
      }
    }
    
    return null;
  };

  const getRotationHandle = (x: number, y: number, crop: CropArea) => {
    const handleSize = 14;
    const rotation = crop.rotation || 0;
    
    // Convert crop coordinates to canvas coordinates
    const canvasPos = imageToCanvasCoords(crop.x, crop.y);
    const canvasEnd = imageToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
    const canvasWidth = canvasEnd.x - canvasPos.x;
    const canvasHeight = canvasEnd.y - canvasPos.y;
    
    const centerX = canvasPos.x + canvasWidth / 2;
    const centerY = canvasPos.y + canvasHeight / 2;
    const cos = Math.cos((rotation * Math.PI) / 180);
    const sin = Math.sin((rotation * Math.PI) / 180);
    
    const rotationHandleDistance = 30;
    const dx = 0;
    const dy = -rotationHandleDistance;
    const rotationHandleX = centerX + dx * cos - dy * sin;
    const rotationHandleY = centerY + dx * sin + dy * cos;
    
    const distance = Math.sqrt(
      Math.pow(x - rotationHandleX, 2) + Math.pow(y - rotationHandleY, 2)
    );
    
    return distance <= handleSize ? 'rotate' : null;
  };

  const calculateAngleFromCenter = (centerX: number, centerY: number, mouseX: number, mouseY: number) => {
    const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
    const degrees = (angle * 180) / Math.PI + 90; // Add 90 to make 0 degrees point up
    return ((degrees % 360) + 360) % 360; // Normalize to 0-360 range
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const pos = getMousePos(e);
    const cropAtPos = getCropAt(pos.x, pos.y);
    
    if (cropAtPos) {
      setContextMenu({
        isOpen: true,
        position: { x: e.clientX, y: e.clientY },
        cropId: cropAtPos.id
      });
      onCropSelect(cropAtPos.id);
    } else {
      closeContextMenu();
    }
  };

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, cropId: null });
  };

  // Context menu action handlers
  const handleCropDuplicate = () => {
    if (!contextMenu.cropId) return;
    
    const crop = cropAreas.find(c => c.id === contextMenu.cropId);
    if (!crop) return;
    
    onCropCopy(crop.id);
    closeContextMenu();
  };

  const handleAdvancedEdit = () => {
    if (!contextMenu.cropId) return;
    
    onCropDoubleClick(contextMenu.cropId);
    closeContextMenu();
  };

  const handleFitToImage = () => {
    if (!contextMenu.cropId || !originalImage) return;
    
    const crop = cropAreas.find(c => c.id === contextMenu.cropId);
    if (!crop) return;
    
    const updates = {
      x: 0,
      y: 0,
      width: originalImage.width,
      height: originalImage.height,
      rotation: 0
    };
    
    if (crop.gridId) {
      onUpdateGridCrops(crop.gridId, updates);
    } else {
      onCropUpdate(crop.id, updates);
    }
    closeContextMenu();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Close context menu on any click
    if (contextMenu.isOpen) {
      closeContextMenu();
      return;
    }

    const pos = getMousePos(e);
    const selectedCrop = cropAreas.find(crop => crop.id === selectedCropId);
    
    // Check for rotation handle first
    if (selectedCrop) {
      const rotationHandle = getRotationHandle(pos.x, pos.y, selectedCrop);
      if (rotationHandle) {
        const canvasPos = imageToCanvasCoords(selectedCrop.x, selectedCrop.y);
        const canvasEnd = imageToCanvasCoords(selectedCrop.x + selectedCrop.width, selectedCrop.y + selectedCrop.height);
        const centerX = canvasPos.x + (canvasEnd.x - canvasPos.x) / 2;
        const centerY = canvasPos.y + (canvasEnd.y - canvasPos.y) / 2;
        const startAngle = calculateAngleFromCenter(centerX, centerY, pos.x, pos.y);
        setRotating({ cropId: selectedCrop.id, startAngle });
        return;
      }
      
      // Check for resize handles
      const handle = getResizeHandle(pos.x, pos.y, selectedCrop);
      if (handle) {
        setResizing({ cropId: selectedCrop.id, handle });
        return;
      }
    }

    // Check for crop selection
    const cropAtPos = getCropAt(pos.x, pos.y);
    if (cropAtPos) {
      // Handle double-click detection
      const currentTime = Date.now();
      if (lastClickedCrop === cropAtPos.id && currentTime - lastClickTime < 300) {
        // Double-click detected
        onCropDoubleClick(cropAtPos.id);
        return;
      }
      
      setLastClickTime(currentTime);
      setLastClickedCrop(cropAtPos.id);
      
      onCropSelect(cropAtPos.id);
      setIsDragging(true);
      setDragStart(pos);
    } else {
      // Start creating new crop or panning
      onCropSelect(null);
      setLastClickedCrop(null);
      
      if (e.button === 0) { // Left mouse button
        // Check if we're over the image area to decide between creating crop or panning
        if (isPointInImage(pos.x, pos.y)) {
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
    
    if (rotating) {
      const crop = cropAreas.find(c => c.id === rotating.cropId);
      if (!crop) return;

      const canvasPos = imageToCanvasCoords(crop.x, crop.y);
      const canvasEnd = imageToCanvasCoords(crop.x + crop.width, crop.y + crop.height);
      const centerX = canvasPos.x + (canvasEnd.x - canvasPos.x) / 2;
      const centerY = canvasPos.y + (canvasEnd.y - canvasPos.y) / 2;
      
      // Calculate current angle from center to mouse position
      const currentAngle = calculateAngleFromCenter(centerX, centerY, pos.x, pos.y);
      
      // Calculate the difference from the starting angle
      let angleDiff = currentAngle - rotating.startAngle;
      
      // Handle angle wrapping
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;
      
      // Apply the angle difference to the crop's current rotation
      const currentRotation = crop.rotation || 0;
      let newRotation = currentRotation + angleDiff;
      
      // Snap to 15-degree increments when holding Shift
      if (e.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15;
      }
      
      // Normalize angle to 0-360 range
      newRotation = ((newRotation % 360) + 360) % 360;
      
      // Update crop or grid
      if (crop.gridId) {
        onUpdateGridCrops(crop.gridId, { rotation: newRotation });
      } else {
        onCropUpdate(crop.id, { rotation: newRotation });
      }
      
      // Update the start angle for the next movement
      setRotating({ ...rotating, startAngle: currentAngle });
    } else if (resizing) {
      const crop = cropAreas.find(c => c.id === resizing.cropId);
      if (!crop) return;

      // Convert mouse position to image coordinates
      const imagePos = canvasToImageCoords(pos.x, pos.y);
      
      let newCrop = { ...crop };
      const rotation = crop.rotation || 0;
      const centerX = crop.x + crop.width / 2;
      const centerY = crop.y + crop.height / 2;
      
      // Transform mouse position to crop's local coordinate system
      const cos = Math.cos((-rotation * Math.PI) / 180);
      const sin = Math.sin((-rotation * Math.PI) / 180);
      const dx = imagePos.x - centerX;
      const dy = imagePos.y - centerY;
      const localX = centerX + dx * cos - dy * sin;
      const localY = centerY + dx * sin + dy * cos;
      
      switch (resizing.handle) {
        case 'tl':
          newCrop.width = crop.width + (crop.x - localX);
          newCrop.height = crop.height + (crop.y - localY);
          newCrop.x = localX;
          newCrop.y = localY;
          break;
        case 'tr':
          newCrop.width = localX - crop.x;
          newCrop.height = crop.height + (crop.y - localY);
          newCrop.y = localY;
          break;
        case 'bl':
          newCrop.width = crop.width + (crop.x - localX);
          newCrop.height = localY - crop.y;
          newCrop.x = localX;
          break;
        case 'br':
          newCrop.width = localX - crop.x;
          newCrop.height = localY - crop.y;
          break;
        case 't':
          newCrop.height = crop.height + (crop.y - localY);
          newCrop.y = localY;
          break;
        case 'b':
          newCrop.height = localY - crop.y;
          break;
        case 'l':
          newCrop.width = crop.width + (crop.x - localX);
          newCrop.x = localX;
          break;
        case 'r':
          newCrop.width = localX - crop.x;
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
      newCrop.width = Math.max(10, newCrop.width);
      newCrop.height = Math.max(10, newCrop.height);

      // Apply image boundary constraints
      newCrop = constrainCropToImage(newCrop);

      // Update crop or grid
      if (crop.gridId) {
        onUpdateGridCrops(crop.gridId, {
          width: newCrop.width,
          height: newCrop.height
        });
      } else {
        onCropUpdate(crop.id, newCrop);
      }
    } else if (isDragging && selectedCropId) {
      const crop = cropAreas.find(c => c.id === selectedCropId);
      if (crop) {
        const deltaX = pos.x - dragStart.x;
        const deltaY = pos.y - dragStart.y;
        
        // Convert canvas delta to image coordinates
        const startImagePos = canvasToImageCoords(dragStart.x, dragStart.y);
        const currentImagePos = canvasToImageCoords(pos.x, pos.y);
        const imageDeltaX = currentImagePos.x - startImagePos.x;
        const imageDeltaY = currentImagePos.y - startImagePos.y;
        
        let newCrop = {
          ...crop,
          x: crop.x + imageDeltaX,
          y: crop.y + imageDeltaY
        };

        // Apply image boundary constraints
        newCrop = constrainCropToImage(newCrop);
        
        // For grid crops, move the entire grid
        if (crop.gridId) {
          const gridCrops = cropAreas.filter(c => c.gridId === crop.gridId);
          const actualDeltaX = newCrop.x - crop.x;
          const actualDeltaY = newCrop.y - crop.y;
          
          gridCrops.forEach(gridCrop => {
            if (gridCrop.id !== crop.id) {
              const updatedGridCrop = {
                x: gridCrop.x + actualDeltaX,
                y: gridCrop.y + actualDeltaY
              };
              onCropUpdate(gridCrop.id, constrainCropToImage({ ...gridCrop, ...updatedGridCrop }));
            }
          });
        }
        
        onCropUpdate(crop.id, newCrop);
        setDragStart(pos);
      }
    } else if (isCreatingCrop) {
      setNewCropEnd(pos);
    } else if (isPanning) {
      const deltaX = pos.x - panStart.x;
      const deltaY = pos.y - panStart.y;
      
      const newOffset = {
        x: lastPanOffset.x + deltaX,
        y: lastPanOffset.y + deltaY
      };
      
      onImageTransform({
        scale: imageScale,
        offset: newOffset
      });
    }

    // Update cursor based on context
    const canvas = canvasRef.current;
    if (canvas) {
      const selectedCrop = cropAreas.find(crop => crop.id === selectedCropId);
      if (selectedCrop) {
        if (getRotationHandle(pos.x, pos.y, selectedCrop)) {
          canvas.style.cursor = rotating ? 'grabbing' : 'grab';
        } else if (getResizeHandle(pos.x, pos.y, selectedCrop)) {
          canvas.style.cursor = 'nw-resize';
        } else if (getCropAt(pos.x, pos.y)) {
          canvas.style.cursor = 'move';
        } else {
          canvas.style.cursor = isCreatingCrop ? 'crosshair' : (isPanning ? 'grabbing' : 'grab');
        }
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
        // Convert canvas coordinates to image coordinates
        const startImagePos = canvasToImageCoords(x, y);
        const endImagePos = canvasToImageCoords(x + width, y + height);
        
        const maxZIndex = cropAreas.length > 0 ? Math.max(...cropAreas.map(c => c.zIndex || 0)) : 0;
        
        let newCrop: Omit<CropArea, 'id'> = {
          x: startImagePos.x,
          y: startImagePos.y,
          width: endImagePos.x - startImagePos.x,
          height: endImagePos.y - startImagePos.y,
          rotation: 0,
          name: `Crop ${cropAreas.length + 1}`,
          visible: true,
          zIndex: maxZIndex + 1
        };

        // Apply image boundary constraints to new crop
        const constrainedCrop = constrainCropToImage({ ...newCrop, id: 'temp' });
        newCrop = {
          x: constrainedCrop.x,
          y: constrainedCrop.y,
          width: constrainedCrop.width,
          height: constrainedCrop.height,
          rotation: constrainedCrop.rotation,
          name: constrainedCrop.name,
          visible: constrainedCrop.visible,
          zIndex: constrainedCrop.zIndex
        };

        onCropAdd(newCrop);
      }

      setIsCreatingCrop(false);
      setNewCropStart({ x: 0, y: 0 });
      setNewCropEnd({ x: 0, y: 0 });
    }

    setIsDragging(false);
    setResizing(null);
    setRotating(null);
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

  const contextMenuCrop = contextMenu.cropId ? cropAreas.find(c => c.id === contextMenu.cropId) : null;

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
        onContextMenu={handleContextMenu}
        style={{ cursor: 'grab' }}
      />
      
      {/* Context Menu */}
      <CropContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        crop={contextMenuCrop}
        onClose={closeContextMenu}
        onDuplicate={handleCropDuplicate}
        onAdvancedEdit={handleAdvancedEdit}
        onFitToImage={handleFitToImage}
      />

      {cropAreas.length === 0 && !isCreatingCrop && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-800/90 rounded-lg p-8 text-center max-w-md">
            <h3 className="text-xl font-semibold text-white mb-3">Ready to Crop!</h3>
            <p className="text-gray-300 mb-2">Click and drag on the image to create a crop area</p>
            <p className="text-sm text-gray-400">
              • Drag on image to create crops<br/>
              • Drag crops to move them<br/>
              • Use rotation handle to rotate<br/>
              • Scroll to zoom<br/>
              • Drag empty space to pan<br/>
              • Double-click crop for advanced editing<br/>
              • Right-click crop for context menu<br/>
              • Crops are constrained to image boundaries
            </p>
          </div>
        </div>
      )}
    </div>
  );
};