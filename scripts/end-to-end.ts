/**
 * Uygulamayı gerçek bir tarayıcıda, biri mikrofona konuşuyormuş gibi baştan sona
 * dener (`npm run test:e2e`). Türkçe cümleler macOS'un Yelda sesiyle seslendirilir
 * ve Chrome'a mikrofon yerine bu ses verilir. Böylece birim testlerinin sahte bir
 * servisle denediği yol gerçekten çalışır: mikrofon, konuşma algılama, Whisper,
 * komutlar ve metin; mikrofon düğmesi ve komut tuşuyla birlikte.
 *
 * Gerekenler: macOS, Google Chrome ve açık bir Whisper sunucusu (`npm run whisper`).
 * Whisper modeli ve Türkçe ses gerektiği için GitHub'daki testlerde çalışmaz.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Page, chromium } from 'playwright-core'
import { createServer } from 'vite'
import { toLowerTr } from '../src/core/text.ts'
import { concatAudio, decodeWav, encodeWav } from '../src/speech/audio.ts'
import { createWhisperClient } from '../src/speech/whisperClient.ts'

const WHISPER_URL = process.env.WHISPER_URL ?? 'http://127.0.0.1:8178'
const SAMPLE_RATE = 48000
// Mikrofon açılırken kaçan ilk an konuşmaya denk gelmesin diye.
const LEADING_SILENCE_MS = 500
// Cümleler arası sessizlik; konuşma parçasının bitmesine yeter (eşik 0,7 sn).
const PAUSE_MS = 1500
// Ses bittikten sonra, tarayıcıdaki ses işlemenin yetişmesi için beklenen süre.
const SETTLE_MS = 200
// Mikrofon kapandıktan sonra bekleyen sesin yazıya çevrilmesi için en uzun bekleme
// (Whisper isteğinin zaman aşımı 30 saniye).
const FINISH_TIMEOUT_MS = 40_000

interface Scenario {
  name: string
  /** Uygulama açılırken metin alanında duran taslak. */
  draft?: string
  /** Sırayla seslendirilen cümleler; aralarında PAUSE_MS kadar sessizlik vardır. */
  speech: string[]
  /** Son cümleden sonra, mikrofon kapanmadan önceki sessizlik. */
  trailingSilenceMs: number
  /**
   * Mikrofon düğmeyle mi açılıp kapanır, yoksa ⌃ basılı tutulduğu sürece mi açık kalır?
   * Düğmeyle açılan mikrofon sesle kapatılmışsa ("dinlemeyi durdur") yeniden basılmaz.
   */
  control: 'mic-button' | 'command-key'
  /** Konuşmadan önce sayfada yapılanlar (ör. yeni not açmak). */
  before?(page: Page): Promise<void>
  /** Mikrofon kapandıktan sonra sayfada yapılanlar; bulunan sorunları döner. */
  after?(page: Page): Promise<string[]>
  /** En sonda metin alanında olması beklenen. */
  expected: string
}

