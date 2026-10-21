import { describe, expect, it } from 'vitest'
import { describeFeedback } from './feedbackMessages.ts'

describe('describeFeedback', () => {
  it('silinen metni kısaltarak anlatır ve geri almayı önerir', () => {
    expect(
      describeFeedback({ type: 'deleted', what: 'sentence', removed: 'Gündem hazır.', at: 0 }),
    ).toEqual({ message: 'Cümle silindi: “Gündem hazır.”', action: 'undo' })
  })

  it('geri alınan değişiklik için yinelemeyi önerir', () => {
    expect(describeFeedback({ type: 'undone', count: 1 })).toEqual({ message: 'Geri alındı.', action: 'redo' })
    expect(describeFeedback({ type: 'undone', count: 3 })).toEqual({
      message: '3 değişiklik geri alındı.',
      action: 'redo',
    })
  })

  it('seçim kopyalandıysa bunu belirtir', () => {
    expect(describeFeedback({ type: 'copy', text: 'iki', selection: true }).message).toBe(
      'Seçili metin panoya kopyalandı.',
    )
  })

  it('gezinmeyi düğmesiz anlatır', () => {
    expect(describeFeedback({ type: 'moved', target: { kind: 'line', line: 3 } })).toEqual({
      message: '3. satıra gidildi.',
    })
  })

  it('yapılamayan komutları başarısız olarak işaretler', () => {
    expect(describeFeedback({ type: 'missing', what: 'line' })).toEqual({
      message: 'Böyle bir satır yok.',
      failed: true,
    })
  })

  it('komut tuşuyla söylenip anlaşılamayan ifadeyi bildirir', () => {
    expect(describeFeedback({ type: 'not-understood', phrase: 'Sayfayı çevir.' })).toEqual({
      message: 'Komut anlaşılamadı: “Sayfayı çevir.”',
      failed: true,
    })
  })
})
