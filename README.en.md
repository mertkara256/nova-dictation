# Nova Dictation

[Türkçe](README.md) · **English**

[![CI](https://github.com/mertkara256/nova-dictation/actions/workflows/ci.yml/badge.svg)](https://github.com/mertkara256/nova-dictation/actions/workflows/ci.yml)

An AI-assisted dictation app that turns speech into text and lets you edit that text with commands spoken in the same breath.

While talking through their thoughts, the user can give instructions such as “Nova, son cümleyi sil” (delete the last sentence), “Nova, buraya üç boş madde ekle” (add three empty bullets here) or “Nova, seçili paragrafı kısalt” (shorten the selected paragraph). The app separates the text to be written from the commands and applies the requested change.

The app is built for Turkish: dictation, voice commands and the interface are in Turkish.

> The project is under development. Dictation, voice commands and the editing tools work; commands that need AI (shortening, translation and their previews) are not there yet. See [Development status](#development-status) for details. “Nova” is a temporary working name.

## Goals of the first version

- Turkish dictation in the app's own web editor.
- Following the speech as live text.
- Giving commands with the word “Nova” or with a key.
- Deleting the last sentence and adding empty list items.
- Shortening the selected text and translating it into English.
- Previewing AI-rewritten text before applying it.
- Undoing edits and saving drafts.

## First development milestone

Speak → see the text in the editor → apply the “son cümleyi sil” (delete the last sentence) command → undo it.

## Out of scope for the first version

- Writing into text fields of other apps on the operating system.
- An always-listening wake word while the microphone is off.
- Mobile apps, user accounts and payments.

## Development

Requirement: Node.js 22.12 or later. Runs on macOS and Windows.

```bash
npm install
npm start
```

`npm start` starts the Whisper server (if it is not already running) together with the development server and opens the app in the browser (http://localhost:5173). Closing the window or pressing Ctrl+C stops both. If the app is already running, it starts no second server and shows the open one. If another app is using port 5173, it does not start: the browser stores notes per address, so moving to another port would make the notes look lost. To put a one-click launcher on the desktop, run `npm run shortcut` once.

| Command | What it does |
|---|---|
| `npm start` | Starts Whisper and the development server together and opens the app in the browser |
| `npm run shortcut` | Puts a launcher for the app on the desktop (`.command` on macOS, `.cmd` on Windows) |
| `npm run dev` | Starts only the development server |
| `npm run whisper` | Starts the local Whisper server (see [Whisper setup](#whisper-setup)) |
| `npm run bench` | Measures speech recognition speed and accuracy with audio recordings (while Whisper is running; see [Measurement recordings](#measurement-recordings)) |
| `npm test` | Runs the tests once |
| `npm run test:watch` | Runs the tests and reruns them on changes |
| `npm run test:e2e` | Tries the whole app in real Chrome as if someone were speaking into the microphone (on macOS, while Whisper is running; see [End-to-end test](#end-to-end-test)) |
| `npm run scan:speech` | Has Whisper write commands and dictated sentences spoken in the Yelda voice and checks that the app reaches the right result (on macOS, while Whisper is running; see [Speech scan](#speech-scan)) |
| `npm run lint` | Lints the code with Oxlint |
| `npm run typecheck` | Runs the TypeScript type check |
| `npm run build` | Builds the production version into `dist/` |

Code layout:

- `src/core`: The document (text and caret), text operations, applying commands and the undo history; plain TypeScript, independent of the UI.
- `src/commands`: The patterns that split spoken text into commands and text, and the typo-tolerant matching.
- `src/speech`: Speech recognition. The UI only knows the `Transcriber` contract; services live under `providers/`, and `index.ts` decides which one is used.
- `src/ui`: React components.
- `scripts`: The script that starts the Whisper server, the measurement tool, the end-to-end test, the speech scan, and the development server plugin that writes measurement recordings to disk.
- Tests: `*.test.ts` files are logic tests and run directly in Node. `*.test.tsx` files are UI tests; they render components in a simulated browser page (jsdom) and click and type like a user. Shared test helpers live in `src/test`.

## Voice commands

Commands start with a command word. The default word is “Nova”, and it can be changed with the **Ayarlar** (Settings) button at the top right. Commands can be said in the middle of speaking while the microphone is on. A command is not written into the text; what is said before and after it keeps being written. The **Komutlar** (Commands) button under the text, or “Nova, komutları göster”, opens the full list. The box at the top of the list searches it, ignoring case and Turkish letters (typing “sec” also finds “seç”). In the search box, Esc clears the search first.

Commands are spoken in Turkish. Some examples, with their meaning:

| Group | Examples |
|---|---|
| Deleting | “bunu sil” (delete this: the last dictated part or the selection) · “son cümleyi sil” (the last sentence) · “ikinci cümleyi sil” (the second sentence) · “son üç kelimeyi sil” (the last three words) · “son paragrafı sil” (the last paragraph) · “son satırı sil” (the last line) · “yarın kelimesini sil” (the word “yarın”) · “her şeyi sil” (everything) |
| Correcting and formatting | “yarın yerine perşembe yaz” (write “perşembe” instead of “yarın”) · “yeni satır” (new line) · “yeni paragraf” (new paragraph) · “virgül” (comma) · “soru işareti” (question mark) · “tırnak aç” (open quote) · “parantez kapat” (close parenthesis) · “kısa çizgi” (hyphen) · “yarın kelimesini tırnak içine al” (put “yarın” in quotes) · “ankara kelimesini büyük harfle yaz” (capitalize “ankara”) · “bunu küçük harfle yaz” (lowercase this) · “üç boş madde ekle” (add three empty bullets) |
| Moving | “üçüncü satıra git” (go to the third line) · “ikinci paragrafa git” (go to the second paragraph) · “cümlenin başına git” (go to the start of the sentence) · “başa git” (go to the start) · “sona git” (go to the end) · “sonraki maddeye geç” (next bullet) · “toplantı kelimesinden sonra yaz” (write after the word “toplantı”) |
| Selecting | “son cümleyi seç” (the last sentence) · “ilk paragrafı seç” (the first paragraph) · “yarın kelimesini seç” (the word “yarın”) · “son üç kelimeyi seç” (the last three words) · “bunu seç” (this) · “her şeyi seç” (everything) · “yarın kelimesinden onda kelimesine kadar seç” (from “yarın” to “onda”) · “seçimi kaldır” (clear the selection) |
| General | “geri al” (undo) · “üç kere geri al” (undo three times) · “yinele” (redo) · “kopyala” (copy the selection, or all text if nothing is selected) · “metni kopyala” (copy all text) · “dinlemeyi durdur” (stop listening) · “komutları göster” (show the commands) |

- Dictation is written at the caret, or in place of the selection if there is one. While the microphone is on, the caret position is shown as a thin line in the text area.
- Commands given with “bunu” (this), such as delete, select, capitalize or put in quotes, apply to the selection, or to the last dictated part if nothing is selected. Commands given with a word apply to the last place that word appears in the text, together with a suffix attached with an apostrophe (“ayşe hanım kelimelerini sil” deletes all of “Ayşe Hanım'a”); only “X yerine Y yaz” (write Y instead of X) leaves the suffix in place. When a word is deleted, the comma that separates it in a list goes too (deleting “armut” from “Elma, armut, muz.” leaves “Elma, muz.”); if the first word of a sentence is deleted, the next word starts with a capital letter.
- After each command, a note at the bottom of the screen says what was done and offers an **Geri al** (Undo) or **Yinele** (Redo) button.
- What is said in one go, without a pause, counts as one change; a later “geri al” (undo) undoes all of it together. A “geri al” said within the same words undoes only the last change before it (“son cümleyi sil, son cümleyi sil ve geri al” — delete the last sentence twice, then undo — undoes only the second deletion).
- Commands can also be given without saying “Nova”: while **⌃ Control** is held down, what you say is not written into the text but applied as a command (for example, “son cümleyi sil” while holding ⌃). Command mode starts once the key has been held on its own for about a quarter of a second, so shortcuts like ⌃C are not affected. If the microphone is off, it turns on for as long as the key is held. Several commands can be said in a row (“son cümleyi sil ve yeni satır”, delete the last sentence and new line); a command that is not understood is not added to the text, only reported. This feature works while the Whisper server is running; if Whisper cannot be reached while ⌃ is held, the app does not switch to browser recognition, so nothing said is written into the text. While ⌃ is held, Whisper is given the command list as a hint; in the speech scan this made commands come out right more often, mostly when spoken fast.
- You can say “Nova” and pause: after the command word on its own, the app waits for a command and shows this under the text. If what follows is not a command, both are written as text.
- Commands can be chained with “ve” (and): “Nova, son cümleyi sil ve yeni satır” (delete the last sentence and new line).
- Commands are applied to Whisper's final text; small speech recognition typos (for example “son cümle isi”, “No va”) are tolerated. When Whisper writes “geri al” (undo) in the past tense (“geri aldı”, “üç kere geri aldım”), it still counts as undo. The negative of a command does not count as one: “Nova, her şeyi silme” (don't delete everything) does not delete the text; it is written into it.
- A phrase that starts with the command word but is not recognized is added as text, and the screen says so.
- To add a new command, add a pattern to `src/commands/grammar.ts`, its implementation to `src/core/apply.ts` and its description to `src/commands/help.ts`.

## Workspace

- **Getting started:** On the first visit without an existing draft or recovery copy, a guide opens automatically. Reopen it through **Ayarlar → İlk kullanım rehberi** (Settings → Getting started). It shows service/model readiness and links to setup instructions. **Mikrofonu dene** (Test microphone) requests permission only after a click, checks the audio level for five seconds, and neither records nor transmits audio. It closes the microphone when the check ends or the panel closes. Three example command buttons demonstrate deleting, undoing and adding a paragraph in a separate sample text, leaving the draft untouched. Regular dictation is disabled while the guide is open, and a note under the editor says so.
- **Notes:** The **Notlar** (Notes) panel in the toolbar lists the notes in this browser, most recently changed first; clicking a note opens it. **Yeni not** (New note) opens an empty note, unless the open note is already empty. An empty note that was never written in leaves the list when you switch to another note. Deleting a note asks for confirmation. Each note keeps its own undo history for the session: after coming back from another note, undo still works in that note, and it never carries changes over from one note to another. The single draft from before notes becomes the first note on first launch. Notes cannot be switched while the microphone is on or pending audio is being transcribed; what was said so far goes into the open note. If the app is open in more than one tab, each tab writes to its own open note; a note deleted in one tab comes back if it is still open in another tab and something is written in it.
- **Draft saving:** The open note is kept in the browser as you write; after a reload or reopening, you continue where you left off. If all text was deleted before a reload, the app opens empty and offers to bring the last deleted text back with **Geri getir** (Restore).
- **Save status:** Nothing is shown while saving works. If the draft cannot be saved (e.g. browser storage is blocked or full), a warning appears below the editor with **Kaydetmeyi yeniden dene** (Retry saving) and **Metni indir** (Download text); it stays until a save succeeds. If a recovery copy cannot be saved when clearing text, the last saved draft is preserved.
- **Command word:** In the **Ayarlar** (Settings) panel, “Nova” can be replaced with another word that is easy to say (for example a name). The word must be a single word of at least 3 letters and is stored in the browser. The command is recognized even if speech recognition splits the word into syllables (“No va”). For words of 5 or more letters, a one-letter typo is also tolerated (for example “Carvis” instead of “Jarvis”), as long as a recognized command follows it. Suffixed forms of the word (“Asistana”) do not count as the command word.
- **Custom words:** In the **Ayarlar** (Settings) panel, frequently used names and terms (for example “Ayşe Hanım, Kubernetes”) can be listed, separated by commas or one per line, up to 50. They are sent to Whisper as a hint with each final-text request, which makes it more likely to use these spellings. Whisper sometimes takes a hinted word for a proper noun and splits its ending off with an apostrophe (“Grafana” → “Grafan'a”); such splits are joined back.
- **Service status:** The badge next to the title shows speech recognition readiness (green: ready, yellow: offline or loading the model). Whisper's `/health` response confirms model readiness; dictation cannot start while the model is loading. The getting-started guide offers a manual recheck. While Whisper is off, hovering over the badge shows how to start it.
- **Toolbar:** Under the text are the word count and the **Kopyala** (Copy), **İndir** (Download, as plain text or Markdown) and **Temizle** (Clear) buttons. Clearing can be undone too.
- **Command history:** The **Geçmiş** (History) panel lists the commands given in this session, by voice or by button, with their time and result; commands that could not be carried out are shown in red.
- **Panels:** On wide screens (at least 1024 pixels), the Notes, Commands, History and Settings panels and the getting-started guide open to the right of the text, so the text stays in view while you read the commands; a long list scrolls inside the panel. On narrower screens and phones they open below the text.

| Shortcut | What it does |
|---|---|
| ⌥ Space (Alt + M on Windows and Linux) | Turns the microphone on or off |
| Hold ⌃ Control (Ctrl on Windows and Linux) | Applies what you say while holding it as a command, without “Nova”; turns the microphone on for that time if it is off |
| Esc | Stops listening; if the microphone is off, closes the open panel |

## Speech recognition

By default, **Whisper large-v3-turbo** (OpenAI) runs on your computer. It is free, and no audio is sent anywhere.

- **While speaking:** The audio so far is sent to Whisper about once a second, and the result appears in gray after the text. Words arrive in groups, about one or two seconds behind the speech, rather than one by one. Because the audio is cut mid-word when it is sent, the last word is often incomplete; it is therefore hidden and arrives in full with the next update.
- **When you pause:** That part is sent to Whisper once more, and the final text with punctuation replaces the gray text. Commands are applied to this final text.
- If the Whisper server is not running, the app switches to the browser's speech recognition (Web Speech) and says so on screen. Web Speech adds no punctuation in Turkish and sends the audio to Google (Chrome) or Apple (Safari).
- A transcription request is cancelled if it does not complete within 30 seconds. A transient connection failure is retried once automatically; a timeout is not. If final transcription fails, the microphone closes and unprocessed audio stays in this tab's memory. **Yeniden dene** (Retry) processes these parts in order without reopening the microphone or repeating text already inserted. Pending text and commands apply at the cursor/selection in effect when retried. This failure does not automatically switch to browser recognition.
- Stopping the microphone normally finishes the last spoken words. “Nova, dinlemeyi durdur” (stop listening) instead discards audio that was spoken after the command and not yet transcribed. While processing a normal stop, **Bekleyen sesten vazgeç** (Discard pending audio) cancels the request and discards unprocessed audio; it is also available after a failure. Existing text is preserved. Pending audio is not saved to disk and is lost when the page closes. Requests for finished or discarded previews are also cancelled.

To change the service, create a `.env.local` file in the project folder:

```bash
VITE_STT_PROVIDER=webspeech   # or whisper
```

To add a new service, write a file under `src/speech/providers/` and select it in `src/speech/index.ts`. Every service has to pass the shared contract tests in `describeTranscriberContract`.

### Whisper setup

Whisper runs on your computer through [whisper.cpp](https://github.com/ggml-org/whisper.cpp) and is built from source. The program is expected in `~/Developer/whisper.cpp` and the models in `~/Developer/whisper-models` (`%USERPROFILE%\Developer\...` on Windows).

#### macOS (Apple silicon)

The Homebrew package has no server, so it is built from source:

```bash
brew install cmake
git clone --depth 1 --branch v1.9.5 https://github.com/ggml-org/whisper.cpp ~/Developer/whisper.cpp
cd ~/Developer/whisper.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_SERVER=ON
cmake --build build -j --config Release --target whisper-server
```

Download the models (about 550 MB):

```bash
mkdir -p ~/Developer/whisper-models && cd ~/Developer/whisper-models
curl -LO https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
curl -LO https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin
```

#### Windows

> These steps have not been tried on a Windows computer yet. The tests and the build, however, run on Windows on GitHub for every change.

Install the required tools in PowerShell (the Visual Studio build tools take a while to install):

```powershell
winget install Git.Git
winget install Kitware.CMake
winget install OpenJS.NodeJS.LTS
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Open a new PowerShell window and build:

```powershell
git clone --depth 1 --branch v1.9.5 https://github.com/ggml-org/whisper.cpp "$HOME\Developer\whisper.cpp"
cd "$HOME\Developer\whisper.cpp"
cmake -B build -DWHISPER_BUILD_SERVER=ON
cmake --build build -j --config Release --target whisper-server
```

Download the models (about 550 MB):

```powershell
mkdir "$HOME\Developer\whisper-models"
cd "$HOME\Developer\whisper-models"
curl.exe -LO https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
curl.exe -LO https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin
```

With an NVIDIA graphics card, adding `-DGGML_CUDA=ON` to the first `cmake` command (the CUDA Toolkit must be installed) makes Whisper run much faster on the GPU. Without one, it runs on the CPU and the preview may lag; in that case a smaller model can be tried: download `ggml-small-q5_1.bin` from the same address and run `setx WHISPER_MODEL ggml-small-q5_1.bin`.

#### Running

In the project folder, `npm start` starts Whisper and the app together. To start them separately, use `npm run whisper` and `npm run dev` in two terminals.

If the folders are different, they can be changed with the `WHISPER_DIR`, `WHISPER_MODELS_DIR` and `WHISPER_MODEL` environment variables; if the server program is somewhere else, give its full path with `WHISPER_SERVER`.

## Measurement recordings

How a change to speech recognition affects speed and accuracy is measured on dictations recorded with a real voice:

1. In the app started with `npm run dev`, turn on **Ayarlar → Ölçüm için kaydet** (Settings → Record for measurement). The option only appears during development and turns off when the page is reloaded.
2. Dictate with the microphone as usual; you can also give commands with “Nova” or ⌃ Control. When the microphone turns off, correct the text in the card that appears to what it should finally be, and press **Kaydet** (Save).
3. The audio is written to `test-recordings/<date>-<name>.wav`; the starting text, the command word, the moments ⌃ was pressed and the expected text go to a `.json` file with the same name. The folder is not added to git; recordings stay on your computer.
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
- Covered (10 scenarios):
  - dictation and a “Nova” command; after a lone “Nova” and a pause, the command is expected in the next words
  - turning the microphone off right after speaking without losing the last words
  - one command and two commands in a row while ⌃ is held
  - undo by voice, and the **Geri al** (Undo) button in the note shown after a command
  - dictating over a word selected by voice
  - nothing spoken after “dinlemeyi durdur” (stop listening) is written
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

- Results are compared with the saved results in `scripts/speech-scan-results.json`. Cases with a wrong result are marked “✗”, newly broken ones “(YENİ)” and fixed ones “(düzeldi)”; if anything newly broke, the exit code is 1. `--save` writes the results to that file; save them once the result of a change is accepted. The saved results were made on macOS with the large-v3-turbo model; with another model or computer the results may differ.
- Run it before and after changes to speech recognition, the command patterns or how commands are applied. All categories take about 8 minutes with one variant and about 30 minutes with all four.
- The Yelda voice differs from a real voice; for example, Whisper often writes its “sil” as “si” or “C”. The scan shows whether a change broke something that used to work; real accuracy is shown by `npm run bench` with your own recordings. Requirements: macOS and a running Whisper server.

## Development status

Turkish dictation works: while you speak, the text updates as a gray preview about once a second, and when you pause, the final text with punctuation settles in (both from Whisper). Deleting, correcting, moving, selecting and general voice commands work with “Nova” or while ⌃ Control is held; the command word can be changed in Settings. Several notes can be kept and are saved automatically; the text can be downloaded and the command history can be viewed. Speed and accuracy can be measured with recorded real dictations (`npm run bench`), and the app can be tried end to end with real Chrome and Whisper (`npm run test:e2e`). It runs on macOS; Windows support has been added but not yet tried on a Windows computer. Commands that need AI (shortening, translation) are not there yet. Upcoming work and later ideas are in [YOL_HARITASI.md](YOL_HARITASI.md) (roadmap, in Turkish).

Known limitations:

- The preview and the final text use the same Whisper server, so if a preview request is being processed, the final text can be delayed by up to about a second.
- After switching to the browser's speech recognition, the text arrives without punctuation, so “son cümleyi sil” (delete the last sentence) cannot find sentence boundaries.
- When giving commands with ⌃, command mode starts once the key has been held for a quarter of a second; if you start speaking the moment you press the key during dictation, the first syllable may slip into the text.
