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

  const handleDuplicate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Duplicate clicked for crop:', crop.id);
    onDuplicate();
  };

  const handleAdvancedEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Advanced Edit clicked for crop:', crop.id);
    onAdvancedEdit();
  };

  const handleFitToImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Fit to Image clicked for crop:', crop.id);
    onFitToImage();
  };

  const MenuItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: (e: React.MouseEvent) => void;
    shortcut?: string;
  }> = ({ icon, label, onClick, shortcut }) => (
    <button
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors focus:outline-none focus:bg-gray-700"
    >
      <div className="flex items-center space-x-3">
        <span className="flex-shrink-0">{icon}</span>
        <span>{label}</span>
      </div>
      {shortcut && (
        <span className="text-xs text-gray-500">{shortcut}</span>
      )}
    </button>
  );

  const Separator = () => (
    <div className="h-px bg-gray-700 my-1" />
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl py-2 min-w-[200px]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      onMouseDown={(e) => e.stopPropagation()}
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

      {/* Menu Items */}
      <div className="py-1">
        <MenuItem
          icon={<Copy className="h-4 w-4" />}
          label="Duplicate"
          onClick={handleDuplicate}
          shortcut="Ctrl+D"
        />
        
        <Separator />
        
        <MenuItem
          icon={<Settings className="h-4 w-4" />}
          label="Advanced Edit"
          onClick={handleAdvancedEdit}
          shortcut="Enter"
        />
        
        <Separator />
        
        <MenuItem
          icon={<Maximize2 className="h-4 w-4" />}
          label="Fit to Image"
          onClick={handleFitToImage}
        />
      </div>
    </div>
  );
};