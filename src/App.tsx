import React, { useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { CropEditor } from './components/CropEditor';
import { Header } from './components/Header';

export interface CropArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio?: number;
  name: string;
  rotation?: number;
  gridId?: string; // New property to identify grid membership
  gridPosition?: { row: number; col: number }; // Position within grid
}

function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);

  const handleImageSelect = (imageUrl: string, image: HTMLImageElement) => {
    setSelectedImage(imageUrl);
    setOriginalImage(image);
  };

  const handleReset = () => {
    setSelectedImage(null);
    setOriginalImage(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header onReset={handleReset} hasImage={!!selectedImage} />
      
      <main className="flex-1">
        {!selectedImage ? (
          <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
            <ImageUploader onImageSelect={handleImageSelect} />
          </div>
        ) : (
          <CropEditor 
            imageUrl={selectedImage} 
            originalImage={originalImage}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}

export default App;