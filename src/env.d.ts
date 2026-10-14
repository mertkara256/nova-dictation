interface ImportMetaEnv {
  /** Konuşma tanıma servisi; ayrıntılar src/speech/index.ts dosyasında. */
  readonly VITE_STT_PROVIDER?: 'whisper' | 'webspeech'
}
