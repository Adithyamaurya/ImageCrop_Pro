import React, { useState } from 'react';
import { Keyboard, X, ChevronDown, ChevronRight } from 'lucide-react';

interface ShortcutGroup {
  key: string;
  description: string;
}

interface KeyboardShortcutsHelpProps {
  shortcuts: {
    global: ShortcutGroup[];
    cropEditing: ShortcutGroup[];
    cropOperations: ShortcutGroup[];
    aspectRatios: ShortcutGroup[];
  };
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ shortcuts }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['global', 'cropEditing']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatKey = (key: string) => {
    return key.split(' / ').map((k, index, array) => (
      <span key={index}>
        {k.split(' + ').map((part, partIndex, partArray) => (
          <span key={partIndex}>
            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">
              {part}
            </kbd>
            {partIndex < partArray.length - 1 && <span className="mx-1 text-gray-400">+</span>}
          </span>
        ))}
        {index < array.length - 1 && <span className="mx-2 text-gray-400">or</span>}
      </span>
    ));
  };

  const sections = [
    { id: 'global', title: 'Global Shortcuts', shortcuts: shortcuts.global, icon: '🌐' },
    { id: 'cropEditing', title: 'Crop Editing', shortcuts: shortcuts.cropEditing, icon: '✏️' },
    { id: 'cropOperations', title: 'Crop Operations', shortcuts: shortcuts.cropOperations, icon: '⚡' },
    { id: 'aspectRatios', title: 'Quick Aspect Ratios', shortcuts: shortcuts.aspectRatios, icon: '📐' }
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg transition-colors z-40"
        title="Show keyboard shortcuts (Press ? for help)"
      >
        <Keyboard className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Keyboard className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
              <p className="text-sm text-gray-400">Master your workflow with these shortcuts</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto modal-scrollbar p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sections.map((section) => (
              <div key={section.id} className="bg-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{section.icon}</span>
                    <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                    <span className="text-xs text-gray-400">({section.shortcuts.length})</span>
                  </div>
                  {expandedSections.has(section.id) ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                
                {expandedSections.has(section.id) && (
                  <div className="px-4 pb-4">
                    <div className="space-y-3 max-h-64 overflow-y-auto thin-scrollbar">
                      {section.shortcuts.map((shortcut, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-b-0">
                          <div className="flex items-center space-x-3">
                            {formatKey(shortcut.key)}
                          </div>
                          <span className="text-sm text-gray-300 text-right flex-1 ml-4">
                            {shortcut.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pro Tips */}
          <div className="mt-8 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <span className="mr-2">💡</span>
              Pro Tips
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
              <div className="space-y-2">
                <div>• <strong>Hold Shift</strong> for larger movement/resize steps</div>
                <div>• <strong>Use Tab</strong> to quickly navigate between crops</div>
                <div>• <strong>Press Enter</strong> on selected crop for advanced editing</div>
                <div>• <strong>Alt + Numbers</strong> for instant aspect ratio changes</div>
              </div>
              <div className="space-y-2">
                <div>• <strong>Arrow keys</strong> work without mouse selection</div>
                <div>• <strong>Ctrl + Arrow</strong> resizes instead of moving</div>
                <div>• <strong>[ and ]</strong> for quick 90° rotations</div>
                <div>• <strong>Escape</strong> always deselects or closes dialogs</div>
              </div>
            </div>
          </div>

          {/* Quick Reference Card */}
          <div className="mt-6 bg-gray-800 rounded-lg p-4">
            <h4 className="text-md font-semibold text-white mb-3">Quick Reference</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400">
              <div>
                <div className="font-semibold text-blue-400 mb-1">Movement</div>
                <div>Arrow Keys</div>
              </div>
              <div>
                <div className="font-semibold text-green-400 mb-1">Resize</div>
                <div>Ctrl + Arrows</div>
              </div>
              <div>
                <div className="font-semibold text-orange-400 mb-1">Rotate</div>
                <div>R / L Keys</div>
              </div>
              <div>
                <div className="font-semibold text-purple-400 mb-1">Aspect</div>
                <div>Alt + 1-6</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div>Press <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">?</kbd> anytime to show this help</div>
            <div>Press <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">Esc</kbd> to close</div>
          </div>
        </div>
      </div>
    </div>
  );
};