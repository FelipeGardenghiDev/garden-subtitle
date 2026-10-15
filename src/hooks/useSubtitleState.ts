import { useState, useRef, useEffect, useCallback } from 'react';
import { SubtitleSegment } from '../types';
import { HistoryManager, saveDraftToStorage, loadDraftFromStorage } from '../core/history-manager';
import { autoAssignEmojis } from '../core/emoji-detector';
import { createWordTimestamps } from '../core/subtitle-parsers';

export interface UseSubtitleStateReturn {
  segments: SubtitleSegment[];
  canUndo: boolean;
  canRedo: boolean;
  setSegments: (newSegments: SubtitleSegment[], recordHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  addSegment: (start: number, end: number, text?: string) => void;
  updateSegmentText: (id: string, text: string) => void;
  updateSegmentTiming: (id: string, start: number, end: number) => void;
  removeSegment: (id: string) => void;
  setSegmentEmoji: (id: string, emoji: string | null) => void;
  autoDetectEmojis: () => void;
  resetSegments: (initial: SubtitleSegment[]) => void;
}

export function useSubtitleState(initialSegments: SubtitleSegment[]): UseSubtitleStateReturn {
  // Inicializa com rascunho salvo do localStorage se existir, senão usa o padrão
  const historyRef = useRef<HistoryManager<SubtitleSegment[]>>(
    new HistoryManager<SubtitleSegment[]>(loadDraftFromStorage() || initialSegments)
  );

  const [segments, setSegmentsState] = useState<SubtitleSegment[]>(historyRef.current.state);
  const [canUndo, setCanUndo] = useState<boolean>(historyRef.current.canUndo);
  const [canRedo, setCanRedo] = useState<boolean>(historyRef.current.canRedo);

  const updateHistoryState = useCallback(() => {
    setSegmentsState([...historyRef.current.state]);
    setCanUndo(historyRef.current.canUndo);
    setCanRedo(historyRef.current.canRedo);
    saveDraftToStorage(historyRef.current.state);
  }, []);

  const setSegments = useCallback((newSegments: SubtitleSegment[], recordHistory = true) => {
    if (recordHistory) {
      historyRef.current.push(newSegments);
    } else {
      historyRef.current.reset(newSegments);
    }
    updateHistoryState();
  }, [updateHistoryState]);

  const undo = useCallback(() => {
    const prev = historyRef.current.undo();
    if (prev) {
      updateHistoryState();
    }
  }, [updateHistoryState]);

  const redo = useCallback(() => {
    const next = historyRef.current.redo();
    if (next) {
      updateHistoryState();
    }
  }, [updateHistoryState]);

  const addSegment = useCallback((start: number, end: number, text = 'Novo texto') => {
    const id = `seg-${Date.now()}`;
    const words = createWordTimestamps(text, start, end, id);
    const newSeg: SubtitleSegment = { id, start, end, text, words };
    const updated = [...historyRef.current.state, newSeg].sort((a, b) => a.start - b.start);
    setSegments(updated, true);
  }, [setSegments]);

  const updateSegmentText = useCallback((id: string, newText: string) => {
    const current = historyRef.current.state;
    const updated = current.map(s => {
      if (s.id === id) {
        const words = createWordTimestamps(newText, s.start, s.end, id);
        return { ...s, text: newText, words };
      }
      return s;
    });
    setSegments(updated, true);
  }, [setSegments]);

  const updateSegmentTiming = useCallback((id: string, start: number, end: number) => {
    const current = historyRef.current.state;
    const updated = current.map(s => {
      if (s.id === id) {
        const words = createWordTimestamps(s.text, start, end, id);
        return { ...s, start, end, words };
      }
      return s;
    }).sort((a, b) => a.start - b.start);
    setSegments(updated, true);
  }, [setSegments]);

  const removeSegment = useCallback((id: string) => {
    const current = historyRef.current.state;
    const updated = current.filter(s => s.id !== id);
    setSegments(updated, true);
  }, [setSegments]);

  const setSegmentEmoji = useCallback((id: string, emoji: string | null) => {
    const current = historyRef.current.state;
    const updated = current.map(s => {
      if (s.id === id) {
        return { ...s, emoji: emoji || undefined };
      }
      return s;
    });
    setSegments(updated, true);
  }, [setSegments]);

  const autoDetectEmojis = useCallback(() => {
    const current = historyRef.current.state;
    const enriched = autoAssignEmojis(current);
    setSegments(enriched, true);
  }, [setSegments]);

  const resetSegments = useCallback((initial: SubtitleSegment[]) => {
    historyRef.current.reset(initial);
    updateHistoryState();
  }, [updateHistoryState]);

  // Atalhos Globais de Teclado: Ctrl+Z (Undo) e Ctrl+Y / Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora atalho caso usuário esteja digitando dentro de um input ou textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    segments,
    canUndo,
    canRedo,
    setSegments,
    undo,
    redo,
    addSegment,
    updateSegmentText,
    updateSegmentTiming,
    removeSegment,
    setSegmentEmoji,
    autoDetectEmojis,
    resetSegments
  };
}
