import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Eye, Users, Square, Crop, X, Check, Loader2 } from 'lucide-react';
import { ContentAnalyzer, CropSuggestion } from '../utils/contentAnalysis';
import { CropArea } from '../App';

interface ContentAwareSuggestionsProps {
  originalImage: HTMLImageElement | null;
  onAddSuggestion: (suggestion: Omit<CropArea, 'id'>) => void;
  imageScale: number;
  imageOffset: { x: number; y: number };
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export const ContentAwareSuggestions: React.FC<ContentAwareSuggestionsProps> = ({
  originalImage,
  onAddSuggestion,
  imageScale,
  imageOffset,
  isVisible,
  onToggleVisibility
}) => {
  const [suggestions, setSuggestions] = useState<CropSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'face' | 'composition' | 'object'>('all');
  const [analyzer] = useState(() => new ContentAnalyzer());

  useEffect(() => {
    if (originalImage && isVisible && suggestions.length === 0) {
      analyzImage();
    }
  }, [originalImage, isVisible]);

  const analyzImage = async () => {
    if (!originalImage) return;
    
    setIsAnalyzing(true);
    try {
      const cropSuggestions = await analyzer.analyzeImage(originalImage);
      setSuggestions(cropSuggestions);
    } catch (error) {
      console.error('Content analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddSuggestion = (suggestion: CropSuggestion) => {
    // Convert suggestion to crop area coordinates
    const cropArea: Omit<CropArea, 'id'> = {
      x: suggestion.x * imageScale + imageOffset.x,
      y: suggestion.y * imageScale + imageOffset.y,
      width: suggestion.width * imageScale,
      height: suggestion.height * imageScale,
      aspectRatio: suggestion.aspectRatio,
      rotation: 0,
      name: `Smart Crop ${suggestions.indexOf(suggestion) + 1}`,
      visible: true,
      zIndex: 0
    };
    
    onAddSuggestion(cropArea);
    setSelectedSuggestion(suggestion.id);
    
    // Auto-hide after adding
    setTimeout(() => setSelectedSuggestion(null), 1000);
  };

  const getFilteredSuggestions = () => {
    if (filterType === 'all') return suggestions;
    
    return suggestions.filter(suggestion => {
      const hasType = suggestion.regions.some(region => {
        switch (filterType) {
          case 'face':
            return region.type === 'face';
          case 'composition':
            return region.type === 'composition';
          case 'object':
            return region.type === 'object' || region.type === 'edge';
          default:
            return true;
        }
      });
      return hasType;
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'text-green-400';
    if (confidence > 0.6) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence > 0.8) return '🎯';
    if (confidence > 0.6) return '✨';
    return '💡';
  };

  const getSuggestionIcon = (suggestion: CropSuggestion) => {
    const hasType = (type: string) => suggestion.regions.some(r => r.type === type);
    
    if (hasType('face')) return <Users className="h-4 w-4" />;
    if (hasType('composition')) return <Eye className="h-4 w-4" />;
    if (hasType('edge')) return <Crop className="h-4 w-4" />;
    return <Square className="h-4 w-4" />;
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggleVisibility}
        className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 px-4 transition-colors"
        title="Show AI crop suggestions"
      >
        <Brain className="h-4 w-4" />
        <span>Smart Suggestions</span>
        <Sparkles className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Smart Suggestions</h3>
            <p className="text-xs text-gray-400">AI-powered crop recommendations</p>
          </div>
        </div>
        <button
          onClick={onToggleVisibility}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isAnalyzing && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-purple-400 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-400">Analyzing image content...</p>
            <p className="text-xs text-gray-500 mt-1">Detecting faces, objects, and composition</p>
          </div>
        </div>
      )}

      {!isAnalyzing && suggestions.length === 0 && (
        <div className="text-center py-6">
          <Brain className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-2">No suggestions available</p>
          <button
            onClick={analyzImage}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            Retry Analysis
          </button>
        </div>
      )}

      {!isAnalyzing && suggestions.length > 0 && (
        <>
          {/* Filter Controls */}
          <div className="flex space-x-1 mb-4">
            {[
              { key: 'all', label: 'All', icon: '🎯' },
              { key: 'face', label: 'Faces', icon: '👤' },
              { key: 'composition', label: 'Composition', icon: '🎨' },
              { key: 'object', label: 'Objects', icon: '📦' }
            ].map(filter => (
              <button
                key={filter.key}
                onClick={() => setFilterType(filter.key as any)}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                  filterType === filter.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <span>{filter.icon}</span>
                <span>{filter.label}</span>
              </button>
            ))}
          </div>

          {/* Suggestions List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {getFilteredSuggestions().map((suggestion, index) => (
              <div
                key={suggestion.id}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedSuggestion === suggestion.id
                    ? 'bg-green-900/20 border-green-500'
                    : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                }`}
                onClick={() => handleAddSuggestion(suggestion)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2 flex-1">
                    <div className="text-purple-400 mt-0.5">
                      {getSuggestionIcon(suggestion)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-white truncate">
                          {suggestion.reason}
                        </span>
                        <span className="text-xs">
                          {getConfidenceIcon(suggestion.confidence)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mb-2">
                        {Math.round(suggestion.width)} × {Math.round(suggestion.height)}
                        {suggestion.aspectRatio && (
                          <span className="ml-2 text-blue-400">
                            {suggestion.aspectRatio === 1 ? '1:1' :
                             suggestion.aspectRatio === 4/3 ? '4:3' :
                             suggestion.aspectRatio === 3/4 ? '3:4' :
                             suggestion.aspectRatio === 16/9 ? '16:9' :
                             suggestion.aspectRatio === 21/9 ? '21:9' :
                             `${suggestion.aspectRatio.toFixed(2)}:1`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}>
                          {Math.round(suggestion.confidence * 100)}% confidence
                        </span>
                        <span className="text-xs text-gray-500">
                          {suggestion.regions.length} region{suggestion.regions.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    {selectedSuggestion === suggestion.id ? (
                      <div className="flex items-center space-x-1 text-green-400">
                        <Check className="h-3 w-3" />
                        <span className="text-xs">Added</span>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSuggestion(suggestion);
                        }}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded transition-colors"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>

                {/* Region Details */}
                {suggestion.regions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    <div className="flex flex-wrap gap-1">
                      {suggestion.regions.slice(0, 3).map((region, regionIndex) => (
                        <span
                          key={regionIndex}
                          className={`text-xs px-2 py-1 rounded ${
                            region.type === 'face' ? 'bg-blue-900/30 text-blue-300' :
                            region.type === 'composition' ? 'bg-purple-900/30 text-purple-300' :
                            region.type === 'edge' ? 'bg-orange-900/30 text-orange-300' :
                            'bg-gray-900/30 text-gray-300'
                          }`}
                        >
                          {region.type === 'face' ? '👤' :
                           region.type === 'composition' ? '🎨' :
                           region.type === 'edge' ? '📐' :
                           region.type === 'text' ? '📝' : '📦'} {region.type}
                        </span>
                      ))}
                      {suggestion.regions.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{suggestion.regions.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {getFilteredSuggestions().length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400">No suggestions for this filter</p>
            </div>
          )}

          {/* Analysis Summary */}
          <div className="mt-4 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-400 space-y-1">
              <div>✨ Found {suggestions.length} smart crop suggestions</div>
              <div>🎯 Based on faces, composition, and objects</div>
              <div>🤖 Powered by computer vision analysis</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};