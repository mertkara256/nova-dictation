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
  /** Ana servis kullanılamadığı için yedek servise geçildi. */
  onFallback?(): void
  /**
   * Mikrofondaki anlık ses seviyesi (RMS, 0–1). Yalnızca sesi kendisi işleyen
   * servisler bildirir; sık çağrılır, bu yüzden arayüz bunu yeniden çizimle değil
   * animasyon döngüsünde okumalıdır.
   */
  onLevel?(level: number): void
}

export type TranscriberError = 'permission' | 'no-microphone' | 'network' | 'unavailable'
