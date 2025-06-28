import React, { useEffect } from 'react';
import { Scissors, RotateCcw } from 'lucide-react';

interface HeaderProps {
  onReset: () => void;
  hasImage: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  onReset, 
  hasImage, 
  onUndo, 
  onRedo, 
  canUndo = false, 
  canRedo = false 
}) => {
  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey && canRedo && onRedo) {
              onRedo();
            } else if (canUndo && onUndo) {
              onUndo();
            }
            break;
          case 'y':
            e.preventDefault();
            if (canRedo && onRedo) {
              onRedo();
            }
            break;
        }
      }
    };

    if (hasImage) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [hasImage, onUndo, onRedo, canUndo, canRedo]);

  return (
    <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Scissors className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ImageCrop Pro</h1>
            <p className="text-sm text-gray-400">Professional Multi-Crop Editor with Undo/Redo</p>
          </div>
        </div>
        
        {hasImage && (
          <div className="flex items-center space-x-3">
            {/* Global Undo/Redo Buttons */}
            <div className="flex items-center space-x-2 bg-gray-700 rounded-lg p-1">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`p-2 rounded transition-colors ${
                  canUndo
                    ? 'text-blue-400 hover:text-blue-300 hover:bg-gray-600'
                    : 'text-gray-500 cursor-not-allowed'
                }`}
                title="Undo (Ctrl+Z)"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`p-2 rounded transition-colors ${
                  canRedo
                    ? 'text-green-400 hover:text-green-300 hover:bg-gray-600'
                    : 'text-gray-500 cursor-not-allowed'
                }`}
                title="Redo (Ctrl+Y)"
              >
                <RotateCcw className="h-4 w-4 scale-x-[-1]" />
              </button>
            </div>
            
            <button
              onClick={onReset}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>New Image</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};