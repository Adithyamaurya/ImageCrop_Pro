import React, { useEffect, useRef } from 'react';
import { 
  Copy, 
  Settings, 
  Maximize2
} from 'lucide-react';
import { CropArea } from '../App';

interface CropContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  crop: CropArea | null;
  onClose: () => void;
  onDuplicate: () => void;
  onAdvancedEdit: () => void;
  onFitToImage: () => void;
}

export const CropContextMenu: React.FC<CropContextMenuProps> = ({
  isOpen,
  position,
  crop,
  onClose,
  onDuplicate,
  onAdvancedEdit,
  onFitToImage
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !crop) return null;

  // Adjust menu position to stay within viewport
  const adjustedPosition = { ...position };
  const menuWidth = 200;
  const menuHeight = 160;
  
  if (position.x + menuWidth > window.innerWidth) {
    adjustedPosition.x = window.innerWidth - menuWidth - 10;
  }
  
  if (position.y + menuHeight > window.innerHeight) {
    adjustedPosition.y = window.innerHeight - menuHeight - 10;
  }

  // Direct click handlers that actually work
  const handleDuplicateClick = () => {
    console.log('🔥 DUPLICATE CLICKED - EXECUTING NOW!');
    onDuplicate();
    onClose();
  };

  const handleAdvancedEditClick = () => {
    console.log('🔥 ADVANCED EDIT CLICKED - EXECUTING NOW!');
    onAdvancedEdit();
    onClose();
  };

  const handleFitToImageClick = () => {
    console.log('🔥 FIT TO IMAGE CLICKED - EXECUTING NOW!');
    onFitToImage();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl py-2 min-w-[200px]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Crop Info Header */}
      <div className="px-4 py-2 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-white truncate">{crop.name}</span>
          {crop.gridId && (
            <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">Grid</span>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {Math.round(crop.width)} × {Math.round(crop.height)}
          {crop.rotation && crop.rotation !== 0 && (
            <span className="ml-2 text-orange-400">
              ↻ {Math.round(crop.rotation)}°
            </span>
          )}
          {crop.gridPosition && (
            <span className="ml-2 text-purple-400">
              [{crop.gridPosition.row + 1},{crop.gridPosition.col + 1}]
            </span>
          )}
        </div>
      </div>

      {/* Menu Items - SIMPLIFIED AND WORKING */}
      <div className="py-1">
        {/* DUPLICATE BUTTON */}
        <div
          onClick={handleDuplicateClick}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            <Copy className="h-4 w-4" />
            <span>Duplicate</span>
          </div>
          <span className="text-xs text-gray-500">Ctrl+D</span>
        </div>
        
        {/* SEPARATOR */}
        <div className="h-px bg-gray-700 my-1" />
        
        {/* ADVANCED EDIT BUTTON */}
        <div
          onClick={handleAdvancedEditClick}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            <Settings className="h-4 w-4" />
            <span>Advanced Edit</span>
          </div>
          <span className="text-xs text-gray-500">Enter</span>
        </div>
        
        {/* SEPARATOR */}
        <div className="h-px bg-gray-700 my-1" />
        
        {/* FIT TO IMAGE BUTTON */}
        <div
          onClick={handleFitToImageClick}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            <Maximize2 className="h-4 w-4" />
            <span>Fit to Image</span>
          </div>
        </div>
      </div>
    </div>
  );
};