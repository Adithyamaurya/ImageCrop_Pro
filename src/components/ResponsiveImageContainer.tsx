import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ResponsiveImageContainerProps {
  src: string;
  alt?: string;
  className?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
  objectPosition?: string;
  fallbackSrc?: string;
  onLoad?: () => void;
  onError?: () => void;
  showLoadingState?: boolean;
  enableZoom?: boolean;
  maxZoom?: number;
  minZoom?: number;
}

export const ResponsiveImageContainer: React.FC<ResponsiveImageContainerProps> = ({
  src,
  alt = '',
  className = '',
  objectFit = 'cover',
  objectPosition = 'center',
  fallbackSrc,
  onLoad,
  onError,
  showLoadingState = true,
  enableZoom = false,
  maxZoom = 3,
  minZoom = 0.5
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });

  // Calculate optimal scale and position for the image
  const calculateOptimalTransform = useCallback(() => {
    if (!imageDimensions.width || !imageDimensions.height || !containerDimensions.width || !containerDimensions.height) {
      return { scale: 1, x: 0, y: 0 };
    }

    const containerAspect = containerDimensions.width / containerDimensions.height;
    const imageAspect = imageDimensions.width / imageDimensions.height;

    let optimalScale = 1;
    let optimalX = 0;
    let optimalY = 0;

    if (objectFit === 'cover') {
      // Scale to cover the entire container
      optimalScale = Math.max(
        containerDimensions.width / imageDimensions.width,
        containerDimensions.height / imageDimensions.height
      );
    } else if (objectFit === 'contain') {
      // Scale to fit entirely within container
      optimalScale = Math.min(
        containerDimensions.width / imageDimensions.width,
        containerDimensions.height / imageDimensions.height
      );
    } else if (objectFit === 'fill') {
      // Stretch to fill container exactly (may distort)
      optimalScale = 1; // Will be handled by CSS transform
    }

    // Calculate centered position
    const scaledWidth = imageDimensions.width * optimalScale;
    const scaledHeight = imageDimensions.height * optimalScale;
    
    optimalX = (containerDimensions.width - scaledWidth) / 2;
    optimalY = (containerDimensions.height - scaledHeight) / 2;

    // Apply object-position offset
    if (objectPosition !== 'center') {
      const [xPos, yPos] = objectPosition.split(' ');
      
      if (xPos === 'left') optimalX = 0;
      else if (xPos === 'right') optimalX = containerDimensions.width - scaledWidth;
      else if (xPos.includes('%')) {
        const percentage = parseFloat(xPos) / 100;
        optimalX = (containerDimensions.width - scaledWidth) * percentage;
      }
      
      if (yPos === 'top') optimalY = 0;
      else if (yPos === 'bottom') optimalY = containerDimensions.height - scaledHeight;
      else if (yPos && yPos.includes('%')) {
        const percentage = parseFloat(yPos) / 100;
        optimalY = (containerDimensions.height - scaledHeight) * percentage;
      }
    }

    return { scale: optimalScale, x: optimalX, y: optimalY };
  }, [imageDimensions, containerDimensions, objectFit, objectPosition]);

  // Update container dimensions on resize
  const updateContainerDimensions = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerDimensions({ width: rect.width, height: rect.height });
    }
  }, []);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
      setIsLoading(false);
      onLoad?.();
    }
  }, [onLoad]);

  // Handle image error
  const handleImageError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
    onError?.();
  }, [onError]);

  // Apply optimal transform when dimensions change
  useEffect(() => {
    if (!enableZoom) {
      const optimal = calculateOptimalTransform();
      setScale(optimal.scale);
      setPosition({ x: optimal.x, y: optimal.y });
    }
  }, [calculateOptimalTransform, enableZoom]);

  // Set up resize observer
  useEffect(() => {
    updateContainerDimensions();
    
    const resizeObserver = new ResizeObserver(updateContainerDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [updateContainerDimensions]);

  // Zoom functionality
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!enableZoom) return;
    
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(minZoom, Math.min(maxZoom, scale * delta));
    
    // Zoom towards mouse position
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const newX = mouseX - (mouseX - position.x) * (newScale / scale);
      const newY = mouseY - (mouseY - position.y) * (newScale / scale);
      
      setScale(newScale);
      setPosition({ x: newX, y: newY });
    }
  }, [enableZoom, scale, position, minZoom, maxZoom]);

  // Drag functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enableZoom) return;
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setLastPosition(position);
  }, [enableZoom, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !enableZoom) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPosition({
      x: lastPosition.x + deltaX,
      y: lastPosition.y + deltaY
    });
  }, [isDragging, enableZoom, dragStart, lastPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Reset to optimal view
  const resetView = useCallback(() => {
    const optimal = calculateOptimalTransform();
    setScale(optimal.scale);
    setPosition({ x: optimal.x, y: optimal.y });
  }, [calculateOptimalTransform]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-gray-100 ${className}`}
      style={{ width: '100%', height: '100%' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Loading State */}
      {isLoading && showLoadingState && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 animate-pulse">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2">📷</div>
            <div className="text-sm">Failed to load image</div>
            {fallbackSrc && (
              <button
                onClick={() => {
                  setHasError(false);
                  setIsLoading(true);
                }}
                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Image */}
      <img
        ref={imageRef}
        src={hasError && fallbackSrc ? fallbackSrc : src}
        alt={alt}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className="absolute top-0 left-0 select-none"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          width: objectFit === 'fill' ? '100%' : 'auto',
          height: objectFit === 'fill' ? '100%' : 'auto',
          maxWidth: objectFit === 'fill' ? '100%' : 'none',
          maxHeight: objectFit === 'fill' ? '100%' : 'none',
          cursor: enableZoom ? (isDragging ? 'grabbing' : 'grab') : 'default',
          imageRendering: scale > 2 ? 'pixelated' : 'auto'
        }}
        draggable={false}
      />

      {/* Zoom Controls */}
      {enableZoom && !isLoading && !hasError && (
        <div className="absolute bottom-4 right-4 flex flex-col space-y-2 bg-black/50 rounded-lg p-2">
          <button
            onClick={() => setScale(Math.min(maxZoom, scale * 1.2))}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded text-white text-sm font-bold transition-colors"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => setScale(Math.max(minZoom, scale * 0.8))}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded text-white text-sm font-bold transition-colors"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={resetView}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded text-white text-xs font-bold transition-colors"
            title="Reset View"
          >
            ⌂
          </button>
        </div>
      )}

      {/* Scale Indicator */}
      {enableZoom && !isLoading && !hasError && scale !== 1 && (
        <div className="absolute top-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded">
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* Responsive Overlay Grid (for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="w-full h-full grid grid-cols-3 grid-rows-3 border border-red-500">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="border border-red-300"></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};