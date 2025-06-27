import React from 'react';
import { Scissors, RotateCcw } from 'lucide-react';

interface HeaderProps {
  onReset: () => void;
  hasImage: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onReset, hasImage }) => {
  return (
    <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Scissors className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ImageCrop Pro</h1>
            <p className="text-sm text-gray-400">Professional Multi-Crop Editor</p>
          </div>
        </div>
        
        {hasImage && (
          <button
            onClick={onReset}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>New Image</span>
          </button>
        )}
      </div>
    </header>
  );
};