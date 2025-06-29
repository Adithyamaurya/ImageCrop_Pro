import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, FileImage, Github, Heart, Coffee } from 'lucide-react';

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
    <div className="w-full max-w-2xl mx-auto p-6 flex flex-col min-h-[calc(100vh-160px)] relative">
      {/* Bolt.new Logo - Top Right with improved positioning */}
      <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 md:-top-8 md:-right-8 lg:-top-10 lg:-right-10 z-20">
        <a
          href="https://bolt.new"
          target="_blank"
          rel="noopener noreferrer"
          className="block transition-all duration-300 hover:scale-105 hover:opacity-80 group"
          title="Powered by Bolt.new"
        >
          <div className="relative">
            <img
              src="/white_circle_360x360.png"
              alt="Powered by Bolt.new"
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 xl:w-32 xl:h-32 
                         transition-all duration-300 group-hover:drop-shadow-lg"
            />
            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 
                            transition-opacity duration-300 blur-sm"></div>
          </div>
        </a>
      </div>

      <div className="flex-1 mt-8 sm:mt-12 md:mt-16">
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

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t border-gray-700">
        <div className="text-center space-y-6">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
            {/* About */}
            <div className="space-y-3">
              <h5 className="font-semibold text-white">About ImageCrop Pro</h5>
              <p className="text-gray-400 leading-relaxed">
                A professional-grade image cropping tool designed for photographers, designers, and content creators who need precise control over their image editing workflow.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-3">
              <h5 className="font-semibold text-white">Key Features</h5>
              <ul className="text-gray-400 space-y-1">
                <li>• Multiple crop areas per image</li>
                <li>• Advanced rotation controls</li>
                <li>• Grid-based crop creation</li>
                <li>• Keyboard shortcuts support</li>
                <li>• High-quality export options</li>
                <li>• Responsive design</li>
              </ul>
            </div>

            {/* Technical */}
            <div className="space-y-3">
              <h5 className="font-semibold text-white">Technical Details</h5>
              <ul className="text-gray-400 space-y-1">
                <li>• Client-side processing</li>
                <li>• No data uploaded to servers</li>
                <li>• Modern web technologies</li>
                <li>• Cross-platform compatibility</li>
                <li>• Optimized performance</li>
                <li>• Privacy-focused design</li>
              </ul>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
              {/* Left side - Copyright */}
              <div className="flex items-center space-x-4 text-gray-400">
                <span>© 2025 ImageCrop Pro</span>
                <span className="hidden md:inline">•</span>
                <span className="flex items-center space-x-1">
                  <span>Made with</span>
                  <Heart className="h-4 w-4 text-red-500 fill-current" />
                  <span>for creators</span>
                </span>
              </div>

              {/* Right side - Links */}
              <div className="flex items-center space-x-6 text-gray-400">
                <a 
                  href="https://github.com/Adithyamaurya/ImageCrop_Pro" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-white transition-colors"
                  title="View source code on GitHub"
                >
                  <Github className="h-4 w-4" />
                  <span>Open Source</span>
                </a>
                <a 
                  href="#" 
                  className="flex items-center space-x-2 hover:text-white transition-colors"
                  title="Support development"
                >
                  <Coffee className="h-4 w-4" />
                  <span>Support</span>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom note */}
          <div className="text-xs text-gray-500 bg-gray-800/50 rounded-lg p-4">
            <p>
              <strong>Privacy Notice:</strong> All image processing happens locally in your browser. 
              No images are uploaded to our servers, ensuring your data remains completely private and secure.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};