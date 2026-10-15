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

Varsayılan olarak bilgisayarda çalışan **Whisper large-v3-turbo** (OpenAI) kullanılır. Ücretsizdir ve ses hiçbir yere gönderilmez.

- **Konuşurken:** O ana kadarki ses yaklaşık saniyede bir Whisper'a gönderilir; sonuç yazının devamında gri olarak görünür. Kelimeler tek tek değil, konuşmanın yaklaşık bir-iki saniye gerisinden gruplar halinde gelir.
- **Duraklayınca:** O bölüm Whisper'a bir kez daha gönderilir ve noktalamalı kesin metin gri yazının yerini alır. Komutlar bu kesin metne göre uygulanır.
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

## Geliştirme durumu

Mikrofon düğmesiyle Türkçe dikte çalışıyor: konuşurken metin yaklaşık saniyede bir önizleme olarak güncelleniyor, duraklayınca noktalamalı kesin metin yerleşiyor (ikisi de Whisper). Silme, düzeltme, gezinme, seçme ve genel sesli komutlar çalışıyor; yapay zekâ gerektiren komutlar (kısaltma, çeviri) henüz yok.

Bilinen sınırlar:

- Önizleme ve kesin metin aynı Whisper sunucusunu kullandığı için, o an bir önizleme isteği işleniyorsa kesin metin en fazla bir saniye kadar gecikebilir.
- Tarayıcı konuşma tanımasına geçildiğinde metin noktalamasız geldiği için “son cümleyi sil” cümle sınırlarını bulamaz.
