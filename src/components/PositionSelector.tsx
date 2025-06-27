import React, { useState } from 'react';
import { Target, X, Check, RotateCcw } from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface PositionSelectorProps {
  isActive: boolean;
  onToggle: () => void;
  selectedPosition: Position | null;
  onPositionSelect: (position: Position | null) => void;
  onPositionUpdate: (position: Position) => void;
}

export const PositionSelector: React.FC<PositionSelectorProps> = ({
  isActive,
  onToggle,
  selectedPosition,
  onPositionSelect,
  onPositionUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempX, setTempX] = useState(selectedPosition?.x || 0);
  const [tempY, setTempY] = useState(selectedPosition?.y || 0);

  const handleStartEdit = () => {
    if (selectedPosition) {
      setTempX(selectedPosition.x);
      setTempY(selectedPosition.y);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    const newPosition = { x: tempX, y: tempY };
    onPositionUpdate(newPosition);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    if (selectedPosition) {
      setTempX(selectedPosition.x);
      setTempY(selectedPosition.y);
    }
    setIsEditing(false);
  };

  const handleClear = () => {
    onPositionSelect(null);
    setIsEditing(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center">
          <Target className="h-4 w-4 mr-2" />
          Position Selector
        </h3>
        <button
          onClick={onToggle}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {isActive ? 'Active' : 'Inactive'}
        </button>
      </div>

      {isActive && (
        <div className="text-xs text-blue-400 bg-blue-400/10 rounded p-2 mb-3">
          <strong>Selection Mode:</strong> Click anywhere on the canvas to set a starting position
        </div>
      )}

      {selectedPosition && (
        <div className="space-y-3">
          <div className="text-xs text-gray-400">Selected Position:</div>
          
          {isEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">X Position</label>
                  <input
                    type="number"
                    value={tempX}
                    onChange={(e) => setTempX(parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Y Position</label>
                  <input
                    type="number"
                    value={tempY}
                    onChange={(e) => setTempY(parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 flex items-center justify-center space-x-1 bg-green-600 hover:bg-green-700 text-white rounded py-1 px-2 text-xs transition-colors"
                >
                  <Check className="h-3 w-3" />
                  <span>Save</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 flex items-center justify-center space-x-1 bg-gray-600 hover:bg-gray-500 text-white rounded py-1 px-2 text-xs transition-colors"
                >
                  <X className="h-3 w-3" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="bg-gray-700 rounded p-2">
                <div className="text-sm text-white font-medium">
                  X: {Math.round(selectedPosition.x)}, Y: {Math.round(selectedPosition.y)}
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleStartEdit}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded py-1 px-2 text-xs transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleClear}
                  className="flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded py-1 px-2 text-xs transition-colors"
                  title="Clear position"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!selectedPosition && !isActive && (
        <div className="text-xs text-gray-500 text-center py-2">
          Activate to select a starting position
        </div>
      )}
    </div>
  );
};