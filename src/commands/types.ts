import type { Ordinal } from '../core/document.ts'

export type Command =
  // Silme
  | { type: 'delete-sentence'; which: Ordinal }
  | { type: 'delete-paragraph'; which: Ordinal }
  | { type: 'delete-words'; count: number }
  | { type: 'delete-phrase'; phrase: string }
  /** Seçim varsa onu, yoksa son dikte edilen parçayı siler. */
  | { type: 'delete-that' }
  | { type: 'delete-selection' }
  | { type: 'delete-all' }
  // Düzeltme ve biçim
  | { type: 'replace'; from: string; to: string }
  | { type: 'insert-break'; kind: 'line' | 'paragraph' }
  | { type: 'insert-mark'; mark: string }
  | { type: 'add-bullets'; count: number }
  /** phrase null ise "bunu": seçim varsa o, yoksa son dikte edilen parça. */
  | { type: 'set-case'; phrase: string | null; to: 'upper' | 'lower' }
  /** phrase null ise "bunu": seçim varsa o, yoksa son dikte edilen parça. */
  | { type: 'wrap'; phrase: string | null; marks: 'quotes' | 'parentheses' }
  // Gezinme
  | { type: 'go-to-line'; line: Ordinal }
  | { type: 'go-to-edge'; edge: 'start' | 'end' }
  | { type: 'go-to-bullet'; direction: 'next' | 'previous' }
  | { type: 'go-to-phrase'; phrase: string; side: 'before' | 'after' }
  // Seçme
  | { type: 'select-sentence'; which: Ordinal }
  | { type: 'select-paragraph'; which: Ordinal }
  | { type: 'select-between'; from: string; to: string }
  | { type: 'select-phrase'; phrase: string }
  | { type: 'select-words'; count: number }
  /** Son dikte edilen parçayı seçer. */
  | { type: 'select-that' }
  | { type: 'select-all' }
  | { type: 'clear-selection' }
  // Genel
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'stop-listening' }
  | { type: 'copy' }
  | { type: 'show-help' }
