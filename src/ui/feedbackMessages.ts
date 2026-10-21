import type { DeletedWhat, FeedbackDetail, MissingWhat, MoveTarget } from '../core/feedback.ts'

export interface DescribedFeedback {
  message: string
  /** Bildirimin yanında sunulacak düğme. */
  action?: 'undo' | 'redo'
  /** Komut istenen işi yapamadı (ör. hedefi bulunamadı). */
  failed?: boolean
}

const DELETED_LABELS: Record<DeletedWhat, string> = {
  sentence: 'Cümle',
  paragraph: 'Paragraf',
  line: 'Satır',
  words: 'Kelime',
  phrase: 'İfade',
  selection: 'Seçili metin',
  dictation: 'Son söylenen',
  all: 'Tüm metin',
}

const MISSING_MESSAGES: Record<MissingWhat, string> = {
  sentence: 'Böyle bir cümle yok.',
  paragraph: 'Böyle bir paragraf yok.',
  words: 'Silinecek bir şey yok.',
  line: 'Böyle bir satır yok.',
  bullet: 'Gidilecek madde yok.',
  selection: 'Seçili metin yok.',
  dictation: 'Silinecek bir şey yok.',
  target: 'Önce bir şey söyle ya da seç.',
}

/** Komutun sonucunu kullanıcıya gösterilecek cümleye çevirir. */
export function describeFeedback(feedback: FeedbackDetail): DescribedFeedback {
  switch (feedback.type) {
    case 'deleted':
      return {
        message:
          feedback.what === 'all'
            ? 'Tüm metin silindi.'
            : `${DELETED_LABELS[feedback.what]} silindi: “${shorten(feedback.removed)}”`,
        action: 'undo',
      }
    case 'replaced':
      return { message: `“${feedback.from}” yerine “${feedback.to}” yazıldı.`, action: 'undo' }
    case 'bullets':
      return { message: `${feedback.count} boş madde eklendi.`, action: 'undo' }
    case 'moved':
      return { message: describeMove(feedback.target) }
    case 'selected':
      return { message: `Seçildi: “${shorten(feedback.text)}”. Konuşursan yerine yazılır.` }
    case 'selection-cleared':
      return { message: 'Seçim kaldırıldı.' }
    case 'missing':
      return { message: MISSING_MESSAGES[feedback.what], failed: true }
    case 'phrase-not-found':
      return { message: `“${shorten(feedback.phrase)}” metinde bulunamadı.`, failed: true }
    case 'undone':
      return {
        message: feedback.count > 1 ? `${feedback.count} değişiklik geri alındı.` : 'Geri alındı.',
        action: 'redo',
      }
    case 'redone':
      return {
        message: feedback.count > 1 ? `${feedback.count} değişiklik yinelendi.` : 'Yinelendi.',
        action: 'undo',
      }
    case 'nothing-to-undo':
      return { message: 'Geri alınacak bir şey yok.', failed: true }
    case 'nothing-to-redo':
      return { message: 'Yinelenecek bir şey yok.', failed: true }
    case 'unrecognized':
      return {
        message: `Komut anlaşılamadı, metin olarak eklendi: “${shorten(feedback.phrase)}”`,
        action: 'undo',
        failed: true,
      }
    case 'not-understood':
      return { message: `Komut anlaşılamadı: “${shorten(feedback.phrase)}”`, failed: true }
    case 'stop-listening':
      return { message: 'Dinleme durduruldu.' }
    case 'copy':
      return { message: feedback.selection ? 'Seçili metin panoya kopyalandı.' : 'Metin panoya kopyalandı.' }
    case 'show-help':
      return { message: 'Komut listesi açıldı.' }
  }
}

function describeMove(target: MoveTarget): string {
  switch (target.kind) {
    case 'line':
      return target.line === 'last' ? 'Son satıra gidildi.' : `${target.line}. satıra gidildi.`
    case 'paragraph':
      return target.paragraph === 'last'
        ? 'Son paragrafa gidildi.'
        : `${target.paragraph}. paragrafa gidildi.`
    case 'sentence':
      return target.edge === 'start' ? 'Cümlenin başına gidildi.' : 'Cümlenin sonuna gidildi.'
    case 'start':
      return 'Metnin başına gidildi.'
    case 'end':
      return 'Metnin sonuna gidildi.'
    case 'bullet':
      return target.direction === 'next' ? 'Sonraki maddeye geçildi.' : 'Önceki maddeye geçildi.'
    case 'phrase':
      return target.side === 'after'
        ? `Bundan sonra “${target.phrase}” kelimesinin arkasına yazılacak.`
        : `Bundan sonra “${target.phrase}” kelimesinin önüne yazılacak.`
  }
}

function shorten(text: string, max = 60) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
