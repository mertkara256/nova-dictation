import { describe, expect, it } from 'vitest'
import { describeFeedback } from './feedbackMessages.ts'

describe('describeFeedback', () => {
  it('silinen metni kısaltarak anlatır ve geri almayı önerir', () => {
    expect(
      describeFeedback({ type: 'deleted', what: 'sentence', removed: 'Gündem hazır.', at: 0 }),
    ).toEqual({ message: 'Cümle silindi: “Gündem hazır.”', action: 'undo' })
  })

  it('geri alınan değişiklik için yinelemeyi önerir', () => {
    expect(describeFeedback({ type: 'undone' })).toEqual({ message: 'Geri alındı.', action: 'redo' })
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
})
