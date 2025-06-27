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
  const [rotating, setRotating] = useState<string | null>(null);
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
      const rotation = crop.rotation || 0;
      
      // Save context for rotation
      ctx.save();
      
      // Move to crop center for rotation
      const centerX = crop.x + crop.width / 2;
      const centerY = crop.y + crop.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
      
      // Draw crop rectangle
      ctx.strokeStyle = isSelected ? '#3B82F6' : '#10B981';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [] : [5, 5]);
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

      // Draw overlay
      ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.05)';
      ctx.fillRect(crop.x, crop.y, crop.width, crop.height);

      // Restore context
      ctx.restore();

      // Draw resize handles and rotation handle for selected crop
      if (isSelected) {
        const handleSize = 10;
        ctx.fillStyle = '#3B82F6';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        
        // Calculate rotated handle positions
        const cos = Math.cos((rotation * Math.PI) / 180);
        const sin = Math.sin((rotation * Math.PI) / 180);
        
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
        ctx.fillStyle = '#F59E0B';
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

      // Draw label with background (always horizontal)
      if (crop.name) {
        ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        const textWidth = ctx.measureText(crop.name).width;
        const padding = 8;
        
        // Position label above the crop (accounting for rotation)
        const labelY = Math.min(crop.y, centerY - crop.height/2 * Math.abs(cos) - crop.width/2 * Math.abs(sin)) - 35;
        
        // Label background
        ctx.fillStyle = isSelected ? '#3B82F6' : '#10B981';
        ctx.fillRect(crop.x, labelY, textWidth + padding * 2, 24);
        
        // Label text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(crop.name, crop.x + padding, labelY + 16);
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    const selectedCrop = cropAreas.find(crop => crop.id === selectedCropId);
    
    // Check for rotation handle first
    if (selectedCrop) {
      const rotationHandle = getRotationHandle(pos.x, pos.y, selectedCrop);
      if (rotationHandle) {
        setRotating(selectedCrop.id);
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
    
    if (rotating) {
      const crop = cropAreas.find(c => c.id === rotating);
      if (!crop) return;

      const centerX = crop.x + crop.width / 2;
      const centerY = crop.y + crop.height / 2;
      
      // Calculate angle from center to mouse position
      const angle = Math.atan2(pos.y - centerY, pos.x - centerX);
      const degrees = (angle * 180) / Math.PI + 90; // Add 90 to make 0 degrees point up
      
      // Snap to 15-degree increments when holding Shift
      let finalAngle = degrees;
      if (e.shiftKey) {
        finalAngle = Math.round(degrees / 15) * 15;
      }
      
      // Normalize angle to 0-360 range
      finalAngle = ((finalAngle % 360) + 360) % 360;
      
      onCropUpdate(crop.id, { rotation: finalAngle });
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
      if (selectedCrop) {
        if (getRotationHandle(pos.x, pos.y, selectedCrop)) {
          canvas.style.cursor = 'grab';
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
        const newCrop: Omit<CropArea, 'id'> = {
          x,
          y,
          width,
          height,
          rotation: 0,
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
              • Use rotation handle to rotate<br/>
              • Scroll to zoom<br/>
              • Drag empty space to pan
            </p>
          </div>
        </div>
      )}

      {/* Instructions overlay */}
      <div className="absolute top-4 right-4 bg-gray-800/90 rounded-lg p-3 text-xs text-gray-300 max-w-52">
        <div className="space-y-1">
          <div>🖱️ <strong>Drag on image:</strong> Create crop</div>
          <div>✋ <strong>Drag crop:</strong> Move crop</div>
          <div>🔄 <strong>Orange handle:</strong> Rotate crop</div>
          <div>📐 <strong>Blue handles:</strong> Resize crop</div>
          <div>🔄 <strong>Scroll:</strong> Zoom in/out</div>
          <div>✋ <strong>Drag empty:</strong> Pan image</div>
        </div>
      </div>
    </div>
  );
};