import { useEffect, useLayoutEffect, useRef } from 'react'
import type { CommandLogEntry } from '../core/editor.ts'
import type { Dictation } from './useDictation.ts'

/**
 * "Dinlemeyi durdur" ve "duraklat" komutlarının mikrofona etkisi; editör ve ilk kullanım
 * rehberi aynı kuralı izler. Komutlar geçmişin yeni satırlarından okunur.
 */
export function useListeningCommands(log: CommandLogEntry[], dictation: Dictation, localModel: boolean) {
  // İşlenen komut, onu getiren render'dan sonraki en güncel dinleme durumuna uygulanır.
  const latest = useRef({ dictation, localModel })
  useLayoutEffect(() => {
    latest.current = { dictation, localModel }
  })

  const handledLogId = useRef(0)
  useEffect(() => {
    for (const { id, detail } of log) {
      if (id <= handledLogId.current) continue
      handledLogId.current = id
      const { dictation, localModel } = latest.current
      // Komut işlendiğinde henüz yazıya çevrilmemiş ses, komuttan sonra söylenmiştir; metne yazılmaz.
      if (detail?.type === 'stop-listening') dictation.cancel()
      // Tarayıcının tanımasında ses Google'a gider; duraklatmak mikrofonu kapatır.
      if (detail?.type === 'pause-listening' && (dictation.usingFallback || !localModel)) dictation.cancel()
    }
  }, [log])
}
