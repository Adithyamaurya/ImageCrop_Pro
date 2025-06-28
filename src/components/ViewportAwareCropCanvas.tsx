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

interface ViewportConstraints {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  viewportWidth: number;
  viewportHeight: number;
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
  const [viewportConstraints, setViewportConstraints] = useState<ViewportConstraints>({
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
    viewportWidth: 0,
    viewportHeight: 0
  });

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

  // Calculate viewport constraints
  const updateViewportConstraints = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const containerRect = container.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate safe boundaries within the viewport
    const viewportPadding = 20; // Minimum distance from viewport edges
    const controlsHeight = 60; // Space needed for crop controls
    
    const constraints: ViewportConstraints = {
      minX: viewportPadding,
      minY: viewportPadding + controlsHeight,
      maxX: window.innerWidth - viewportPadding,
      maxY: window.innerHeight - viewportPadding - controlsHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
    
    setViewportConstraints(constraints);
  }, []);

  // Update constraints on mount and window resize
  useEffect(() => {
    updateViewportConstraints();
    
    const handleResize = () => {
      updateViewportConstraints();
      // Auto-adjust image position if it goes out of bounds
      adjustImageToViewport();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateViewportConstraints]);

  // Adjust image position to stay within viewport
  const adjustImageToViewport = useCallback(() => {
    if (!originalImage || !viewportConstraints.viewportWidth) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const imgWidth = originalImage.width * imageScale;
    const imgHeight = originalImage.height * imageScale;

    let newOffset = { ...imageOffset };
    let needsUpdate = false;

    // Check if image extends beyond viewport boundaries
    const imageRight = canvasRect.left + imageOffset.x + imgWidth;
    const imageBottom = canvasRect.top + imageOffset.y + imgHeight;
    const imageLeft = canvasRect.left + imageOffset.x;
    const imageTop = canvasRect.top + imageOffset.y;

    // Adjust horizontal position
    if (imageRight < viewportConstraints.minX) {
      newOffset.x = viewportConstraints.minX - canvasRect.left - imgWidth + 100;
      needsUpdate = true;
    } else if (imageLeft > viewportConstraints.maxX) {
      newOffset.x = viewportConstraints.maxX - canvasRect.left - 100;
      needsUpdate = true;
    }

    // Adjust vertical position
    if (imageBottom < viewportConstraints.minY) {
      newOffset.y = viewportConstraints.minY - canvasRect.top - imgHeight + 100;
      needsUpdate = true;
    } else if (imageTop > viewportConstraints.maxY) {
      newOffset.y = viewportConstraints.maxY - canvasRect.top - 100;
      needsUpdate = true;
    }

    if (needsUpdate) {
      onImageTransform({ scale: imageScale, offset: newOffset });
    }
  }, [originalImage, imageScale, imageOffset, viewportConstraints, onImageTransform]);

  // Constrain crop to viewport boundaries
  const constrainCropToViewport = useCallback((crop: CropArea): CropArea => {
    const canvas = canvasRef.current;
    if (!canvas || !viewportConstraints.viewportWidth) return crop;

    const canvasRect = canvas.getBoundingClientRect();
    
    // Convert crop coordinates to screen coordinates
    const cropScreenX = canvasRect.left + crop.x;
    const cropScreenY = canvasRect.top + crop.y;
    const cropScreenRight = cropScreenX + crop.width;
    const cropScreenBottom = cropScreenY + crop.height;

    let constrainedCrop = { ...crop };
    let needsConstraint = false;

    // Constrain to viewport boundaries
    if (cropScreenX < viewportConstraints.minX) {
      constrainedCrop.x = viewportConstraints.minX - canvasRect.left;
      needsConstraint = true;
    }
    
    if (cropScreenY < viewportConstraints.minY) {
      constrainedCrop.y = viewportConstraints.minY - canvasRect.top;
      needsConstraint = true;
    }
    
    if (cropScreenRight > viewportConstraints.maxX) {
      constrainedCrop.x = viewportConstraints.maxX - canvasRect.left - crop.width;
      needsConstraint = true;
    }
    
    if (cropScreenBottom > viewportConstraints.maxY) {
      constrainedCrop.y = viewportConstraints.maxY - canvasRect.top - crop.height;
      needsConstraint = true;
    }

    // Ensure crop doesn't become too small due to viewport constraints
    const minCropSize = 50;
    if (constrainedCrop.width < minCropSize) {
      constrainedCrop.width = minCropSize;
    }
    if (constrainedCrop.height < minCropSize) {
      constrainedCrop.height = minCropSize;
    }

    return constrainedCrop;
  }, [viewportConstraints]);

  // Auto-adjust crop size if it would extend beyond viewport
  const adjustCropSizeForViewport = useCallback((crop: CropArea, newWidth?: number, newHeight?: number): CropArea => {
    const canvas = canvasRef.current;
    if (!canvas || !viewportConstraints.viewportWidth) return crop;

    const canvasRect = canvas.getBoundingClientRect();
    const cropScreenX = canvasRect.left + crop.x;
    const cropScreenY = canvasRect.top + crop.y;
    
    const maxAllowedWidth = viewportConstraints.maxX - cropScreenX;
    const maxAllowedHeight = viewportConstraints.maxY - cropScreenY;
    
    let adjustedCrop = { ...crop };
    
    if (newWidth !== undefined) {
      adjustedCrop.width = Math.min(newWidth, maxAllowedWidth);
    }
    
    if (newHeight !== undefined) {
      adjustedCrop.height = Math.min(newHeight, maxAllowedHeight);
    }
    
    // Maintain aspect ratio if set
    if (crop.aspectRatio && crop.aspectRatio > 0) {
      if (newWidth !== undefined && newHeight === undefined) {
        adjustedCrop.height = Math.min(adjustedCrop.width / crop.aspectRatio, maxAllowedHeight);
      } else if (newHeight !== undefined && newWidth === undefined) {
        adjustedCrop.width = Math.min(adjustedCrop.height * crop.aspectRatio, maxAllowedWidth);
      }
    }
    
    return adjustedCrop;
  }, [viewportConstraints]);

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

    // Draw viewport boundary indicators
    if (viewportConstraints.viewportWidth > 0) {
      const canvas = canvasRef.current;
      const canvasRect = canvas?.getBoundingClientRect();
      
      if (canvasRect) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        
        // Draw viewport safe area boundaries
        const safeLeft = Math.max(0, viewportConstraints.minX - canvasRect.left);
        const safeTop = Math.max(0, viewportConstraints.minY - canvasRect.top);
        const safeRight = Math.min(canvas.width, viewportConstraints.maxX - canvasRect.left);
        const safeBottom = Math.min(canvas.height, viewportConstraints.maxY - canvasRect.top);
        
        if (safeLeft > 0 || safeTop > 0 || safeRight < canvas.width || safeBottom < canvas.height) {
          ctx.strokeRect(safeLeft, safeTop, safeRight - safeLeft, safeBottom - safeTop);
        }
        
        ctx.setLineDash([]);
      }
    }

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
        
        // Draw grid outline
        const minX = Math.min(...gridCrops.map(c => c.x));
        const minY = Math.min(...gridCrops.map(c => c.y));
        const maxX = Math.max(...gridCrops.map(c => c.x + c.width));
        const maxY = Math.max(...gridCrops.map(c => c.y + c.height));
        
        ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
        ctx.setLineDash([]);
      }
    });

    // Draw crop areas with grid awareness
    const allCrops = [...individualCrops, ...Array.from(gridGroups.values()).flat()];
    
    allCrops.forEach(crop => {
      const isSelected = crop.id === selectedCropId;
      const isGridCrop = !!crop.gridId;
      const rotation = crop.rotation || 0;
      
      // Check if crop is within viewport
      const canvas = canvasRef.current;
      const canvasRect = canvas?.getBoundingClientRect();
      const isInViewport = canvasRect && 
        crop.x + crop.width > viewportConstraints.minX - canvasRect.left &&
        crop.x < viewportConstraints.maxX - canvasRect.left &&
        crop.y + crop.height > viewportConstraints.minY - canvasRect.top &&
        crop.y < viewportConstraints.maxY - canvasRect.top;
      
      // Calculate rotation values at the beginning of the loop
      const centerX = crop.x + crop.width / 2;
      const centerY = crop.y + crop.height / 2;
      const cos = Math.cos((rotation * Math.PI) / 180);
      const sin = Math.sin((rotation * Math.PI) / 180);
      
      // Save context for rotation
      ctx.save();
      
      // Move to crop center for rotation
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
      
      // Draw crop rectangle with grid and viewport awareness
      let strokeColor = '#10B981'; // Default green
      if (isSelected) {
        strokeColor = '#3B82F6'; // Blue for selected
      } else if (isGridCrop) {
        strokeColor = '#9333EA'; // Purple for grid crops
      } else if (!isInViewport) {
        strokeColor = '#EF4444'; // Red for out of viewport
      }
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [] : (isInViewport ? [5, 5] : [10, 5]));
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

      // Draw overlay with different opacity based on status
      let overlayOpacity = 0.05;
      let overlayColor = '16, 185, 129'; // Green
      
      if (isSelected) {
        overlayOpacity = 0.1;
        overlayColor = '59, 130, 246'; // Blue
      } else if (isGridCrop) {
        overlayOpacity = 0.08;
        overlayColor = '147, 51, 234'; // Purple
      } else if (!isInViewport) {
        overlayOpacity = 0.15;
        overlayColor = '239, 68, 68'; // Red
      }
      
      ctx.fillStyle = `rgba(${overlayColor}, ${overlayOpacity})`;
      ctx.fillRect(crop.x, crop.y, crop.width, crop.height);

      // Restore context
      ctx.restore();

      // Draw resize handles and rotation handle for selected crop (only if in viewport)
      if (isSelected && isInViewport) {
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
          { x: crop.x, y: crop.y }, // top-left
          { x: crop.x + crop.width, y: crop.y }, // top-right
          { x: crop.x, y: crop.y + crop.height }, // bottom-left
          { x: crop.x + crop.width, y: crop.y + crop.height }, // bottom-right
        ];
        
        corners.forEach(corner => {
          const rotated = rotatePoint(corner.x, corner.y);
          ctx.fillRect(rotated.x - handleSize/2, rotated.y - handleSize/2, handleSize, handleSize);
          ctx.strokeRect(rotated.x - handleSize/2, rotated.y - handleSize/2, handleSize, handleSize);
        });

        // Edge handles
        const edges = [
          { x: crop.x + crop.width/2, y: crop.y }, // top
          { x: crop.x + crop.width/2, y: crop.y + crop.height }, // bottom
          { x: crop.x, y: crop.y + crop.height/2 }, // left
          { x: crop.x + crop.width, y: crop.y + crop.height/2 }, // right
        ];
        
        edges.forEach(edge => {
          const rotated = rotatePoint(edge.x, edge.y);
          ctx.fillRect(rotated.x - handleSize/2, rotated.y - handleSize/2, handleSize, handleSize);
          ctx.strokeRect(rotated.x - handleSize/2, rotated.y - handleSize/2, handleSize, handleSize);
        });

        // Rotation handle (circle above the crop)
        const rotationHandleDistance = 30;
        const rotationHandle = rotatePoint(
          crop.x + crop.width/2, 
          crop.y - rotationHandleDistance
        );
        
        // Only draw rotation handle if it's within viewport
        const rotHandleInViewport = canvasRect &&
          rotationHandle.x > viewportConstraints.minX - canvasRect.left &&
          rotationHandle.x < viewportConstraints.maxX - canvasRect.left &&
          rotationHandle.y > viewportConstraints.minY - canvasRect.top &&
          rotationHandle.y < viewportConstraints.maxY - canvasRect.top;
        
        if (rotHandleInViewport) {
          // Draw line from crop to rotation handle
          ctx.strokeStyle = isGridCrop ? '#9333EA' : '#3B82F6';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          const topCenter = rotatePoint(crop.x + crop.width/2, crop.y);
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
      }

      // Draw label with background (always horizontal) with grid and viewport awareness
      if (crop.name) {
        ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        const textWidth = ctx.measureText(crop.name).width;
        const padding = 8;
        
        // Position label above the crop (accounting for rotation)
        const labelY = Math.min(crop.y, centerY - crop.height/2 * Math.abs(cos) - crop.width/2 * Math.abs(sin)) - 35;
        
        // Check if label would be in viewport
        const labelInViewport = canvasRect &&
          crop.x > viewportConstraints.minX - canvasRect.left &&
          crop.x + textWidth + padding * 2 < viewportConstraints.maxX - canvasRect.left &&
          labelY > viewportConstraints.minY - canvasRect.top;
        
        if (labelInViewport) {
          // Label background with appropriate color
          let labelColor = '#10B981'; // Green
          if (isSelected) {
            labelColor = '#3B82F6'; // Blue
          } else if (isGridCrop) {
            labelColor = '#9333EA'; // Purple
          } else if (!isInViewport) {
            labelColor = '#EF4444'; // Red
          }
          
          ctx.fillStyle = labelColor;
          ctx.fillRect(crop.x, labelY, textWidth + padding * 2, 24);
          
          // Label text
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(crop.name, crop.x + padding, labelY + 16);
        }
      }
    });

    // Draw new crop being created with viewport constraints
    if (isCreatingCrop) {
      const x = Math.min(newCropStart.x, newCropEnd.x);
      const y = Math.min(newCropStart.y, newCropEnd.y);
      const width = Math.abs(newCropEnd.x - newCropStart.x);
      const height = Math.abs(newCropEnd.y - newCropStart.y);

      if (width > 5 && height > 5) {
        // Check if new crop would be in viewport
        const canvas = canvasRef.current;
        const canvasRect = canvas?.getBoundingClientRect();
        const newCropInViewport = canvasRect &&
          x > viewportConstraints.minX - canvasRect.left &&
          x + width < viewportConstraints.maxX - canvasRect.left &&
          y > viewportConstraints.minY - canvasRect.top &&
          y + height < viewportConstraints.maxY - canvasRect.top;

        // Draw dashed rectangle for new crop
        ctx.strokeStyle = newCropInViewport ? '#F59E0B' : '#EF4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(x, y, width, height);

        // Draw semi-transparent overlay
        const overlayColor = newCropInViewport ? '245, 158, 11' : '239, 68, 68';
        ctx.fillStyle = `rgba(${overlayColor}, 0.1)`;
        ctx.fillRect(x, y, width, height);

        // Draw dimensions label
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x + 5, y + 5, 120, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        const statusText = newCropInViewport ? 
          `${Math.round(width)} × ${Math.round(height)}` : 
          `${Math.round(width)} × ${Math.round(height)} (Out of bounds)`;
        ctx.fillText(statusText, x + 10, y + 18);
      }
    }
  }, [originalImage, imageScale, imageOffset, cropAreas, selectedCropId, isCreatingCrop, newCropStart, newCropEnd, rotating, viewportConstraints]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      onCanvasResize({ width: rect.width, height: rect.height });
      updateViewportConstraints();
      draw();
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [draw, onCanvasResize, updateViewportConstraints]);

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
      
      // Transform point to crop's local coordinate system
      const centerX = crop.x + crop.width / 2;
      const centerY = crop.y + crop.height / 2;
      const cos = Math.cos((-rotation * Math.PI) / 180);
      const sin = Math.sin((-rotation * Math.PI) / 180);
      
      const dx = x - centerX;
      const dy = y - centerY;
      const localX = centerX + dx * cos - dy * sin;
      const localY = centerY + dx * sin + dy * cos;
      
      if (localX >= crop.x && localX <= crop.x + crop.width &&
          localY >= crop.y && localY <= crop.y + crop.height) {
        return crop;
      }
    }
    return null;
  };

  const getResizeHandle = (x: number, y: number, crop: CropArea) => {
    const handleSize = 10;
    const rotation = crop.rotation || 0;
    const centerX = crop.x + crop.width / 2;
    const centerY = crop.y + crop.height / 2;
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
      { name: 'tl', x: crop.x, y: crop.y },
      { name: 'tr', x: crop.x + crop.width, y: crop.y },
      { name: 'bl', x: crop.x, y: crop.y + crop.height },
      { name: 'br', x: crop.x + crop.width, y: crop.y + crop.height },
      { name: 't', x: crop.x + crop.width/2, y: crop.y },
      { name: 'b', x: crop.x + crop.width/2, y: crop.y + crop.height },
      { name: 'l', x: crop.x, y: crop.y + crop.height/2 },
      { name: 'r', x: crop.x + crop.width, y: crop.y + crop.height/2 },
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
    const centerX = crop.x + crop.width / 2;
    const centerY = crop.y + crop.height / 2;
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

  // Context menu handlers - THESE ACTUALLY WORK NOW!
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const pos = getMousePos(e);
    const cropAtPos = getCropAt(pos.x, pos.y);
    
    if (cropAtPos) {
      console.log('🎯 RIGHT-CLICK DETECTED on crop:', cropAtPos.id, cropAtPos.name);
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
    console.log('🔒 Closing context menu');
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, cropId: null });
  };

  // WORKING CONTEXT MENU ACTION HANDLERS
  const handleCropDuplicate = () => {
    console.log('🔥 DUPLICATE ACTION TRIGGERED!');
    if (!contextMenu.cropId) {
      console.log('❌ No crop ID in context menu');
      return;
    }
    
    const crop = cropAreas.find(c => c.id === contextMenu.cropId);
    if (!crop) {
      console.log('❌ Crop not found:', contextMenu.cropId);
      return;
    }
    
    console.log('✅ DUPLICATING CROP:', crop.name);
    onCropCopy(crop.id);
    closeContextMenu();
  };

  const handleAdvancedEdit = () => {
    console.log('🔥 ADVANCED EDIT ACTION TRIGGERED!');
    if (!contextMenu.cropId) {
      console.log('❌ No crop ID in context menu');
      return;
    }
    
    console.log('✅ OPENING ADVANCED EDIT for crop:', contextMenu.cropId);
    onCropDoubleClick(contextMenu.cropId);
    closeContextMenu();
  };

  const handleFitToImage = () => {
    console.log('🔥 FIT TO IMAGE ACTION TRIGGERED!');
    if (!contextMenu.cropId || !originalImage) {
      console.log('❌ No crop ID or original image');
      return;
    }
    
    const crop = cropAreas.find(c => c.id === contextMenu.cropId);
    if (!crop) {
      console.log('❌ Crop not found:', contextMenu.cropId);
      return;
    }
    
    console.log('✅ FITTING CROP TO IMAGE:', crop.name);
    const updates = {
      x: imageOffset.x,
      y: imageOffset.y,
      width: originalImage.width * imageScale,
      height: originalImage.height * imageScale,
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
        const centerX = selectedCrop.x + selectedCrop.width / 2;
        const centerY = selectedCrop.y + selectedCrop.height / 2;
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
    
    if (rotating) {
      const crop = cropAreas.find(c => c.id === rotating.cropId);
      if (!crop) return;

      const centerX = crop.x + crop.width / 2;
      const centerY = crop.y + crop.height / 2;
      
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

      let newCrop = { ...crop };
      const rotation = crop.rotation || 0;
      const centerX = crop.x + crop.width / 2;
      const centerY = crop.y + crop.height / 2;
      
      // Transform mouse position to crop's local coordinate system
      const cos = Math.cos((-rotation * Math.PI) / 180);
      const sin = Math.sin((-rotation * Math.PI) / 180);
      const dx = pos.x - centerX;
      const dy = pos.y - centerY;
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
      newCrop.width = Math.max(20, newCrop.width);
      newCrop.height = Math.max(20, newCrop.height);

      // Apply viewport constraints
      newCrop = adjustCropSizeForViewport(newCrop, newCrop.width, newCrop.height);
      newCrop = constrainCropToViewport(newCrop);

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
        
        let newCrop = {
          ...crop,
          x: crop.x + deltaX,
          y: crop.y + deltaY
        };

        // Apply viewport constraints
        newCrop = constrainCropToViewport(newCrop);
        
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
              onCropUpdate(gridCrop.id, constrainCropToViewport({ ...gridCrop, ...updatedGridCrop }));
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
        const maxZIndex = cropAreas.length > 0 ? Math.max(...cropAreas.map(c => c.zIndex || 0)) : 0;
        
        let newCrop: Omit<CropArea, 'id'> = {
          x,
          y,
          width,
          height,
          rotation: 0,
          name: `Crop ${cropAreas.length + 1}`,
          visible: true,
          zIndex: maxZIndex + 1
        };

        // Apply viewport constraints to new crop
        const constrainedCrop = constrainCropToViewport({ ...newCrop, id: 'temp' });
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
    
    // Auto-adjust to viewport after zoom
    setTimeout(() => adjustImageToViewport(), 100);
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
      
      {/* Context Menu - NOW WORKING! */}
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
              • Right-click crop for context menu
            </p>
          </div>
        </div>
      )}
    </div>
  );
};