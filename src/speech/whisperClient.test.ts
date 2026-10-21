import { describe, expect, it, vi } from 'vitest'
import {
  createWhisperClient,
  restoreVocabularyWords,
  vocabularyPrompt,
  withVocabulary,
} from './whisperClient.ts'

/** Gönderilen istekleri yakalayan sahte whisper.cpp sunucusu. */
function fakeServer() {
  const sent: FormData[] = []
  const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(init?.body as FormData)
    return new Response(JSON.stringify({ text: ' Merhaba  dünya. ' }))
  })
  return { client: createWhisperClient('/whisper', fetch as typeof globalThis.fetch), sent }
}

const audio = new Float32Array(16000)

describe('createWhisperClient', () => {
  it('metni sadeleştirerek döner, ipucu verilmezse göndermez', async () => {
    const { client, sent } = fakeServer()
    expect(await client.transcribe(audio, 16000)).toBe('Merhaba dünya.')
    expect(sent[0].has('prompt')).toBe(false)
  })

  it('verilen ipucunu isteğe ekler', async () => {
    const { client, sent } = fakeServer()
    await client.transcribe(audio, 16000, { prompt: 'Ayşe Hanım.' })
    expect(sent[0].get('prompt')).toBe('Ayşe Hanım.')
  })
})

describe('withVocabulary', () => {
  it('özel kelimeleri her isteğe ipucu olarak ekler; liste değiştirilebilir', async () => {
    const { client, sent } = fakeServer()
    const vocabulary = withVocabulary(client)

    await vocabulary.client.transcribe(audio, 16000)
    vocabulary.setVocabulary(['Ayşe Hanım', 'Kubernetes'])
    await vocabulary.client.transcribe(audio, 16000)
    vocabulary.setVocabulary([])
    await vocabulary.client.transcribe(audio, 16000)

    expect(sent.map((body) => body.get('prompt'))).toEqual([null, 'Ayşe Hanım, Kubernetes.', null])
  })

  it('boş listeden ipucu üretmez', () => {
    expect(vocabularyPrompt([])).toBe('')
  })
})

describe('restoreVocabularyWords', () => {
  const words = ['Grafana', 'Nilüfer Hanım', 'Ankara']

  it('kesme işaretiyle bölünmüş özel kelimeyi geri birleştirir', () => {
    expect(restoreVocabularyWords("Kümeyi Grafan'a ve Prometheus ile izliyoruz.", words)).toBe(
      'Kümeyi Grafana ve Prometheus ile izliyoruz.',
    )
    expect(restoreVocabularyWords("grafan’a", words)).toBe('Grafana')
  })

  it('doğru kullanılmış ekleri ve listede olmayan kelimeleri değiştirmez', () => {
    expect(restoreVocabularyWords("Ankara'ya gidiyoruz, Ali'ye söyle.", words)).toBe(
      "Ankara'ya gidiyoruz, Ali'ye söyle.",
    )
    expect(restoreVocabularyWords("Nilüfer Han'ın hazırlayacak.", words)).toBe(
      "Nilüfer Han'ın hazırlayacak.",
    )
  })

  it('özel kelimeli istemci sonucu bu şekilde düzeltir', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ text: "Grafan'a bak." })))
    const vocabulary = withVocabulary(createWhisperClient('/whisper', fetch as typeof globalThis.fetch))
    vocabulary.setVocabulary(['Grafana'])
    expect(await vocabulary.client.transcribe(audio, 16000)).toBe('Grafana bak.')
  })
})
