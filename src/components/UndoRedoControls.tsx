import React from 'react';
import { Undo, Redo, RotateCcw } from 'lucide-react';

interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearHistory: () => void;
}

export const UndoRedoControls: React.FC<UndoRedoControlsProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearHistory
}) => {
  return (
    <div className="p-4 border-b border-gray-700 bg-gray-800">
      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
        <RotateCcw className="h-4 w-4 mr-2" />
        History Controls
      </h3>
      
      <div className="flex space-x-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            canUndo
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title="Undo last action (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
          <span>Undo</span>
        </button>
        
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            canRedo
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title="Redo last action (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
          <span>Redo</span>
        </button>
      </div>
      
      <button
        onClick={onClearHistory}
        className="w-full mt-2 flex items-center justify-center space-x-2 py-1 px-3 rounded text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-700 transition-colors"
        title="Clear undo/redo history"
      >
        <RotateCcw className="h-3 w-3" />
        <span>Clear History</span>
      </button>
      
      <div className="mt-2 text-xs text-gray-500 text-center">
        Use Ctrl+Z / Ctrl+Y for keyboard shortcuts
      </div>
    </div>
  );
};