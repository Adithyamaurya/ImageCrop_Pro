import { useEffect, useCallback } from 'react';
import { CropArea } from '../App';

interface KeyboardShortcutsProps {
  cropAreas: CropArea[];
  selectedCropId: string | null;
  onCropSelect: (id: string | null) => void;
  onCropUpdate: (id: string, updates: Partial<CropArea>) => void;
  onCropDelete: (id: string) => void;
  onCropCopy: (id: string) => void;
  onAddCrop: () => void;
  onCropDoubleClick: (cropId: string) => void;
  onUpdateGridCrops: (gridId: string, updates: Partial<CropArea>) => void;
  onUnlinkFromGrid: (cropId: string) => void;
  onExportAll: () => void;
  onExportSelected: () => void;
  onReset?: () => void;
  isAdvancedEditorOpen?: boolean;
  onCloseAdvancedEditor?: () => void;
}

export const useKeyboardShortcuts = ({
  cropAreas,
  selectedCropId,
  onCropSelect,
  onCropUpdate,
  onCropDelete,
  onCropCopy,
  onAddCrop,
  onCropDoubleClick,
  onUpdateGridCrops,
  onUnlinkFromGrid,
  onExportAll,
  onExportSelected,
  onReset,
  isAdvancedEditorOpen = false,
  onCloseAdvancedEditor
}: KeyboardShortcutsProps) => {
  
  const selectedCrop = cropAreas.find(crop => crop.id === selectedCropId);
  
  // Movement step size (pixels)
  const MOVE_STEP = 1;
  const MOVE_STEP_LARGE = 10;
  const RESIZE_STEP = 1;
  const RESIZE_STEP_LARGE = 10;
  const ROTATION_STEP = 1;
  const ROTATION_STEP_LARGE = 15;

  // Helper function to update crop or grid
  const updateCropOrGrid = useCallback((crop: CropArea, updates: Partial<CropArea>) => {
    if (crop.gridId) {
      onUpdateGridCrops(crop.gridId, updates);
    } else {
      onCropUpdate(crop.id, updates);
    }
  }, [onCropUpdate, onUpdateGridCrops]);

  // Navigation functions
  const selectNextCrop = useCallback(() => {
    if (cropAreas.length === 0) return;
    
    const currentIndex = selectedCropId ? cropAreas.findIndex(c => c.id === selectedCropId) : -1;
    const nextIndex = (currentIndex + 1) % cropAreas.length;
    onCropSelect(cropAreas[nextIndex].id);
  }, [cropAreas, selectedCropId, onCropSelect]);

  const selectPreviousCrop = useCallback(() => {
    if (cropAreas.length === 0) return;
    
    const currentIndex = selectedCropId ? cropAreas.findIndex(c => c.id === selectedCropId) : -1;
    const prevIndex = currentIndex <= 0 ? cropAreas.length - 1 : currentIndex - 1;
    onCropSelect(cropAreas[prevIndex].id);
  }, [cropAreas, selectedCropId, onCropSelect]);

  // Movement functions
  const moveCrop = useCallback((deltaX: number, deltaY: number) => {
    if (!selectedCrop) return;
    
    updateCropOrGrid(selectedCrop, {
      x: selectedCrop.x + deltaX,
      y: selectedCrop.y + deltaY
    });
  }, [selectedCrop, updateCropOrGrid]);

  // Resize functions
  const resizeCrop = useCallback((deltaWidth: number, deltaHeight: number) => {
    if (!selectedCrop) return;
    
    let newWidth = Math.max(20, selectedCrop.width + deltaWidth);
    let newHeight = Math.max(20, selectedCrop.height + deltaHeight);
    
    // Maintain aspect ratio if set
    if (selectedCrop.aspectRatio && selectedCrop.aspectRatio > 0) {
      if (deltaWidth !== 0) {
        newHeight = newWidth / selectedCrop.aspectRatio;
      } else if (deltaHeight !== 0) {
        newWidth = newHeight * selectedCrop.aspectRatio;
      }
    }
    
    updateCropOrGrid(selectedCrop, {
      width: newWidth,
      height: newHeight
    });
  }, [selectedCrop, updateCropOrGrid]);

  // Rotation functions
  const rotateCrop = useCallback((deltaRotation: number) => {
    if (!selectedCrop) return;
    
    const currentRotation = selectedCrop.rotation || 0;
    let newRotation = currentRotation + deltaRotation;
    
    // Normalize to 0-360 range
    newRotation = ((newRotation % 360) + 360) % 360;
    
    updateCropOrGrid(selectedCrop, { rotation: newRotation });
  }, [selectedCrop, updateCropOrGrid]);

  // Aspect ratio cycling
  const cycleAspectRatio = useCallback(() => {
    if (!selectedCrop) return;
    
    const aspectRatios = [0, 1, 3/4, 4/3, 16/9, 21/9]; // Free, Square, Portrait, Landscape, Widescreen, Ultra Wide
    const currentRatio = selectedCrop.aspectRatio || 0;
    const currentIndex = aspectRatios.findIndex(ratio => Math.abs(ratio - currentRatio) < 0.01);
    const nextIndex = (currentIndex + 1) % aspectRatios.length;
    const newRatio = aspectRatios[nextIndex];
    
    let updates: Partial<CropArea> = { aspectRatio: newRatio || undefined };
    
    // Adjust height to maintain aspect ratio
    if (newRatio > 0) {
      updates.height = selectedCrop.width / newRatio;
    }
    
    updateCropOrGrid(selectedCrop, updates);
  }, [selectedCrop, updateCropOrGrid]);

  // Reset functions
  const resetRotation = useCallback(() => {
    if (!selectedCrop) return;
    updateCropOrGrid(selectedCrop, { rotation: 0 });
  }, [selectedCrop, updateCropOrGrid]);

  const resetAspectRatio = useCallback(() => {
    if (!selectedCrop) return;
    updateCropOrGrid(selectedCrop, { aspectRatio: undefined });
  }, [selectedCrop, updateCropOrGrid]);

  // Main keyboard event handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle shortcuts when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
      return;
    }

    // Don't handle shortcuts in advanced editor (it has its own)
    if (isAdvancedEditorOpen) {
      // Only handle escape to close advanced editor
      if (e.key === 'Escape' && onCloseAdvancedEditor) {
        e.preventDefault();
        onCloseAdvancedEditor();
      }
      return;
    }

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;

    // Prevent default for handled shortcuts
    const preventDefault = () => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Global shortcuts (work without selection)
    switch (e.key.toLowerCase()) {
      // File operations
      case 'n':
        if (isCtrl) {
          preventDefault();
          onAddCrop();
          return;
        }
        break;
        
      case 'r':
        if (isCtrl && isShift && onReset) {
          preventDefault();
          onReset();
          return;
        }
        break;

      // Export operations
      case 'e':
        if (isCtrl && isShift) {
          preventDefault();
          onExportAll();
          return;
        } else if (isCtrl) {
          preventDefault();
          onExportSelected();
          return;
        }
        break;

      // Navigation
      case 'tab':
        preventDefault();
        if (isShift) {
          selectPreviousCrop();
        } else {
          selectNextCrop();
        }
        return;

      case 'arrowup':
      case 'arrowdown':
        if (!selectedCropId) {
          preventDefault();
          if (e.key === 'ArrowUp') {
            selectPreviousCrop();
          } else {
            selectNextCrop();
          }
          return;
        }
        break;

      case 'escape':
        preventDefault();
        onCropSelect(null);
        return;
    }

    // Shortcuts that require a selected crop
    if (!selectedCrop) return;

    switch (e.key.toLowerCase()) {
      // Crop operations
      case 'd':
        if (isCtrl) {
          preventDefault();
          onCropCopy(selectedCrop.id);
          return;
        }
        break;

      case 'delete':
      case 'backspace':
        preventDefault();
        onCropDelete(selectedCrop.id);
        return;

      case 'enter':
        preventDefault();
        onCropDoubleClick(selectedCrop.id);
        return;

      case 'u':
        if (isCtrl && selectedCrop.gridId) {
          preventDefault();
          onUnlinkFromGrid(selectedCrop.id);
          return;
        }
        break;

      // Movement (Arrow keys)
      case 'arrowleft':
        preventDefault();
        moveCrop(isShift ? -MOVE_STEP_LARGE : -MOVE_STEP, 0);
        return;

      case 'arrowright':
        preventDefault();
        moveCrop(isShift ? MOVE_STEP_LARGE : MOVE_STEP, 0);
        return;

      case 'arrowup':
        preventDefault();
        moveCrop(0, isShift ? -MOVE_STEP_LARGE : -MOVE_STEP);
        return;

      case 'arrowdown':
        preventDefault();
        moveCrop(0, isShift ? MOVE_STEP_LARGE : MOVE_STEP);
        return;

      // Resize (Ctrl + Arrow keys)
      case 'arrowleft':
        if (isCtrl) {
          preventDefault();
          resizeCrop(isShift ? -RESIZE_STEP_LARGE : -RESIZE_STEP, 0);
          return;
        }
        break;

      case 'arrowright':
        if (isCtrl) {
          preventDefault();
          resizeCrop(isShift ? RESIZE_STEP_LARGE : RESIZE_STEP, 0);
          return;
        }
        break;

      case 'arrowup':
        if (isCtrl) {
          preventDefault();
          resizeCrop(0, isShift ? -RESIZE_STEP_LARGE : -RESIZE_STEP);
          return;
        }
        break;

      case 'arrowdown':
        if (isCtrl) {
          preventDefault();
          resizeCrop(0, isShift ? RESIZE_STEP_LARGE : RESIZE_STEP);
          return;
        }
        break;

      // Rotation (R key)
      case 'r':
        if (!isCtrl) {
          preventDefault();
          rotateCrop(isShift ? ROTATION_STEP_LARGE : ROTATION_STEP);
          return;
        }
        break;

      case 'l':
        if (!isCtrl) {
          preventDefault();
          rotateCrop(isShift ? -ROTATION_STEP_LARGE : -ROTATION_STEP);
          return;
        }
        break;

      // Quick rotations
      case '[':
        preventDefault();
        rotateCrop(-90);
        return;

      case ']':
        preventDefault();
        rotateCrop(90);
        return;

      // Aspect ratio
      case 'a':
        if (!isCtrl) {
          preventDefault();
          cycleAspectRatio();
          return;
        }
        break;

      // Reset functions
      case '0':
        if (isCtrl) {
          preventDefault();
          resetRotation();
          return;
        }
        break;

      case '9':
        if (isCtrl) {
          preventDefault();
          resetAspectRatio();
          return;
        }
        break;

      // Number keys for quick aspect ratios
      case '1':
        if (isAlt) {
          preventDefault();
          updateCropOrGrid(selectedCrop, { aspectRatio: undefined }); // Free
          return;
        }
        break;

      case '2':
        if (isAlt) {
          preventDefault();
          updateCropOrGrid(selectedCrop, { 
            aspectRatio: 1,
            height: selectedCrop.width
          }); // Square
          return;
        }
        break;

      case '3':
        if (isAlt) {
          preventDefault();
          updateCropOrGrid(selectedCrop, { 
            aspectRatio: 3/4,
            height: selectedCrop.width / (3/4)
          }); // Portrait
          return;
        }
        break;

      case '4':
        if (isAlt) {
          preventDefault();
          updateCropOrGrid(selectedCrop, { 
            aspectRatio: 4/3,
            height: selectedCrop.width / (4/3)
          }); // Landscape
          return;
        }
        break;

      case '5':
        if (isAlt) {
          preventDefault();
          updateCropOrGrid(selectedCrop, { 
            aspectRatio: 16/9,
            height: selectedCrop.width / (16/9)
          }); // Widescreen
          return;
        }
        break;

      case '6':
        if (isAlt) {
          preventDefault();
          updateCropOrGrid(selectedCrop, { 
            aspectRatio: 21/9,
            height: selectedCrop.width / (21/9)
          }); // Ultra Wide
          return;
        }
        break;
    }
  }, [
    selectedCrop,
    cropAreas,
    selectedCropId,
    isAdvancedEditorOpen,
    onCropSelect,
    onAddCrop,
    onCropCopy,
    onCropDelete,
    onCropDoubleClick,
    onUnlinkFromGrid,
    onExportAll,
    onExportSelected,
    onReset,
    onCloseAdvancedEditor,
    selectNextCrop,
    selectPreviousCrop,
    moveCrop,
    resizeCrop,
    rotateCrop,
    cycleAspectRatio,
    resetRotation,
    resetAspectRatio,
    updateCropOrGrid
  ]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Return shortcut information for help display
  return {
    shortcuts: {
      global: [
        { key: 'Ctrl+N', description: 'Add new crop' },
        { key: 'Ctrl+Shift+R', description: 'Reset/New image' },
        { key: 'Ctrl+E', description: 'Export selected crops' },
        { key: 'Ctrl+Shift+E', description: 'Export all crops' },
        { key: 'Tab / Shift+Tab', description: 'Navigate between crops' },
        { key: '↑/↓ (no selection)', description: 'Navigate between crops' },
        { key: 'Esc', description: 'Deselect crop / Close editor' }
      ],
      cropEditing: [
        { key: '← → ↑ ↓', description: 'Move crop (Shift: 10px steps)' },
        { key: 'Ctrl + ← → ↑ ↓', description: 'Resize crop (Shift: 10px steps)' },
        { key: 'R / L', description: 'Rotate right/left (Shift: 15° steps)' },
        { key: '[ ]', description: 'Rotate -90° / +90°' },
        { key: 'A', description: 'Cycle aspect ratios' },
        { key: 'Ctrl+0', description: 'Reset rotation' },
        { key: 'Ctrl+9', description: 'Reset aspect ratio' }
      ],
      cropOperations: [
        { key: 'Ctrl+D', description: 'Duplicate crop' },
        { key: 'Delete / Backspace', description: 'Delete crop' },
        { key: 'Enter', description: 'Open advanced editor' },
        { key: 'Ctrl+U', description: 'Unlink from grid' }
      ],
      aspectRatios: [
        { key: 'Alt+1', description: 'Free aspect ratio' },
        { key: 'Alt+2', description: 'Square (1:1)' },
        { key: 'Alt+3', description: 'Portrait (3:4)' },
        { key: 'Alt+4', description: 'Landscape (4:3)' },
        { key: 'Alt+5', description: 'Widescreen (16:9)' },
        { key: 'Alt+6', description: 'Ultra Wide (21:9)' }
      ]
    }
  };
};