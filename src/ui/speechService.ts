import { createSpeechService } from '../speech/index.ts'

/** Uygulamanın konuşma tanıma servisi; uygulama açılırken bir kez oluşturulur. */
export const speech = createSpeechService()
