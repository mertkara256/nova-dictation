# Measurement and testing

[Türkçe](olcum-ve-test.md) · **English**

Tools that measure speech recognition speed and accuracy and try the app with real speech. For all npm commands and the unit tests, see [Development](../README.en.md#development) in the README.

## Measurement recordings

How a change to speech recognition affects speed and accuracy is measured on dictations recorded with a real voice:

1. In the app started with `npm run dev`, turn on **Ayarlar → Ölçüm için kaydet** (Settings → Record for measurement). The option only appears during development and turns off when the page is reloaded.
2. Dictate with the microphone as usual; you can also give commands with “Nova” or ⌃ Control. When the microphone turns off, correct the text in the card that appears to what it should finally be, and press **Kaydet** (Save).
3. The audio is written to `nova-test-recordings/<date>-<name>.wav` in your home folder; the starting text, the command word, the moments ⌃ was pressed and the expected text go to a `.json` file with the same name. The folder is outside the project folder: it cannot be added to git, and it is not part of the iCloud or OneDrive Desktop and Documents sync either; recordings stay on your computer.
4. While the Whisper server is running, `npm run bench` plays all recordings in real time as if they came from the microphone, passes them through the app's Whisper pipeline and shows the results in a table. Single files can be given too: `npm run bench -- recording.wav` (`--timeline` also prints every state of the gray and final text). The custom words used while recording are saved with the recording; measuring with `--no-vocabulary` leaves them out so their effect can be compared. If the silence that ends a speech segment (700 ms in the app) is given as `--silence-ms 500,700,1000`, the recordings are measured once for each value; a shorter silence brings the final text sooner but can also split pauses in the middle of a sentence.

The tool prints its measurements in Turkish:

| Measurement | Meaning |
|---|---|
| güncelleme aralığı (update interval) | How often the gray text is refreshed |
| ilk gri kelime (first gray word) | Time from the start of speech until the first gray word appears |
| yanlış gri kelime (wrong gray words) | Share of gray words that do not match the final text that replaces them (weighted by time on screen) |
| değişen kelime / güncelleme (changed words per update) | Shown gray words that change in the next update; how much the gray text “flickers” |
| geride kalan kelime (words behind) | Number of words already spoken but not yet on screen |
| kesin metin gecikmesi (final text delay) | Time from the end of speech until the last final text arrives |
| parça (segments) | Number of speech segments sent to Whisper; more segments for the same recording means pauses were split |
| metin hatası (text error) | Share of wrong, missing or extra words in the resulting text compared with the expected text (only for recordings with an expected text) |
| noktalama ve büyük harf (punctuation and capitals) | Share of differences other than words: missing, extra or wrong punctuation, line breaks and capitalization. A sentence split at a pause (“Bugün toplantıda. Bütçeyi konuştuk.”) shows up here (only for recordings with an expected text) |

## End-to-end test

The unit tests try speech recognition with a fake service. `npm run test:e2e` instead tries the whole app in real Chrome as if someone were speaking into the microphone: Turkish sentences are spoken with macOS's Yelda voice, and that audio is given to Chrome in place of a microphone. This way the microphone, speech detection, Whisper, voice commands, the microphone button and the ⌃ Control key all run together.

- Requirements: macOS, Google Chrome and a running Whisper server (`npm run whisper` or `npm start`). Chrome opens with an empty temporary profile and does not touch your browser data.
- Covered (12 scenarios):
  - dictation and a “Nova” command; after a lone “Nova” and a pause, the command is expected in the next words
  - turning the microphone off right after speaking without losing the last words
  - one command and two commands in a row while ⌃ is held
  - undo by voice, and the **Geri al** (Undo) button in the note shown after a command
  - a command said without “Nova”, applied with the **Komut olarak uygula** (Apply as command) button in the note
  - dictating over a word selected by voice
  - nothing spoken after “dinlemeyi durdur” (stop listening) is written; nothing spoken after “duraklat” (pause) is written until “devam et” (resume)
  - dictating in a new note while the previous note stays as it was
- Punctuation is not compared; Whisper's choice can vary, and the punctuation rules are covered by unit tests. If a scenario fails, Whisper's responses are printed along with the expected and actual text.
- It does not run in the GitHub checks because it needs the Whisper model and Turkish speech; run it by hand after changes to speech recognition. A run takes about two minutes.

## Speech scan

`npm run scan:speech` speaks the cases in `scripts/speech-cases.ts` with macOS's Yelda voice and has Whisper write them. Whisper's text is passed through the app's editor, and the resulting text is compared with the expected one. This tries how Whisper writes a phrase and what the app does with it, together.

| Category | Covers |
|---|---|
| `komut` | Every phrase of the Commands panel, with “Nova” and as if said while ⌃ is held; is it understood as the same command |
| `sonuc` | The result of a command given on a text (“son cümleyi sil” — delete the last sentence, “yarın yerine perşembe yaz” — write Thursday instead of tomorrow…) |
| `zincir` | Commands in a row (“son cümleyi sil ve yeni satır” — delete the last sentence and new line) |
| `ara` | Commands said in the middle of dictation |
| `dikte` | Dictation with numbers, times, proper names and suffixes after an apostrophe |
| `degil` | Sentences that must not be taken as commands (“Parayı geri aldım.” — I got the money back, “Nova adlı bir uygulama kullanıyorum.” — I use an app called Nova) |

- For cases spoken while ⌃ is held, Whisper is given the command list as a hint, as in the app.
- For dictated sentences (`ara`, `dikte`), letter case and punctuation are not compared; for command results only letter case is ignored. The `degil` category only checks whether a command was applied. A case can list more than one correct form (“saat üçte” or “saat 3'te”).
- `npm test` also checks that each case gives the expected result when the phrase itself is written; that part also runs in the GitHub checks.
- The voice has four variants: `normal`, `hızlı` (fast), `yavaş` (slow) and `gürültülü` (noisy, a light hiss in the background). The default is `normal` only. Categories and variants can be chosen:

```bash
npm run scan:speech -- --category komut,sonuc
npm run scan:speech -- --variant normal,hızlı,yavaş,gürültülü
```

- Results are compared with the saved results in `scripts/speech-scan-results.json`. Cases with a wrong result are marked “✗”, newly broken ones “(YENİ)” and fixed ones “(düzeldi)”; if anything newly broke, the exit code is 1. `--save` writes the results to that file; save them once the result of a change is accepted. Results are written as each category finishes, so if the scan stops halfway, the finished categories are not lost. If a request to Whisper drops, it is retried at once and, if that fails too, again two seconds later. The saved results were made on macOS with the large-v3-turbo model; with another model or computer the results may differ.
- Run it before and after changes to speech recognition, the command patterns or how commands are applied. All categories take about 8 minutes with one variant and about 30 minutes with all four.
- The Yelda voice differs from a real voice; for example, Whisper often writes its “sil” as “si” or “C”. The scan shows whether a change broke something that used to work; real accuracy is shown by `npm run bench` with your own recordings. Requirements: macOS and a running Whisper server.
