import React, { useEffect, useRef } from 'react';
import { 
  Copy, 
  Trash2, 
  Edit3, 
  Settings, 
  RotateCw, 
  Move, 
  Maximize2, 
  Link, 
  Unlink,
  Eye,
  EyeOff,
  Square,
  Grid3X3,
  Download
} from 'lucide-react';
import { CropArea } from '../App';

interface CropContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  crop: CropArea | null;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onRename: () => void;
  onAdvancedEdit: () => void;
  onRotate90: () => void;
  onRotate180: () => void;
  onRotate270: () => void;
  onResetRotation: () => void;
  onDuplicate: () => void;
  onUnlinkFromGrid?: () => void;
  onToggleVisibility: () => void;
  onFitToImage: () => void;
  onExportCrop: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

export const CropContextMenu: React.FC<CropContextMenuProps> = ({
  isOpen,
  position,
  crop,
  onClose,
  onCopy,
  onDelete,
  onRename,
  onAdvancedEdit,
  onRotate90,
  onRotate180,
  onRotate270,
  onResetRotation,
  onDuplicate,
  onUnlinkFromGrid,
  onToggleVisibility,
  onFitToImage,
  onExportCrop,
  onBringToFront,
  onSendToBack
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

  const isGridCrop = !!crop.gridId;
  const isVisible = crop.visible !== false; // Default to visible if not set

  // Adjust menu position to stay within viewport
  const adjustedPosition = { ...position };
  const menuWidth = 220;
  const menuHeight = 400;
  
  if (position.x + menuWidth > window.innerWidth) {
    adjustedPosition.x = window.innerWidth - menuWidth - 10;
  }
  
  if (position.y + menuHeight > window.innerHeight) {
    adjustedPosition.y = window.innerHeight - menuHeight - 10;
  }

  const MenuItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    destructive?: boolean;
    shortcut?: string;
  }> = ({ icon, label, onClick, disabled = false, destructive = false, shortcut }) => (
    <button
      onClick={() => {
        if (!disabled) {
          onClick();
          onClose();
        }
      }}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
        disabled
          ? 'text-gray-500 cursor-not-allowed'
          : destructive
          ? 'text-red-400 hover:bg-red-600/20 hover:text-red-300'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
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
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl py-2 min-w-[220px]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Crop Info Header */}
      <div className="px-3 py-2 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Square className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-white truncate">{crop.name}</span>
          {isGridCrop && (
            <div className="flex items-center space-x-1">
              <Grid3X3 className="h-3 w-3 text-purple-400" />
              <span className="text-xs text-purple-400">Grid</span>
            </div>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {Math.round(crop.width)} × {Math.round(crop.height)}
          {crop.rotation && crop.rotation !== 0 && (
            <span className="ml-2 text-orange-400">
              ↻ {Math.round(crop.rotation)}°
            </span>
          )}
        </div>
      </div>

      {/* Basic Actions */}
      <div className="py-1">
        <MenuItem
          icon={<Copy className="h-4 w-4" />}
          label="Copy Style"
          onClick={onCopy}
          shortcut="Ctrl+C"
        />
        <MenuItem
          icon={<Copy className="h-4 w-4" />}
          label="Duplicate"
          onClick={onDuplicate}
          shortcut="Ctrl+D"
        />
        <MenuItem
          icon={<Edit3 className="h-4 w-4" />}
          label="Rename"
          onClick={onRename}
          shortcut="F2"
        />
      </div>

      <Separator />

      {/* Edit Actions */}
      <div className="py-1">
        <MenuItem
          icon={<Settings className="h-4 w-4" />}
          label="Advanced Edit"
          onClick={onAdvancedEdit}
          shortcut="Enter"
        />
        <MenuItem
          icon={<Maximize2 className="h-4 w-4" />}
          label="Fit to Image"
          onClick={onFitToImage}
        />
        <MenuItem
          icon={isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          label={isVisible ? "Hide Crop" : "Show Crop"}
          onClick={onToggleVisibility}
          shortcut="H"
        />
      </div>

      <Separator />

      {/* Rotation Actions */}
      <div className="py-1">
        <div className="px-3 py-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Rotation</span>
        </div>
        <MenuItem
          icon={<RotateCw className="h-4 w-4" />}
          label="Rotate 90°"
          onClick={onRotate90}
          shortcut="R"
        />
        <MenuItem
          icon={<RotateCw className="h-4 w-4" />}
          label="Rotate 180°"
          onClick={onRotate180}
          shortcut="Shift+R"
        />
        <MenuItem
          icon={<RotateCw className="h-4 w-4" />}
          label="Rotate 270°"
          onClick={onRotate270}
        />
        <MenuItem
          icon={<RotateCw className="h-4 w-4" />}
          label="Reset Rotation"
          onClick={onResetRotation}
          shortcut="Ctrl+R"
        />
      </div>

      <Separator />

      {/* Layer Actions */}
      <div className="py-1">
        <div className="px-3 py-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Layer</span>
        </div>
        <MenuItem
          icon={<Move className="h-4 w-4" />}
          label="Bring to Front"
          onClick={onBringToFront}
          shortcut="Ctrl+]"
        />
        <MenuItem
          icon={<Move className="h-4 w-4" />}
          label="Send to Back"
          onClick={onSendToBack}
          shortcut="Ctrl+["
        />
      </div>

      <Separator />

      {/* Grid Actions */}
      {isGridCrop && onUnlinkFromGrid && (
        <>
          <div className="py-1">
            <MenuItem
              icon={<Unlink className="h-4 w-4" />}
              label="Unlink from Grid"
              onClick={onUnlinkFromGrid}
              shortcut="Ctrl+U"
            />
          </div>
          <Separator />
        </>
      )}

      {/* Export Actions */}
      <div className="py-1">
        <MenuItem
          icon={<Download className="h-4 w-4" />}
          label="Export Crop"
          onClick={onExportCrop}
          shortcut="Ctrl+E"
        />
      </div>

      <Separator />

      {/* Destructive Actions */}
      <div className="py-1">
        <MenuItem
          icon={<Trash2 className="h-4 w-4" />}
          label="Delete"
          onClick={onDelete}
          destructive
          shortcut="Del"
        />
      </div>
    </div>
  );
};