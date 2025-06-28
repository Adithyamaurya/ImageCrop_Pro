export interface ContentRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  type: 'face' | 'object' | 'text' | 'edge' | 'composition';
  description: string;
}

export interface CropSuggestion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  reason: string;
  aspectRatio?: number;
  regions: ContentRegion[];
}

export class ContentAnalyzer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  async analyzeImage(image: HTMLImageElement): Promise<CropSuggestion[]> {
    // Set up canvas for analysis
    this.canvas.width = Math.min(800, image.width); // Limit size for performance
    this.canvas.height = Math.min(800, image.height);
    
    const scaleX = this.canvas.width / image.width;
    const scaleY = this.canvas.height / image.height;
    
    this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);
    
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Run multiple analysis techniques
    const [
      faceRegions,
      edgeRegions,
      compositionRegions,
      textRegions,
      colorRegions
    ] = await Promise.all([
      this.detectFaces(imageData),
      this.detectEdges(imageData),
      this.analyzeComposition(imageData),
      this.detectTextRegions(imageData),
      this.analyzeColorRegions(imageData)
    ]);

    const allRegions = [
      ...faceRegions,
      ...edgeRegions,
      ...compositionRegions,
      ...textRegions,
      ...colorRegions
    ];

    // Generate crop suggestions based on detected regions
    const suggestions = this.generateCropSuggestions(allRegions, this.canvas.width, this.canvas.height);
    
    // Scale suggestions back to original image size
    return suggestions.map(suggestion => ({
      ...suggestion,
      x: suggestion.x / scaleX,
      y: suggestion.y / scaleY,
      width: suggestion.width / scaleX,
      height: suggestion.height / scaleY,
      regions: suggestion.regions.map(region => ({
        ...region,
        x: region.x / scaleX,
        y: region.y / scaleY,
        width: region.width / scaleX,
        height: region.height / scaleY
      }))
    }));
  }

  private async detectFaces(imageData: ImageData): Promise<ContentRegion[]> {
    // Simple face detection using skin tone and facial feature patterns
    const regions: ContentRegion[] = [];
    const { data, width, height } = imageData;
    
    // Skin tone detection (simplified)
    const skinRegions = this.detectSkinTones(data, width, height);
    
    // Look for face-like patterns in skin regions
    for (const skinRegion of skinRegions) {
      if (skinRegion.width > 30 && skinRegion.height > 30) {
        const faceConfidence = this.analyzeFaceFeatures(data, width, skinRegion);
        
        if (faceConfidence > 0.3) {
          regions.push({
            ...skinRegion,
            confidence: faceConfidence,
            type: 'face',
            description: `Potential face (${Math.round(faceConfidence * 100)}% confidence)`
          });
        }
      }
    }
    
    return regions;
  }

  private detectSkinTones(data: Uint8ClampedArray, width: number, height: number): ContentRegion[] {
    const regions: ContentRegion[] = [];
    const visited = new Set<number>();
    
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        const index = (y * width + x) * 4;
        
        if (visited.has(index)) continue;
        
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        if (this.isSkinTone(r, g, b)) {
          const region = this.floodFillRegion(data, width, height, x, y, visited, this.isSkinTone);
          if (region && region.width > 20 && region.height > 20) {
            regions.push(region);
          }
        }
      }
    }
    
    return regions;
  }

  private isSkinTone(r: number, g: number, b: number): boolean {
    // Simplified skin tone detection
    const rg = r - g;
    const rb = r - b;
    const gb = g - b;
    
    return (
      r > 95 && g > 40 && b > 20 &&
      r > g && r > b &&
      rg > 15 && rb > 15 &&
      Math.abs(rg - rb) <= 20
    );
  }

  private analyzeFaceFeatures(data: Uint8ClampedArray, width: number, region: ContentRegion): number {
    // Simple face feature analysis
    let confidence = 0;
    
    // Check for eye-like dark regions in upper third
    const eyeRegionY = region.y + region.height * 0.2;
    const eyeRegionHeight = region.height * 0.3;
    
    let darkSpots = 0;
    for (let y = eyeRegionY; y < eyeRegionY + eyeRegionHeight; y += 2) {
      for (let x = region.x; x < region.x + region.width; x += 2) {
        const index = (Math.floor(y) * width + Math.floor(x)) * 4;
        const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
        
        if (brightness < 80) {
          darkSpots++;
        }
      }
    }
    
    // More dark spots in eye region = higher face confidence
    const eyeScore = Math.min(darkSpots / (region.width * region.height * 0.1), 1);
    confidence += eyeScore * 0.5;
    
    // Check aspect ratio (faces are typically taller than wide)
    const aspectRatio = region.height / region.width;
    if (aspectRatio > 1.1 && aspectRatio < 1.8) {
      confidence += 0.3;
    }
    
    // Size check (faces shouldn't be too small or too large)
    const size = region.width * region.height;
    if (size > 900 && size < 40000) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 1);
  }

  private async detectEdges(imageData: ImageData): Promise<ContentRegion[]> {
    const regions: ContentRegion[] = [];
    const { data, width, height } = imageData;
    
    // Apply Sobel edge detection
    const edges = this.sobelEdgeDetection(data, width, height);
    
    // Find strong edge regions
    const edgeRegions = this.findEdgeRegions(edges, width, height);
    
    return edgeRegions.map(region => ({
      ...region,
      type: 'edge' as const,
      description: 'Strong edge region - good for geometric crops'
    }));
  }

  private sobelEdgeDetection(data: Uint8ClampedArray, width: number, height: number): number[] {
    const edges = new Array(width * height).fill(0);
    
    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            
            gx += gray * sobelX[kernelIdx];
            gy += gray * sobelY[kernelIdx];
          }
        }
        
        edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    
    return edges;
  }

  private findEdgeRegions(edges: number[], width: number, height: number): ContentRegion[] {
    const regions: ContentRegion[] = [];
    const threshold = 50;
    
    // Find connected edge regions
    const visited = new Set<number>();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        
        if (!visited.has(index) && edges[index] > threshold) {
          const region = this.floodFillEdgeRegion(edges, width, height, x, y, visited, threshold);
          
          if (region && region.width > 30 && region.height > 30) {
            regions.push({
              ...region,
              confidence: Math.min(edges[index] / 255, 1),
              type: 'edge',
              description: 'Strong edge region'
            });
          }
        }
      }
    }
    
    return regions;
  }

  private async analyzeComposition(imageData: ImageData): Promise<ContentRegion[]> {
    const regions: ContentRegion[] = [];
    const { width, height } = imageData;
    
    // Rule of thirds regions
    const thirdWidth = width / 3;
    const thirdHeight = height / 3;
    
    // Golden ratio regions
    const goldenRatio = 1.618;
    const goldenWidth = width / goldenRatio;
    const goldenHeight = height / goldenRatio;
    
    // Add rule of thirds intersection points as high-interest regions
    const intersections = [
      { x: thirdWidth, y: thirdHeight },
      { x: thirdWidth * 2, y: thirdHeight },
      { x: thirdWidth, y: thirdHeight * 2 },
      { x: thirdWidth * 2, y: thirdHeight * 2 }
    ];
    
    intersections.forEach((point, index) => {
      regions.push({
        x: point.x - 50,
        y: point.y - 50,
        width: 100,
        height: 100,
        confidence: 0.8,
        type: 'composition',
        description: `Rule of thirds intersection ${index + 1}`
      });
    });
    
    // Add golden ratio regions
    regions.push({
      x: (width - goldenWidth) / 2,
      y: (height - goldenHeight) / 2,
      width: goldenWidth,
      height: goldenHeight,
      confidence: 0.7,
      type: 'composition',
      description: 'Golden ratio composition'
    });
    
    return regions;
  }

  private async detectTextRegions(imageData: ImageData): Promise<ContentRegion[]> {
    const regions: ContentRegion[] = [];
    const { data, width, height } = imageData;
    
    // Simple text detection based on horizontal edge patterns
    const textRegions = this.findTextLikeRegions(data, width, height);
    
    return textRegions.map(region => ({
      ...region,
      type: 'text' as const,
      description: 'Potential text region - avoid cropping through text'
    }));
  }

  private findTextLikeRegions(data: Uint8ClampedArray, width: number, height: number): ContentRegion[] {
    const regions: ContentRegion[] = [];
    
    // Look for horizontal patterns that might be text
    for (let y = 0; y < height - 20; y += 10) {
      for (let x = 0; x < width - 100; x += 20) {
        const textScore = this.analyzeTextPattern(data, width, x, y, 100, 20);
        
        if (textScore > 0.6) {
          regions.push({
            x,
            y,
            width: 100,
            height: 20,
            confidence: textScore,
            type: 'text',
            description: 'Potential text'
          });
        }
      }
    }
    
    return regions;
  }

  private analyzeTextPattern(data: Uint8ClampedArray, width: number, x: number, y: number, w: number, h: number): number {
    let horizontalEdges = 0;
    let verticalEdges = 0;
    let totalPixels = 0;
    
    for (let dy = 0; dy < h - 1; dy++) {
      for (let dx = 0; dx < w - 1; dx++) {
        const currentIdx = ((y + dy) * width + (x + dx)) * 4;
        const rightIdx = ((y + dy) * width + (x + dx + 1)) * 4;
        const downIdx = ((y + dy + 1) * width + (x + dx)) * 4;
        
        const currentGray = (data[currentIdx] + data[currentIdx + 1] + data[currentIdx + 2]) / 3;
        const rightGray = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;
        const downGray = (data[downIdx] + data[downIdx + 1] + data[downIdx + 2]) / 3;
        
        const horizontalDiff = Math.abs(currentGray - rightGray);
        const verticalDiff = Math.abs(currentGray - downGray);
        
        if (horizontalDiff > 30) horizontalEdges++;
        if (verticalDiff > 30) verticalEdges++;
        
        totalPixels++;
      }
    }
    
    // Text typically has more horizontal than vertical edges
    const horizontalRatio = horizontalEdges / totalPixels;
    const verticalRatio = verticalEdges / totalPixels;
    
    if (horizontalRatio > verticalRatio * 1.5 && horizontalRatio > 0.1) {
      return Math.min(horizontalRatio * 2, 1);
    }
    
    return 0;
  }

  private async analyzeColorRegions(imageData: ImageData): Promise<ContentRegion[]> {
    const regions: ContentRegion[] = [];
    const { data, width, height } = imageData;
    
    // Find regions with distinct colors
    const colorClusters = this.findColorClusters(data, width, height);
    
    return colorClusters.map(cluster => ({
      ...cluster,
      type: 'object' as const,
      description: `Distinct color region - potential object of interest`
    }));
  }

  private findColorClusters(data: Uint8ClampedArray, width: number, height: number): ContentRegion[] {
    const regions: ContentRegion[] = [];
    const visited = new Set<number>();
    
    // Sample every 8th pixel for performance
    for (let y = 0; y < height; y += 8) {
      for (let x = 0; x < width; x += 8) {
        const index = (y * width + x) * 4;
        
        if (visited.has(index)) continue;
        
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Skip very dark or very light regions
        const brightness = (r + g + b) / 3;
        if (brightness < 30 || brightness > 225) continue;
        
        const region = this.floodFillRegion(
          data, width, height, x, y, visited,
          (pr, pg, pb) => this.colorDistance(r, g, b, pr, pg, pb) < 40
        );
        
        if (region && region.width > 40 && region.height > 40) {
          regions.push({
            ...region,
            confidence: 0.6,
            type: 'object',
            description: `Color cluster (${r},${g},${b})`
          });
        }
      }
    }
    
    return regions;
  }

  private colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  }

  private floodFillRegion(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number,
    visited: Set<number>,
    predicate: (r: number, g: number, b: number) => boolean
  ): ContentRegion | null {
    const stack = [{ x: startX, y: startY }];
    const regionPixels: { x: number; y: number }[] = [];
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const index = (y * width + x) * 4;
      if (visited.has(index)) continue;
      
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      
      if (!predicate(r, g, b)) continue;
      
      visited.add(index);
      regionPixels.push({ x, y });
      
      // Add neighbors
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
      
      // Limit region size for performance
      if (regionPixels.length > 1000) break;
    }
    
    if (regionPixels.length < 10) return null;
    
    const minX = Math.min(...regionPixels.map(p => p.x));
    const maxX = Math.max(...regionPixels.map(p => p.x));
    const minY = Math.min(...regionPixels.map(p => p.y));
    const maxY = Math.max(...regionPixels.map(p => p.y));
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      confidence: 0.5,
      type: 'object',
      description: 'Detected region'
    };
  }

  private floodFillEdgeRegion(
    edges: number[],
    width: number,
    height: number,
    startX: number,
    startY: number,
    visited: Set<number>,
    threshold: number
  ): ContentRegion | null {
    const stack = [{ x: startX, y: startY }];
    const regionPixels: { x: number; y: number }[] = [];
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const index = y * width + x;
      if (visited.has(index)) continue;
      
      if (edges[index] < threshold) continue;
      
      visited.add(index);
      regionPixels.push({ x, y });
      
      // Add neighbors
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
      
      if (regionPixels.length > 500) break;
    }
    
    if (regionPixels.length < 5) return null;
    
    const minX = Math.min(...regionPixels.map(p => p.x));
    const maxX = Math.max(...regionPixels.map(p => p.x));
    const minY = Math.min(...regionPixels.map(p => p.y));
    const maxY = Math.max(...regionPixels.map(p => p.y));
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      confidence: 0.7,
      type: 'edge',
      description: 'Edge region'
    };
  }

  private generateCropSuggestions(regions: ContentRegion[], imageWidth: number, imageHeight: number): CropSuggestion[] {
    const suggestions: CropSuggestion[] = [];
    
    // Group regions by type for different suggestion strategies
    const faceRegions = regions.filter(r => r.type === 'face');
    const edgeRegions = regions.filter(r => r.type === 'edge');
    const compositionRegions = regions.filter(r => r.type === 'composition');
    const objectRegions = regions.filter(r => r.type === 'object');
    
    // Face-centered crops
    faceRegions.forEach((face, index) => {
      // Portrait crop around face
      const portraitWidth = Math.max(face.width * 2, 200);
      const portraitHeight = portraitWidth * 1.33; // 3:4 aspect ratio
      
      suggestions.push({
        id: `face-portrait-${index}`,
        x: Math.max(0, face.x + face.width / 2 - portraitWidth / 2),
        y: Math.max(0, face.y - portraitHeight * 0.2), // Face in upper third
        width: Math.min(portraitWidth, imageWidth),
        height: Math.min(portraitHeight, imageHeight),
        confidence: face.confidence * 0.9,
        reason: 'Portrait crop centered on detected face',
        aspectRatio: 3/4,
        regions: [face]
      });
      
      // Square crop around face
      const squareSize = Math.max(face.width * 1.8, face.height * 1.8, 150);
      
      suggestions.push({
        id: `face-square-${index}`,
        x: Math.max(0, face.x + face.width / 2 - squareSize / 2),
        y: Math.max(0, face.y + face.height / 2 - squareSize / 2),
        width: Math.min(squareSize, imageWidth),
        height: Math.min(squareSize, imageHeight),
        confidence: face.confidence * 0.85,
        reason: 'Square crop centered on detected face',
        aspectRatio: 1,
        regions: [face]
      });
    });
    
    // Composition-based crops
    compositionRegions.forEach((comp, index) => {
      if (comp.description.includes('rule of thirds')) {
        // Create crops using rule of thirds
        const cropWidth = imageWidth * 0.6;
        const cropHeight = imageHeight * 0.6;
        
        suggestions.push({
          id: `composition-thirds-${index}`,
          x: comp.x - cropWidth / 2,
          y: comp.y - cropHeight / 2,
          width: cropWidth,
          height: cropHeight,
          confidence: comp.confidence,
          reason: 'Rule of thirds composition',
          regions: [comp]
        });
      }
      
      if (comp.description.includes('golden ratio')) {
        suggestions.push({
          id: `composition-golden-${index}`,
          x: comp.x,
          y: comp.y,
          width: comp.width,
          height: comp.height,
          confidence: comp.confidence,
          reason: 'Golden ratio composition',
          aspectRatio: 1.618,
          regions: [comp]
        });
      }
    });
    
    // Object-focused crops
    objectRegions.forEach((obj, index) => {
      if (obj.width > 100 && obj.height > 100) {
        // Crop with padding around object
        const padding = Math.min(obj.width * 0.3, obj.height * 0.3, 50);
        
        suggestions.push({
          id: `object-focused-${index}`,
          x: Math.max(0, obj.x - padding),
          y: Math.max(0, obj.y - padding),
          width: Math.min(obj.width + padding * 2, imageWidth),
          height: Math.min(obj.height + padding * 2, imageHeight),
          confidence: obj.confidence * 0.7,
          reason: 'Object-focused crop with natural padding',
          regions: [obj]
        });
      }
    });
    
    // Multi-region crops (combine nearby regions)
    const combinedRegions = this.findNearbyRegions(regions, imageWidth, imageHeight);
    combinedRegions.forEach((combined, index) => {
      suggestions.push({
        id: `combined-${index}`,
        x: combined.x,
        y: combined.y,
        width: combined.width,
        height: combined.height,
        confidence: combined.confidence,
        reason: `Combined crop including ${combined.regions.length} regions`,
        regions: combined.regions
      });
    });
    
    // Standard aspect ratio crops at high-interest areas
    const standardRatios = [
      { ratio: 16/9, name: 'Widescreen' },
      { ratio: 4/3, name: 'Landscape' },
      { ratio: 1, name: 'Square' },
      { ratio: 3/4, name: 'Portrait' }
    ];
    
    const highInterestRegions = regions
      .filter(r => r.confidence > 0.6)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    
    highInterestRegions.forEach((region, regionIndex) => {
      standardRatios.forEach((ratio, ratioIndex) => {
        const centerX = region.x + region.width / 2;
        const centerY = region.y + region.height / 2;
        
        let cropWidth, cropHeight;
        
        if (ratio.ratio > 1) {
          // Landscape orientation
          cropWidth = Math.min(imageWidth * 0.8, region.width * 3);
          cropHeight = cropWidth / ratio.ratio;
        } else {
          // Portrait or square
          cropHeight = Math.min(imageHeight * 0.8, region.height * 3);
          cropWidth = cropHeight * ratio.ratio;
        }
        
        suggestions.push({
          id: `standard-${regionIndex}-${ratioIndex}`,
          x: Math.max(0, centerX - cropWidth / 2),
          y: Math.max(0, centerY - cropHeight / 2),
          width: Math.min(cropWidth, imageWidth),
          height: Math.min(cropHeight, imageHeight),
          confidence: region.confidence * 0.6,
          reason: `${ratio.name} crop around ${region.description}`,
          aspectRatio: ratio.ratio,
          regions: [region]
        });
      });
    });
    
    // Sort by confidence and remove duplicates
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .filter((suggestion, index, array) => {
        // Remove suggestions that are too similar
        return !array.slice(0, index).some(existing => 
          this.areSuggestionsOverlapping(suggestion, existing, 0.8)
        );
      })
      .slice(0, 12); // Limit to top 12 suggestions
  }

  private findNearbyRegions(regions: ContentRegion[], imageWidth: number, imageHeight: number): Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    regions: ContentRegion[];
  }> {
    const combined: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      confidence: number;
      regions: ContentRegion[];
    }> = [];
    
    const processed = new Set<number>();
    
    regions.forEach((region, index) => {
      if (processed.has(index)) return;
      
      const nearby = [region];
      processed.add(index);
      
      // Find nearby regions
      regions.forEach((other, otherIndex) => {
        if (otherIndex === index || processed.has(otherIndex)) return;
        
        const distance = Math.sqrt(
          Math.pow(region.x - other.x, 2) + Math.pow(region.y - other.y, 2)
        );
        
        const maxDistance = Math.max(region.width, region.height, other.width, other.height);
        
        if (distance < maxDistance * 1.5) {
          nearby.push(other);
          processed.add(otherIndex);
        }
      });
      
      if (nearby.length > 1) {
        // Create bounding box around all nearby regions
        const minX = Math.min(...nearby.map(r => r.x));
        const maxX = Math.max(...nearby.map(r => r.x + r.width));
        const minY = Math.min(...nearby.map(r => r.y));
        const maxY = Math.max(...nearby.map(r => r.y + r.height));
        
        const padding = 20;
        
        combined.push({
          x: Math.max(0, minX - padding),
          y: Math.max(0, minY - padding),
          width: Math.min(maxX - minX + padding * 2, imageWidth),
          height: Math.min(maxY - minY + padding * 2, imageHeight),
          confidence: nearby.reduce((sum, r) => sum + r.confidence, 0) / nearby.length,
          regions: nearby
        });
      }
    });
    
    return combined;
  }

  private areSuggestionsOverlapping(a: CropSuggestion, b: CropSuggestion, threshold: number): boolean {
    const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const overlapArea = overlapX * overlapY;
    
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    const minArea = Math.min(areaA, areaB);
    
    return overlapArea / minArea > threshold;
  }
}