const SCENARIOS: Scenario[] = [
  {
    name: 'Dikte, “Nova” ile komut ve dikteye devam',
    speech: ['Bugün hava çok güzel.', 'Nova, yeni paragraf.', 'Yarın görüşürüz.'],
    trailingSilenceMs: PAUSE_MS,
    control: 'mic-button',
    expected: 'Bugün hava çok güzel.\n\nYarın görüşürüz.',
  },
  {
    name: 'Konuşma biter bitmez kapatılan mikrofon son sözü kaybetmez',
    // Sayı içermez: Whisper "üçte"yi bazen "3'te" diye yazıyor.
    speech: ['Toplantı yarın sabah başlıyor.'],
    trailingSilenceMs: 0,
    control: 'mic-button',
    expected: 'Toplantı yarın sabah başlıyor.',
  },
  {
    name: '⌃ basılıyken söylenen komut, tuş bırakılınca uygulanır',
    draft: 'Birinci cümle. İkinci cümle.',
    speech: ['Son cümleyi sil.'],
    trailingSilenceMs: 0,
    control: 'command-key',
    expected: 'Birinci cümle.',
  },
  {
    name: '“Nova” deyip duraklayınca komut bir sonraki sözde beklenir',
    speech: ['Toplantı yarın.', 'Nova.', 'Yeni paragraf.', 'Görüşmek üzere.'],
    trailingSilenceMs: PAUSE_MS,
    control: 'mic-button',
    expected: 'Toplantı yarın.\n\nGörüşmek üzere.',
  },
  {
    name: 'Sesle geri alma, önceki dikteyi geri alır',
    speech: ['Bugün hava güzel.', 'Nova, geri al.', 'Yarın görüşürüz.'],
    trailingSilenceMs: PAUSE_MS,
    control: 'mic-button',
    expected: 'Yarın görüşürüz.',
  },
  {
    name: 'Komuttan sonra çıkan bildirimdeki Geri al düğmesi',
    draft: 'Birinci cümle. İkinci cümle.',
    speech: ['Nova, son cümleyi sil.'],
    trailingSilenceMs: PAUSE_MS,
    control: 'mic-button',
    async after(page) {
      await page.getByRole('status').getByRole('button', { name: 'Geri al' }).click({ timeout: 5000 })
      return []
    },
    expected: 'Birinci cümle. İkinci cümle.',
  },
  {
    name: '⌃ basılıyken art arda iki komut',
    draft: 'Bir. İki. Üç.',
    speech: ['Son cümleyi sil, son cümleyi sil.'],
    trailingSilenceMs: 0,
    control: 'command-key',
    expected: 'Bir.',
  },
  {
    name: 'Sesle seçilen kelimenin yerine dikte edilir',
    draft: 'Toplantı yarın saat onda.',
    speech: ['Nova, yarın kelimesini seç.', 'Perşembe.'],
    trailingSilenceMs: PAUSE_MS,
    control: 'mic-button',
    expected: 'Toplantı perşembe saat onda.',
  },
  {
    name: '“Dinlemeyi durdur” mikrofonu kapatır, sonrası yazılmaz',
    speech: ['Merhaba.', 'Nova, dinlemeyi durdur.', 'Bu cümle yazılmamalı.'],
    trailingSilenceMs: PAUSE_MS,
    control: 'mic-button',
    expected: 'Merhaba.',
  },
  {
    name: '“Duraklat”tan sonrası “devam et” denene kadar yazılmaz',
    speech: ['Merhaba.', 'Nova, duraklat.', 'Bu cümle yazılmamalı.', 'Nova, devam et.', 'Görüşürüz.'],
    trailingSilenceMs: PAUSE_MS,
    control: 'mic-button',
    expected: 'Merhaba. Görüşürüz.',
  },
  {
    name: 'Yeni notta dikte; önceki not olduğu gibi kalır',
    draft: 'İlk not.',
    speech: ['Yeni nottaki cümle.'],
    trailingSilenceMs: PAUSE_MS,
    control: 'mic-button',
    async before(page) {
      await page.getByRole('button', { name: 'Notlar' }).click()
      await page.getByRole('button', { name: 'Yeni not' }).click()
    },
    async after(page) {
      const problems: string[] = []
      const text = await page.getByLabel('Metin').inputValue()
      if (comparable(text) !== comparable('Yeni nottaki cümle.')) {
        problems.push(`Yeni notun metni beklenenden farklı: ${JSON.stringify(text)}`)
      }
      // Önceki not açılınca onun metni geri gelmeli.
      await page.getByRole('button', { name: /^İlk not/ }).click()
      return problems
    },
    expected: 'İlk not.',
  },
]

// Sayfaya eklenen işaret: mikrofonun açıldığı an. Chrome'a verilen ses bu anda başlar.
type TestWindow = Window & { micOpenedAt?: number }

interface Outcome {
  text: string
  problems: string[]
  /** Whisper'ın yanıtları, sayfa açıldıktan sonraki zamanlarıyla; başarısız olursa ne olduğu görülsün diye. */
  whisper: string[]
}

async function main() {
  if (process.platform !== 'darwin') {
    console.error("Uçtan uca test şimdilik yalnızca macOS'ta çalışır; Türkçe ses macOS'un say komutuyla üretilir.")
    process.exit(1)
  }
  if (!(await createWhisperClient(WHISPER_URL).isUp())) {
    console.error(`Whisper sunucusuna ulaşılamadı (${WHISPER_URL}). Önce "npm run whisper" çalıştırın.`)
    process.exit(1)
  }

  const dir = mkdtempSync(join(tmpdir(), 'nova-e2e-'))
  const server = await createServer({ logLevel: 'error', clearScreen: false })
  let failed = 0
  try {
    await server.listen()
    const url = server.resolvedUrls?.local[0]
    if (!url) throw new Error('Geliştirme sunucusu başlatılamadı.')

    for (const [index, scenario] of SCENARIOS.entries()) {
      const started = Date.now()
      let outcome: Outcome
      try {
        outcome = await run(scenario, synthesize(scenario, join(dir, String(index))), url)
      } catch (error) {
        outcome = { text: '', problems: [error instanceof Error ? error.message : String(error)], whisper: [] }
      }
      const passed = outcome.problems.length === 0 && comparable(outcome.text) === comparable(scenario.expected)
      if (!passed) failed++

      console.log(`${passed ? '✓' : '✗'} ${scenario.name} (${Math.round((Date.now() - started) / 1000)} sn)`)
      if (!passed) {
        console.log(`    beklenen: ${JSON.stringify(scenario.expected)}`)
        console.log(`    çıkan:    ${JSON.stringify(outcome.text)}`)
        for (const problem of outcome.problems) console.log(`    ${problem}`)
        if (outcome.whisper.length > 0) console.log(`    Whisper yanıtları:\n      ${outcome.whisper.join('\n      ')}`)
      }
    }
  } finally {
    await server.close()
    rmSync(dir, { recursive: true, force: true })
  }

  console.log(failed ? `${failed}/${SCENARIOS.length} senaryo başarısız.` : `${SCENARIOS.length} senaryonun hepsi geçti.`)
  process.exitCode = failed ? 1 : 0
}

