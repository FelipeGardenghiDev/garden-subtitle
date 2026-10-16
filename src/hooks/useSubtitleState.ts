import { useState, useRef, useEffect, useCallback } from 'react';
import { SubtitleSegment, WordTimestamp } from '../types';
import { HistoryManager, saveDraftToStorage, loadDraftFromStorage } from '../core/history-manager';
import { autoAssignEmojis, detectContextEmoji } from '../core/emoji-detector';
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
  updateWord: (segmentId: string, wordId: string, updates: Partial<Pick<WordTimestamp, 'word' | 'start' | 'end'>>) => void;
  splitSegment: (segmentId: string, splitAtWordIndex?: number) => void;
  mergeWithNextSegment: (segmentId: string) => void;
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
    const safeStart = Math.max(0, Number(start.toFixed(2)));
    const safeEnd = Math.max(Number((safeStart + 0.2).toFixed(2)), Number(end.toFixed(2)));
    const current = historyRef.current.state;
    const updated = current.map(s => {
      if (s.id === id) {
        const oldSpan = s.end - s.start;
        const newSpan = safeEnd - safeStart;
        let words: WordTimestamp[];
        if (s.words.length > 0 && oldSpan > 0.05) {
          words = s.words.map(w => {
            const relStart = (w.start - s.start) / oldSpan;
            const relEnd = (w.end - s.start) / oldSpan;
            return {
              ...w,
              start: Number((safeStart + relStart * newSpan).toFixed(2)),
              end: Number((safeStart + relEnd * newSpan).toFixed(2))
            };
          });
        } else {
          words = createWordTimestamps(s.text, safeStart, safeEnd, id);
        }
        return { ...s, start: safeStart, end: safeEnd, words };
      }
      return s;
    }).sort((a, b) => a.start - b.start);
    setSegments(updated, true);
  }, [setSegments]);

  const updateWord = useCallback((
    segmentId: string,
    wordId: string,
    updates: Partial<Pick<WordTimestamp, 'word' | 'start' | 'end'>>
  ) => {
    const current = historyRef.current.state;
    const updated = current.map(s => {
      if (s.id !== segmentId) return s;

      const updatedWords = s.words.map(w => {
        if (w.id !== wordId) return w;
        const nextWord = updates.word !== undefined ? updates.word : w.word;
        const nextStart = updates.start !== undefined ? Math.max(0, Number(updates.start.toFixed(2))) : w.start;
        const nextEnd = updates.end !== undefined ? Math.max(Number((nextStart + 0.05).toFixed(2)), Number(updates.end.toFixed(2))) : Math.max(Number((nextStart + 0.05).toFixed(2)), w.end);
        return {
          ...w,
          word: nextWord,
          start: nextStart,
          end: nextEnd
        };
      });

      const filteredWords = updatedWords.filter(w => w.word.trim().length > 0);
      if (filteredWords.length === 0) return s;

      const newStart = Math.min(...filteredWords.map(w => w.start));
      const newEnd = Math.max(...filteredWords.map(w => w.end));
      const newText = filteredWords.map(w => w.word.trim()).join(' ');

      return {
        ...s,
        start: Number(newStart.toFixed(2)),
        end: Number(newEnd.toFixed(2)),
        text: newText,
        words: filteredWords
      };
    });

    setSegments(updated, true);
  }, [setSegments]);

  const splitSegment = useCallback((segmentId: string, splitAtWordIndex?: number) => {
    const current = historyRef.current.state;
    const idx = current.findIndex(s => s.id === segmentId);
    if (idx === -1) return;

    const target = current[idx];
    if (target.words.length < 2) return;

    const cutIndex = splitAtWordIndex !== undefined && splitAtWordIndex > 0 && splitAtWordIndex < target.words.length
      ? splitAtWordIndex
      : Math.ceil(target.words.length / 2);

    const firstWords = target.words.slice(0, cutIndex);
    const secondWords = target.words.slice(cutIndex);

    const firstText = firstWords.map(w => w.word).join(' ');
    const secondText = secondWords.map(w => w.word).join(' ');

    const seg1Id = `${target.id}_a`;
    const seg2Id = `${target.id}_b`;

    const seg1: SubtitleSegment = {
      id: seg1Id,
      start: firstWords[0].start,
      end: firstWords[firstWords.length - 1].end,
      text: firstText,
      words: firstWords.map((w, i) => ({ ...w, id: `${seg1Id}_w_${i}` })),
      emoji: detectContextEmoji(firstText) || target.emoji
    };

    const seg2: SubtitleSegment = {
      id: seg2Id,
      start: secondWords[0].start,
      end: secondWords[secondWords.length - 1].end,
      text: secondText,
      words: secondWords.map((w, i) => ({ ...w, id: `${seg2Id}_w_${i}` })),
      emoji: detectContextEmoji(secondText) || undefined
    };

    const updated = [
      ...current.slice(0, idx),
      seg1,
      seg2,
      ...current.slice(idx + 1)
    ];

    setSegments(updated, true);
  }, [setSegments]);

  const mergeWithNextSegment = useCallback((segmentId: string) => {
    const current = historyRef.current.state;
    const idx = current.findIndex(s => s.id === segmentId);
    if (idx === -1 || idx >= current.length - 1) return;

    const first = current[idx];
    const second = current[idx + 1];
    const mergedId = `${first.id}_merged`;
    const combinedWords = [...first.words, ...second.words].map((w, i) => ({
      ...w,
      id: `${mergedId}_w_${i}`
    }));
    const mergedText = `${first.text.trim()} ${second.text.trim()}`.trim();

    const mergedSeg: SubtitleSegment = {
      id: mergedId,
      start: first.start,
      end: second.end,
      text: mergedText,
      words: combinedWords,
      emoji: first.emoji || second.emoji || detectContextEmoji(mergedText) || undefined
    };

    const updated = [
      ...current.slice(0, idx),
      mergedSeg,
      ...current.slice(idx + 2)
    ];

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
    updateWord,
    splitSegment,
    mergeWithNextSegment,
    removeSegment,
    setSegmentEmoji,
    autoDetectEmojis,
    resetSegments
  };
}
