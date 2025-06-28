import { useState, useCallback, useRef } from 'react';

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface UndoRedoActions {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  push: (newState: any) => void;
  reset: (initialState: any) => void;
  clear: () => void;
}

export function useUndoRedo<T>(initialState: T, maxHistorySize: number = 50): [T, UndoRedoActions] {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: []
  });

  const lastPushTime = useRef<number>(0);
  const debounceDelay = 500; // 500ms debounce to group rapid changes

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return;

    setHistory(currentHistory => {
      const previous = currentHistory.past[currentHistory.past.length - 1];
      const newPast = currentHistory.past.slice(0, currentHistory.past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [currentHistory.present, ...currentHistory.future]
      };
    });
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    setHistory(currentHistory => {
      const next = currentHistory.future[0];
      const newFuture = currentHistory.future.slice(1);

      return {
        past: [...currentHistory.past, currentHistory.present],
        present: next,
        future: newFuture
      };
    });
  }, [canRedo]);

  const push = useCallback((newState: T) => {
    const now = Date.now();
    
    // Debounce rapid changes (like dragging)
    if (now - lastPushTime.current < debounceDelay) {
      // Just update the present state without adding to history
      setHistory(currentHistory => ({
        ...currentHistory,
        present: newState
      }));
      return;
    }

    lastPushTime.current = now;

    setHistory(currentHistory => {
      // Don't add to history if the state hasn't actually changed
      if (JSON.stringify(currentHistory.present) === JSON.stringify(newState)) {
        return currentHistory;
      }

      const newPast = [...currentHistory.past, currentHistory.present];
      
      // Limit history size
      if (newPast.length > maxHistorySize) {
        newPast.shift();
      }

      return {
        past: newPast,
        present: newState,
        future: [] // Clear future when new state is pushed
      };
    });
  }, [maxHistorySize, debounceDelay]);

  const reset = useCallback((newInitialState: T) => {
    setHistory({
      past: [],
      present: newInitialState,
      future: []
    });
  }, []);

  const clear = useCallback(() => {
    setHistory(currentHistory => ({
      past: [],
      present: currentHistory.present,
      future: []
    }));
  }, []);

  // Force push for important changes (like completing a drag operation)
  const forcePush = useCallback((newState: T) => {
    lastPushTime.current = Date.now();
    
    setHistory(currentHistory => {
      const newPast = [...currentHistory.past, currentHistory.present];
      
      if (newPast.length > maxHistorySize) {
        newPast.shift();
      }

      return {
        past: newPast,
        present: newState,
        future: []
      };
    });
  }, [maxHistorySize]);

  return [
    history.present,
    {
      canUndo,
      canRedo,
      undo,
      redo,
      push,
      reset,
      clear,
      forcePush
    } as UndoRedoActions & { forcePush: (newState: T) => void }
  ];
}