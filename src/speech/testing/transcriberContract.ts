import { describe, expect, it, vi } from 'vitest'
import type { Transcriber, TranscriberHandlers } from '../transcriber.ts'

export interface ContractHarness {
  transcriber: Transcriber
  /** Servise bu metin söylenmiş gibi davranır. */
  speak(text: string): Promise<void>
  /** Bekleyen işlerin bitmesini bekler. */
  settle(): Promise<void>
}

/**
 * Her konuşma tanıma servisinin uyması gereken ortak davranışlar. Yeni bir
 * servis eklendiğinde kendi testinde bu fonksiyonu çağırması yeterli.
 */
export function describeTranscriberContract(name: string, createHarness: () => ContractHarness) {
  describe(`${name}: Transcriber sözleşmesi`, () => {
    function createHandlers(): TranscriberHandlers {
      return { onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() }
    }

    it('söyleneni kesinleşmiş metin olarak iletir', async () => {
      const harness = createHarness()
      const handlers = createHandlers()
      harness.transcriber.start(handlers)
      await harness.settle()
      await harness.speak('merhaba dünya')
      expect(handlers.onFinal).toHaveBeenCalledWith('merhaba dünya')
      expect(handlers.onError).not.toHaveBeenCalled()
    })

    it('durdurulunca bir kez biter ve ara metni temizler', async () => {
      const harness = createHarness()
      const handlers = createHandlers()
      harness.transcriber.start(handlers)
      await harness.settle()
      harness.transcriber.stop()
      await harness.settle()
      expect(handlers.onEnd).toHaveBeenCalledTimes(1)
      expect(handlers.onPartial).toHaveBeenLastCalledWith('')
    })

    it('zaten dinlerken yeniden başlatılırsa ikinci isteği yok sayar', async () => {
      const harness = createHarness()
      const first = createHandlers()
      const second = createHandlers()
      harness.transcriber.start(first)
      await harness.settle()
      harness.transcriber.start(second)
      await harness.settle()
      await harness.speak('tamam')
      expect(first.onFinal).toHaveBeenCalledWith('tamam')
      expect(second.onFinal).not.toHaveBeenCalled()
    })
  })
}
