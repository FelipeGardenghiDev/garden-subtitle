import { SubtitleSegment } from '../types';

/**
 * Gerenciador de Histórico Imutável (Memento Pattern)
 * Permite Undo (Desfazer) e Redo (Refazer) com limite de profundidade de memória.
 */
export class HistoryManager<T> {
  private past: T[] = [];
  private present: T;
  private future: T[] = [];
  private maxDepth: number;

  constructor(initialPresent: T, maxDepth = 50) {
    this.present = initialPresent;
    this.maxDepth = maxDepth;
  }

  get state(): T {
    return this.present;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get undoCount(): number {
    return this.past.length;
  }

  get redoCount(): number {
    return this.future.length;
  }

  /**
   * Registra um novo estado na pilha de histórico
   */
  push(newPresent: T): void {
    // Evita duplicar estado idêntico consecutivo
    if (JSON.stringify(newPresent) === JSON.stringify(this.present)) {
      return;
    }
    this.past.push(this.present);
    if (this.past.length > this.maxDepth) {
      this.past.shift();
    }
    this.present = newPresent;
    this.future = [];
  }

  /**
   * Desfaz a última ação (Undo / Ctrl+Z)
   */
  undo(): T | null {
    if (!this.canUndo) return null;
    const previous = this.past.pop()!;
    this.future.unshift(this.present);
    this.present = previous;
    return this.present;
  }

  /**
   * Refaz a ação previamente desfeita (Redo / Ctrl+Y)
   */
  redo(): T | null {
    if (!this.canRedo) return null;
    const next = this.future.shift()!;
    this.past.push(this.present);
    this.present = next;
    return this.present;
  }

  /**
   * Reseta o histórico com um novo estado inicial
   */
  reset(newInitial: T): void {
    this.past = [];
    this.present = newInitial;
    this.future = [];
  }
}

export const DRAFT_STORAGE_KEY = 'garden_subtitle_draft_v1';

/**
 * Salva rascunho atual das legendas no LocalStorage de forma resiliente
 */
export function saveDraftToStorage(segments: SubtitleSegment[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(segments));
    }
  } catch (err) {
    console.warn('Falha ao salvar rascunho no localStorage:', err);
  }
}

/**
 * Carrega o último rascunho de legendas salvo
 */
export function loadDraftFromStorage(): SubtitleSegment[] | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as SubtitleSegment[];
      }
    }
  } catch (err) {
    console.warn('Falha ao carregar rascunho do localStorage:', err);
  }
  return null;
}

/**
 * Limpa o rascunho salvo do LocalStorage
 */
export function clearDraftFromStorage(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Falha ao limpar rascunho do localStorage:', err);
  }
}
