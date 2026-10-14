/**
 * Konuşma tanıma servislerinin ortak arayüzü. Arayüz kodu yalnızca bunu bilir;
 * servis değiştiğinde (ör. tarayıcıdan bulut servisine geçişte) arayüz değişmez.
 */
export interface Transcriber {
  start(handlers: TranscriberHandlers): void
  stop(): void
}

export interface TranscriberHandlers {
  /** Henüz kesinleşmemiş metin; her çağrıda bir öncekinin yerine geçer. */
  onPartial(text: string): void
  /** Kesinleşmiş metin parçası. */
  onFinal(text: string): void
  onError(error: TranscriberError): void
  /** Dinleme tamamen durdu. */
  onEnd(): void
}

export type TranscriberError = 'permission' | 'no-microphone' | 'network' | 'unavailable'
