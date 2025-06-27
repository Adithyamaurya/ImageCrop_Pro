import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CropArea } from '../App';

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
}

interface ViewportConstraints {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  viewportWidth: number;
  viewportHeight: number;
}

interface Position {
  x: number;
  y: number;
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
  onCropDoubleClick
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

  // Position selector marker state
  const [positionMarker, setPositionMarker] = useState<Position | null>(null);
  const [markerAnimation, setMarkerAnimation] = useState(false);

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

    // Draw position marker if active
    if (positionMarker) {
      const markerSize = 20;
      const pulseSize = markerAnimation ? 30 : 20;
      
      // Draw pulsing outer circle
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.globalAlpha = markerAnimation ? 0.3 : 0.6;
      ctx.beginPath();
      ctx.arc(positionMarker.x, positionMarker.y, pulseSize, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Draw inner filled circle
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.arc(positionMarker.x, positionMarker.y, markerSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw crosshair
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      const crossSize = 8;
      ctx.beginPath();
      ctx.moveTo(positionMarker.x - crossSize, positionMarker.y);
      ctx.lineTo(positionMarker.x + crossSize, positionMarker.y);
      ctx.moveTo(positionMarker.x, positionMarker.y - crossSize);
      ctx.lineTo(positionMarker.x, positionMarker.y + crossSize);
      ctx.stroke();
      
      // Draw coordinates label
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(positionMarker.x + 15, positionMarker.y - 25, 80, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`${Math.round(positionMarker.x)}, ${Math.round(positionMarker.y)}`, positionMarker.x + 20, positionMarker.y - 10);
    }

    // Draw crop areas with viewport awareness
    cropAreas.forEach(crop => {
      const isSelected = crop.id === selectedCropId;
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
      
      // Draw crop rectangle with viewport awareness
      ctx.strokeStyle = isSelected ? '#3B82F6' : (isInViewport ? '#10B981' : '#EF4444');
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [] : (isInViewport ? [5, 5] : [10, 5]));
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

      // Draw overlay with different opacity based on viewport status
      const overlayOpacity = isInViewport ? (isSelected ? 0.1 : 0.05) : 0.15;
      const overlayColor = isInViewport ? '59, 130, 246' : '239, 68, 68';
      ctx.fillStyle = `rgba(${overlayColor}, ${overlayOpacity})`;
      ctx.fillRect(crop.x, crop.y, crop.width, crop.height);

      // Restore context
      ctx.restore();

      // Draw resize handles and rotation handle for selected crop (only if in viewport)
      if (isSelected && isInViewport) {
        const handleSize = 10;
        ctx.fillStyle = '#3B82F6';
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
          ctx.strokeStyle = '#3B82F6';
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

      // Draw label with background (always horizontal) with viewport awareness
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
          // Label background
          ctx.fillStyle = isSelected ? '#3B82F6' : (isInViewport ? '#10B981' : '#EF4444');
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

    // Reset global alpha
    ctx.globalAlpha = 1;
  }, [originalImage, imageScale, imageOffset, cropAreas, selectedCropId, isCreatingCrop, newCropStart, newCropEnd, rotating, viewportConstraints, positionMarker, markerAnimation]);

  // Position marker animation effect
  useEffect(() => {
    if (positionMarker) {
      const interval = setInterval(() => {
        setMarkerAnimation(prev => !prev);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [positionMarker]);

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
    for (let i = cropAreas.length - 1; i >= 0; i--) {
      const crop = cropAreas[i];
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    
    // Check if position selector is active
    const positionSelectorState = (window as any).positionSelectorState;
    if (positionSelectorState?.isActive) {
      // Set position marker and notify position selector
      setPositionMarker(pos);
      positionSelectorState.onPositionSelect(pos);
      return;
    }
    
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
      
      onCropUpdate(crop.id, { rotation: newRotation });
      
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

      onCropUpdate(crop.id, newCrop);
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
      const positionSelectorState = (window as any).positionSelectorState;
      if (positionSelectorState?.isActive) {
        canvas.style.cursor = 'crosshair';
      } else {
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
        let newCrop: Omit<CropArea, 'id'> = {
          x,
          y,
          width,
          height,
          rotation: 0,
          name: `Crop ${cropAreas.length + 1}`
        };

        // Apply viewport constraints to new crop
        const constrainedCrop = constrainCropToViewport({ ...newCrop, id: 'temp' });
        newCrop = {
          x: constrainedCrop.x,
          y: constrainedCrop.y,
          width: constrainedCrop.width,
          height: constrainedCrop.height,
          rotation: constrainedCrop.rotation,
          name: constrainedCrop.name
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
      const positionSelectorState = (window as any).positionSelectorState;
      canvas.style.cursor = positionSelectorState?.isActive ? 'crosshair' : 'grab';
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
      
      {/* Position Selector Instructions */}
      {(window as any).positionSelectorState?.isActive && (
        <div className="absolute top-4 left-4 bg-blue-600/90 rounded-lg p-3 text-sm text-white max-w-64">
          <div className="font-semibold mb-1">Position Selector Active</div>
          <div className="text-xs">Click anywhere on the canvas to set a starting position for crop placement</div>
        </div>
      )}

      {/* Viewport Status Indicator */}
      <div className="absolute top-4 right-4 bg-gray-800/90 rounded-lg p-3 text-xs text-gray-300 max-w-64">
        <div className="space-y-1">
          <div className="font-semibold text-white">Viewport-Aware Cropping</div>
          <div>🔒 <strong>Auto-constrained:</strong> Crops stay in viewport</div>
          <div>📏 <strong>Smart resize:</strong> Prevents overflow</div>
          <div>🎯 <strong>Visual feedback:</strong> Red = out of bounds</div>
          <div>⚡ <strong>Auto-adjust:</strong> On window resize</div>
          <div className="text-xs text-gray-400 mt-2">
            Viewport: {viewportConstraints.viewportWidth} × {viewportConstraints.viewportHeight}
          </div>
        </div>
      </div>

      {cropAreas.length === 0 && !isCreatingCrop && !(window as any).positionSelectorState?.isActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-800/90 rounded-lg p-8 text-center max-w-md">
            <h3 className="text-xl font-semibold text-white mb-3">Viewport-Aware Cropping!</h3>
            <p className="text-gray-300 mb-2">Create crops that automatically stay within screen boundaries</p>
            <p className="text-sm text-gray-400">
              • Crops auto-constrain to viewport<br/>
              • Smart resizing prevents overflow<br/>
              • Visual indicators for boundaries<br/>
              • Auto-adjusts on window resize<br/>
              • Red highlights show out-of-bounds areas<br/>
              • Use Position Selector for precise placement
            </p>
          </div>
        </div>
      )}
    </div>
  );
};