/** Cümleleri Yelda sesiyle seslendirir, aralarına sessizlik koyar ve tek bir WAV dosyasına yazar. */
function synthesize(scenario: Scenario, name: string): { file: string; durationMs: number } {
  const silence = (ms: number) => new Float32Array((SAMPLE_RATE * ms) / 1000)
  const parts: Float32Array[] = [silence(LEADING_SILENCE_MS)]
  scenario.speech.forEach((sentence, i) => {
    if (i > 0) parts.push(silence(PAUSE_MS))
    const file = `${name}-${i}.wav`
    execFileSync('say', ['-v', 'Yelda', '--file-format=WAVE', `--data-format=LEI16@${SAMPLE_RATE}`, '-o', file, sentence])
    parts.push(decodeWav(readFileSync(file)).samples)
  })
  parts.push(silence(scenario.trailingSilenceMs))

  const samples = concatAudio(parts)
  const file = `${name}.wav`
  writeFileSync(file, new Uint8Array(encodeWav(samples, SAMPLE_RATE)))
  return { file, durationMs: (samples.length / SAMPLE_RATE) * 1000 }
}

/** Senaryoyu, mikrofonu verilen sesi çalan ayrı bir Chrome'da çalıştırır. */
async function run(scenario: Scenario, audio: { file: string; durationMs: number }, url: string): Promise<Outcome> {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${audio.file}%noloop`],
  })
  try {
    const context = await browser.newContext({ permissions: ['microphone'] })
    await context.addInitScript((draft) => {
      if (!location.origin.startsWith('http')) return
      localStorage.setItem('nova-dictation:setup-seen', '1')
      if (draft) localStorage.setItem('nova-dictation:draft', draft)
      const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await getUserMedia(constraints)
        ;(window as TestWindow).micOpenedAt = performance.now()
        return stream
      }
    }, scenario.draft ?? '')

    const page = await context.newPage()
    const problems: string[] = []
    const whisper: string[] = []
    const opened = Date.now()
    page.on('requestfinished', (request) => {
      if (!request.url().includes('/whisper/inference')) return
      const time = `${((Date.now() - opened) / 1000).toFixed(1)} sn`
      void request.response().then((response) => response?.text()).then(
        (body) => whisper.push(`${time}: ${body?.trim()}`),
        () => {},
      )
    })
    page.on('pageerror', (error) => problems.push(`Sayfa hatası: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`Konsol hatası: ${message.text()}`)
    })

    await page.goto(url)
    await page.getByText('Whisper hazır').waitFor()
    await scenario.before?.(page)
    await speak(page, scenario, audio.durationMs)
    try {
      await page.waitForFunction(() => {
        const mic = document.querySelector<HTMLButtonElement>('button[aria-label="Mikrofon"]')
        return mic?.getAttribute('aria-pressed') === 'false' && !mic.disabled
      }, undefined, { timeout: FINISH_TIMEOUT_MS })
    } catch {
      problems.push('Mikrofon kapandıktan sonra bekleyen ses zamanında yazıya çevrilmedi.')
    }
    for (const alert of await page.getByRole('alert').allInnerTexts()) problems.push(`Uyarı: ${alert}`)
    if (scenario.after) problems.push(...(await scenario.after(page)))
    return { text: await page.getByLabel('Metin').inputValue(), problems, whisper }
  } finally {
    await browser.close()
  }
}

/** Mikrofonu açar, Chrome'a verilen ses bitene kadar bekler ve mikrofonu kapatır. */
async function speak(page: Page, scenario: Scenario, durationMs: number) {
  const mic = page.getByRole('button', { name: 'Mikrofon', exact: true })
  if (scenario.control === 'mic-button') await mic.click()
  else await page.keyboard.down('Control')

  await page.waitForFunction(
    (ms) => {
      const opened = (window as TestWindow).micOpenedAt
      return opened !== undefined && performance.now() >= opened + ms
    },
    durationMs + SETTLE_MS,
    { timeout: durationMs + 15_000 },
  )

  if (scenario.control === 'command-key') await page.keyboard.up('Control')
  else if ((await mic.getAttribute('aria-pressed')) === 'true') await mic.click()
}

/**
 * Karşılaştırma için: küçük harf ve noktalamasız; paragraflar korunur. Whisper'ın
 * noktalama seçimi değişebildiği için noktalama burada değil, birim testlerinde denenir.
 */
function comparable(text: string): string {
  return toLowerTr(text)
    .split('\n')
    .map((line) => line.replace(/[^\p{L}\p{N}'’\s]/gu, ' ').split(/\s+/).filter(Boolean).join(' '))
    .join('\n')
    .trim()
}

await main()
