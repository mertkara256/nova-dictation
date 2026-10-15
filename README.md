# Nova Dictation

[![CI](https://github.com/mertkara256/nova-dictation/actions/workflows/ci.yml/badge.svg)](https://github.com/mertkara256/nova-dictation/actions/workflows/ci.yml)

Konuşarak metin oluşturmayı ve aynı konuşma sırasında verilen komutlarla metni düzenlemeyi sağlayan yapay zekâ destekli bir dikte uygulaması.

Kullanıcı düşüncelerini anlatırken “Nova, son cümleyi sil”, “Nova, buraya üç boş madde ekle” veya “Nova, seçili paragrafı kısalt” gibi talimatlar verebilir. Uygulama, yazılacak içerikle komutları ayırır ve istenen değişikliği metne uygular.

> Proje başlangıç aşamasındadır. Aşağıdaki özellikler planlanan kapsamı gösterir; henüz geliştirilmemiştir. “Nova” geçici çalışma adıdır.

## İlk sürüm

- Uygulamanın kendi web editöründe Türkçe dikte.
- Konuşmayı canlı metin olarak takip etme.
- “Nova” ifadesi veya bir tuş aracılığıyla komut verme.
- Son cümleyi silme ve boş liste maddeleri ekleme.
- Seçili metni kısaltma ve İngilizceye çevirme.
- AI ile yeniden yazılan metni uygulamadan önce önizleme.
- Yapılan düzenlemeleri geri alma ve taslakları kaydetme.

## İlk geliştirme hedefi

Konuş → metni editörde gör → “son cümleyi sil” komutunu uygula → işlemi geri al.

## İlk sürümün dışında

- İşletim sistemindeki diğer uygulamaların metin alanlarına müdahale.
- Mikrofon kapalıyken arka planda sürekli dinleyen bir uyandırma sistemi.
- Mobil uygulamalar, kullanıcı hesapları ve ödeme sistemi.

## Geliştirme

Gereksinim: Node.js 22.12 veya üstü.

```bash
npm install
npm run dev
```

Geliştirme sunucusu açıldıktan sonra uygulama http://localhost:5173 adresinde çalışır.

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusunu başlatır |
| `npm run whisper` | Yerel Whisper sunucusunu başlatır (bkz. [Whisper kurulumu](#whisper-kurulumu)) |
| `npm run nemotron` | Canlı önizleme için yerel Nemotron sunucusunu başlatır (bkz. [Nemotron kurulumu](#nemotron-kurulumu)) |
| `npm test` | Testleri bir kez çalıştırır |
| `npm run test:watch` | Testleri, değişiklikleri izleyerek çalıştırır |
| `npm run lint` | Oxlint ile kod denetimi yapar |
| `npm run typecheck` | TypeScript tip denetimi yapar |
| `npm run build` | Yayına hazır sürümü `dist/` klasörüne üretir |

Kod yapısı:

- `src/core`: Belge (metin ve imleç), metin işlemleri, komutların uygulanması ve geri alma geçmişi; arayüzden bağımsız, saf TypeScript.
- `src/commands`: Konuşulan metni komut ve metin parçalarına ayıran kalıplar ve hataya toleranslı eşleştirme.
- `src/speech`: Konuşma tanıma. Arayüz yalnızca `Transcriber` sözleşmesini bilir; servisler `providers/` altındadır, hangisinin kullanılacağına `index.ts` karar verir.
- `src/ui`: React bileşenleri.

## Sesli komutlar

Komutlar "Nova" ile başlar; mikrofon açıkken konuşmanın arasında söylenebilir. Komut metne yazılmaz, komuttan önce ve sonra söylenenler yazılmaya devam eder. Uygulamadaki **Bütün komutları gör** bağlantısı (ya da “Nova, komutları göster”) tam listeyi açar.

| Grup | Örnekler |
|---|---|
| Silme | “bunu sil” (son söylenen ya da seçili metin) · “son cümleyi sil” · “ikinci cümleyi sil” · “son üç kelimeyi sil” · “son paragrafı sil” · “yarın kelimesini sil” · “her şeyi sil” |
| Düzeltme ve biçim | “yarın yerine perşembe yaz” · “yeni satır” · “yeni paragraf” · “virgül” · “soru işareti” · “üç boş madde ekle” |
| Gezinme | “üçüncü satıra git” · “başa git” · “sona git” · “sonraki maddeye geç” · “toplantı kelimesinden sonra yaz” |
| Seçme | “son cümleyi seç” · “ilk paragrafı seç” · “yarın kelimesinden onda kelimesine kadar seç” · “seçimi kaldır” |
| Genel | “geri al” · “yinele” · “metni kopyala” · “dinlemeyi durdur” · “komutları göster” |

- Dikte imlecin olduğu yere yazılır; seçim varsa onun yerine. Mikrofon açıkken imlecin yeri metin alanında ince bir çizgiyle gösterilir.
- Her komuttan sonra altta ne yapıldığı ve bir **Geri al** (ya da **Yinele**) düğmesi görünür.
- Komutlar Whisper'ın kesin metnine göre uygulanır; konuşma tanımanın küçük yazım hataları (ör. “son cümle isi”, “No va”) tolere edilir.
- “Nova” ile başlayıp tanınmayan bir ifade metin olarak eklenir ve bu ekranda belirtilir.
- Yeni bir komut eklemek için `src/commands/grammar.ts` dosyasına bir kalıp, `src/core/apply.ts` dosyasına uygulaması ve `src/commands/help.ts` dosyasına açıklaması eklenir.

## Konuşma tanıma

Varsayılan kurulumda iki model birlikte çalışır; ikisi de ücretsizdir ve bilgisayarda çalışır, ses hiçbir yere gönderilmez:

| Model | Görevi | Nasıl görünür |
|---|---|---|
| **Nemotron 3.5 Streaming** (NVIDIA) | Canlı önizleme | Konuşurken kelimeler yaklaşık yarım saniye geriden, yazının devamında gri olarak akar |
| **Whisper large-v3-turbo** (OpenAI) | Kesin metin | Duraklayınca o bölüm noktalamasıyla birlikte gri yazının yerini alır |

Nemotron hızlı ama Türkçe'de daha çok hata yapıyor ve noktalamayı çoğunlukla atlıyor; Whisper daha yavaş ama daha doğru. Bu yüzden kesin metin her zaman Whisper'dan gelir.

- Nemotron sunucusu çalışmıyorsa canlı önizleme yerine "…" gösterilir; dikte Whisper ile devam eder.
- Whisper sunucusu çalışmıyorsa uygulama tarayıcının konuşma tanımasına (Web Speech) geçer ve bunu ekranda belirtir. Web Speech Türkçe'de noktalama koymaz ve sesi Google'a (Chrome) veya Apple'a (Safari) gönderir.

Servisi değiştirmek için proje klasöründe bir `.env.local` dosyası oluşturun:

```bash
VITE_STT_PROVIDER=webspeech   # veya whisper
```

Yeni bir servis eklemek için `src/speech/providers/` altına bir dosya yazmak ve onu `src/speech/index.ts` içinde seçmek yeterlidir. Her servis, `describeTranscriberContract` ile ortak sözleşme testlerinden geçer.

### Whisper kurulumu

Whisper, [whisper.cpp](https://github.com/ggml-org/whisper.cpp) ile bilgisayarda çalışır. Aşağıdaki adımlar Apple çipli bir Mac içindir. Homebrew paketinde sunucu bulunmadığı için kaynak kodundan derlenir:

```bash
brew install cmake
git clone --depth 1 --branch v1.9.5 https://github.com/ggml-org/whisper.cpp ~/Developer/whisper.cpp
cd ~/Developer/whisper.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_SERVER=ON
cmake --build build -j --config Release --target whisper-server
```

Modelleri indirin (yaklaşık 550 MB):

```bash
mkdir -p ~/Developer/whisper-models && cd ~/Developer/whisper-models
curl -LO https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
curl -LO https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin
```

Ardından iki ayrı terminalde:

```bash
npm run whisper
```

```bash
npm run dev
```

Klasörler farklıysa `WHISPER_DIR`, `WHISPER_MODELS_DIR` ve `WHISPER_MODEL` ortam değişkenleriyle değiştirilebilir.

### Nemotron kurulumu

Canlı önizleme, [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) ile çalışan [Nemotron 3.5 ASR Streaming](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b) modelini kullanır. Aşağıdaki adımlar Apple çipli bir Mac içindir (toplam yaklaşık 500 MB indirme):

```bash
cd ~/Developer
curl -LO https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-v1.13.8-osx-arm64-shared-no-tts.tar.bz2
tar xjf sherpa-onnx-v1.13.8-osx-arm64-shared-no-tts.tar.bz2

mkdir -p ~/Developer/sherpa-models && cd ~/Developer/sherpa-models
curl -LO https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11.tar.bz2
tar xjf sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11.tar.bz2
```

Ardından ayrı bir terminalde:

```bash
npm run nemotron
```

Klasörler farklıysa `SHERPA_DIR` ve `NEMOTRON_MODEL_DIR` ortam değişkenleriyle değiştirilebilir. sherpa-onnx sunucusu yalnızca bilgisayarın kendisine değil tüm ağ arayüzlerine açılır; macOS gelen bağlantılar için izin isterse reddedebilirsiniz, uygulama yine çalışır.

## Geliştirme durumu

Mikrofon düğmesiyle Türkçe dikte çalışıyor: konuşurken kelimeler canlı akıyor (Nemotron), duraklayınca noktalamalı kesin metin yerleşiyor (Whisper). Silme, düzeltme, gezinme, seçme ve genel sesli komutlar çalışıyor; yapay zekâ gerektiren komutlar (kısaltma, çeviri) henüz yok.

Bilinen sınırlar:

- Nemotron dili kendisi algıladığı için canlı önizleme ara sıra başka bir alfabeye (ör. Kiril) kayabiliyor; kesin metin Whisper'dan geldiği için sonuca etkisi yok.
- Tarayıcı konuşma tanımasına geçildiğinde metin noktalamasız geldiği için “son cümleyi sil” cümle sınırlarını bulamaz.
