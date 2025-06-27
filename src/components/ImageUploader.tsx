import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, FileImage } from 'lucide-react';

interface ImageUploaderProps {
  onImageSelect: (imageUrl: string, image: HTMLImageElement) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        onImageSelect(e.target?.result as string, img);
        setIsLoading(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">Upload Your Image</h2>
        <p className="text-gray-400 text-lg">
          Select an image to start creating multiple crops with precise control
        </p>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
          isDragging
            ? 'border-blue-400 bg-blue-400/10 scale-105'
            : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'
        } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center space-y-4">
          {isLoading ? (
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          ) : (
            <div className="bg-gray-700 p-4 rounded-full">
              <Upload className="h-12 w-12 text-blue-400" />
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">
              {isLoading ? 'Processing...' : 'Drop your image here'}
            </h3>
            <p className="text-gray-400">
              {isLoading ? 'Please wait while we load your image' : 'or click to browse files'}
            </p>
          </div>

          <div className="flex items-center space-x-6 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <ImageIcon className="h-4 w-4" />
              <span>JPG, PNG, WebP</span>
            </div>
            <div className="flex items-center space-x-2">
              <FileImage className="h-4 w-4" />
              <span>Up to 10MB</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="font-semibold text-white mb-2">Multiple Crops</h4>
          <p className="text-sm text-gray-400">Create unlimited crop areas on a single image</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="font-semibold text-white mb-2">Aspect Ratios</h4>
          <p className="text-sm text-gray-400">Choose from presets or set custom dimensions</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="font-semibold text-white mb-2">High Quality</h4>
          <p className="text-sm text-gray-400">Export in multiple formats with quality control</p>
        </div>
      </div>
    </div>
  );
};