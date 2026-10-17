export type DeletedWhat =
  | 'sentence'
  | 'paragraph'
  | 'words'
  | 'phrase'
  | 'selection'
  | 'dictation'
  | 'all'

export type MoveTarget =
  | { kind: 'line'; line: number | 'last' }
  | { kind: 'start' }
  | { kind: 'end' }
  | { kind: 'bullet'; direction: 'next' | 'previous' }
  | { kind: 'phrase'; phrase: string; side: 'before' | 'after' }

export type MissingWhat = 'sentence' | 'paragraph' | 'words' | 'line' | 'bullet' | 'selection' | 'dictation'

/** Bir komutun ya da işlemin kullanıcıya bildirilecek sonucu. */
export type FeedbackDetail =
  | { type: 'deleted'; what: DeletedWhat; removed: string; at: number }
  | { type: 'replaced'; from: string; to: string }
  | { type: 'bullets'; count: number }
  | { type: 'moved'; target: MoveTarget }
  | { type: 'selected'; text: string }
  | { type: 'selection-cleared' }
  /** Komutun hedefi (cümle, satır, madde…) bulunamadı. */
  | { type: 'missing'; what: MissingWhat }
  | { type: 'phrase-not-found'; phrase: string }
  | { type: 'undone' }
  | { type: 'redone' }
  | { type: 'nothing-to-undo' }
  | { type: 'nothing-to-redo' }
  /** Komut kelimesinden sonra tanınmayan ifade; metin olarak eklendi. */
  | { type: 'unrecognized'; phrase: string }
  /** Komut tuşuyla söylenen ama komut olarak anlaşılamayan ifade; metne eklenmedi. */
  | { type: 'not-understood'; phrase: string }
  /** Arayüzün yapması gereken işler. */
  | { type: 'stop-listening' }
  | { type: 'copy' }
  | { type: 'show-help' }

/** Bildirim; id her yeni sonuçta artar, arayüz bununla yenisini tanır. */
export type EditorFeedback = FeedbackDetail & { id: number }
