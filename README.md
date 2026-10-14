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

- `src/core`: Belge modeli ve metin işlemleri; arayüzden bağımsız, saf TypeScript.
- `src/speech`: Konuşma tanıma. Arayüz yalnızca `Transcriber` sözleşmesini bilir; servisler `providers/` altındadır, hangisinin kullanılacağına `index.ts` karar verir.
- `src/ui`: React bileşenleri.

## Konuşma tanıma

İki servis vardır; ikisi de ücretsizdir:

| Servis | Noktalama | Ses nereye gider |
|---|---|---|
| **Whisper** (varsayılan) | Var | Hiçbir yere; bilgisayarda çalışır |
| **Web Speech** (tarayıcı) | Türkçe'de yok | Google (Chrome) veya Apple (Safari) |

Whisper sunucusu çalışmıyorsa uygulama otomatik olarak tarayıcının konuşma tanımasına geçer ve bunu ekranda belirtir.

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

Klasörler farklıysa `WHISPER_DIR`, `WHISPER_MODELS_DIR` ve `WHISPER_MODEL` ortam değişkenleriyle değiştirilebilir. Whisper kelime kelime canlı yazmaz; konuşmada duraklama olunca o bölümü noktalamasıyla birlikte ekler.

## Geliştirme durumu

Mikrofon düğmesiyle Türkçe dikte çalışıyor. Varsayılan olarak bilgisayarda çalışan Whisper kullanılıyor ve metin noktalamasıyla geliyor. Sıradaki adım, komut motoru (“son cümleyi sil” ve geri alma).
