# Nova Dictation

**Türkçe** · [English](README.en.md)

[![CI](https://github.com/mertkara256/nova-dictation/actions/workflows/ci.yml/badge.svg)](https://github.com/mertkara256/nova-dictation/actions/workflows/ci.yml)

Konuşarak metin oluşturmayı ve aynı konuşma sırasında verilen komutlarla metni düzenlemeyi sağlayan yapay zekâ destekli bir dikte uygulaması.

Kullanıcı düşüncelerini anlatırken “Nova, son cümleyi sil”, “Nova, buraya üç boş madde ekle” veya “Nova, seçili paragrafı kısalt” gibi talimatlar verebilir. Uygulama, yazılacak içerikle komutları ayırır ve istenen değişikliği metne uygular.

> Proje geliştirme aşamasındadır. Dikte, sesli komutlar ve düzenleme araçları çalışıyor; yapay zekâ gerektiren komutlar (kısaltma, çeviri ve önizlemeleri) henüz yok. Ayrıntılar için [Geliştirme durumu](#geliştirme-durumu) bölümüne bakın. “Nova” geçici çalışma adıdır.

## İlk sürümün hedefleri

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

Gereksinim: Node.js 22.12 veya üstü. macOS ve Windows'ta çalışır.

```bash
npm install
npm start
```

`npm start` Whisper sunucusunu (çalışmıyorsa) ve geliştirme sunucusunu birlikte başlatır, uygulamayı tarayıcıda açar (http://localhost:5173). Pencere kapanınca ya da Ctrl+C'ye basılınca ikisi de kapanır. Masaüstüne tek tıkla açan bir kısayol koymak için bir kez `npm run shortcut` çalıştırın.

| Komut | Açıklama |
|---|---|
| `npm start` | Whisper'ı ve geliştirme sunucusunu birlikte başlatır, uygulamayı tarayıcıda açar |
| `npm run shortcut` | Masaüstüne uygulamayı başlatan bir kısayol koyar (macOS'ta `.command`, Windows'ta `.cmd`) |
| `npm run dev` | Yalnızca geliştirme sunucusunu başlatır |
| `npm run whisper` | Yerel Whisper sunucusunu başlatır (bkz. [Whisper kurulumu](#whisper-kurulumu)) |
| `npm run bench` | Konuşma tanımanın hızını ve doğruluğunu ses kayıtlarıyla ölçer (Whisper açıkken; bkz. [Ölçüm kayıtları](#ölçüm-kayıtları)) |
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
- `scripts`: Whisper sunucusunu başlatan betik, ölçüm aracı ve ölçüm kayıtlarını diske yazan geliştirme sunucusu eklentisi.
- Testler: `*.test.ts` dosyaları mantık testleridir ve doğrudan Node'da çalışır. `*.test.tsx` dosyaları arayüz testleridir; bileşenleri sahte bir tarayıcı sayfasında (jsdom) çizip kullanıcı gibi tıklar ve yazar. Ortak test yardımcıları `src/test` altındadır.

## Sesli komutlar

Komutlar bir komut kelimesiyle başlar; varsayılan kelime "Nova"dır ve sağ üstteki **Ayarlar** düğmesinden değiştirilebilir. Komutlar mikrofon açıkken konuşmanın arasında söylenebilir. Komut metne yazılmaz, komuttan önce ve sonra söylenenler yazılmaya devam eder. Metnin altındaki **Komutlar** düğmesi (ya da “Nova, komutları göster”) tam listeyi açar.

| Grup | Örnekler |
|---|---|
| Silme | “bunu sil” (son söylenen ya da seçili metin) · “son cümleyi sil” · “ikinci cümleyi sil” · “son üç kelimeyi sil” · “son paragrafı sil” · “son satırı sil” · “yarın kelimesini sil” · “her şeyi sil” |
| Düzeltme ve biçim | “yarın yerine perşembe yaz” · “yeni satır” · “yeni paragraf” · “virgül” · “soru işareti” · “tırnak aç” · “parantez kapat” · “kısa çizgi” · “yarın kelimesini tırnak içine al” · “ankara kelimesini büyük harfle yaz” · “bunu küçük harfle yaz” · “üç boş madde ekle” |
| Gezinme | “üçüncü satıra git” · “ikinci paragrafa git” · “cümlenin başına git” · “başa git” · “sona git” · “sonraki maddeye geç” · “toplantı kelimesinden sonra yaz” |
| Seçme | “son cümleyi seç” · “ilk paragrafı seç” · “yarın kelimesini seç” · “son üç kelimeyi seç” · “bunu seç” · “her şeyi seç” · “yarın kelimesinden onda kelimesine kadar seç” · “seçimi kaldır” |
| Genel | “geri al” · “üç kere geri al” · “yinele” · “kopyala” (seçili metin ya da bütün metin) · “metni kopyala” · “dinlemeyi durdur” · “komutları göster” |

- Dikte imlecin olduğu yere yazılır; seçim varsa onun yerine. Mikrofon açıkken imlecin yeri metin alanında ince bir çizgiyle gösterilir.
- “Bunu” ile verilen komutlar (sil, seç, büyük harfle yaz, tırnak içine al…) seçili metne, seçim yoksa son söylenene uygulanır. Bir kelimeyle verilenler o kelimenin metinde son geçtiği yere uygulanır.
- Her komuttan sonra altta ne yapıldığı ve bir **Geri al** (ya da **Yinele**) düğmesi görünür.
- Komutlar “Nova” demeden de verilebilir: **⌃ Control** basılı tutulurken söylenenler metne yazılmaz, komut olarak uygulanır (ör. ⌃ basılıyken “son cümleyi sil”). Komut modu tuş çeyrek saniye kadar tek başına basılı kalınca başlar; ⌃C gibi kısayollar etkilenmez. Mikrofon kapalıysa tuş basılı kaldığı süre için açılır. Art arda birden fazla komut söylenebilir (“son cümleyi sil ve yeni satır”); anlaşılamayan komut metne eklenmez, yalnızca bildirilir. Bu özellik Whisper sunucusu açıkken çalışır.
- Komutlar Whisper'ın kesin metnine göre uygulanır; konuşma tanımanın küçük yazım hataları (ör. “son cümle isi”, “No va”) tolere edilir.
- Komut kelimesiyle başlayıp tanınmayan bir ifade metin olarak eklenir ve bu ekranda belirtilir.
- Yeni bir komut eklemek için `src/commands/grammar.ts` dosyasına bir kalıp, `src/core/apply.ts` dosyasına uygulaması ve `src/commands/help.ts` dosyasına açıklaması eklenir.

## Çalışma alanı

- **Taslak kaydı:** Metin yazıldıkça tarayıcıda saklanır; sayfa yenilense ya da kapanıp açılsa da kaldığı yerden devam edilir.
- **Komut kelimesi:** **Ayarlar** panelinden “Nova” yerine kolay söylenen başka bir kelime (ör. bir isim) seçilebilir. Kelime en az 3 harfli, tek kelime olmalı ve tarayıcıda saklanır. Konuşma tanıma kelimeyi hecelerine bölse de (“No va”) komut tanınır. 5 harf ve üstündeki kelimelerde bir harflik yazım farkı da tolere edilir (ör. “Jarvis” yerine “Carvis”); bunun için arkasından tanınan bir komut gelmesi gerekir. Kelimenin ekli halleri (“Asistana”) komut sayılmaz.
- **Özel kelimeler:** **Ayarlar** panelinde sık kullanılan isim ve terimler (ör. “Ayşe Hanım, Kubernetes”) virgülle ya da alt alta yazılır, en fazla 50 tane. Whisper'a kesin metin isteklerinde ipucu olarak gönderilir ve bu yazımları seçmeye yatkın olur. Whisper ipucundaki kelimeleri bazen özel isim sanıp sonunu kesme işaretiyle ayırdığı için (“Grafana” → “Grafan'a”) bu tür bölünmeler geri birleştirilir.
- **Servis durumu:** Başlığın yanındaki rozet konuşma tanıma servisinin açık olup olmadığını gösterir (yeşil: hazır, sarı: kapalı). Whisper kapalıyken rozetin üzerine gelince nasıl başlatılacağı yazar.
- **Araç satırı:** Metnin altında kelime sayısı ile **Kopyala**, **İndir** (düz metin ya da Markdown) ve **Temizle** düğmeleri bulunur. Temizle de geri alınabilir.
- **Komut geçmişi:** **Geçmiş** paneli bu oturumda sesle ya da düğmeyle verilen komutları saatiyle ve sonucuyla listeler; yapılamayan komutlar kırmızıyla gösterilir.

| Kısayol | İşlev |
|---|---|
| ⌥ Boşluk (Windows ve Linux'ta Alt + M) | Mikrofonu açar ya da kapatır |
| ⌃ Control basılı (Windows ve Linux'ta Ctrl) | Basılıyken söylenenleri “Nova” demeden komut olarak uygular; mikrofon kapalıysa o süre için açar |
| Esc | Dinlemeyi durdurur; mikrofon kapalıysa açık paneli kapatır |

## Konuşma tanıma

Varsayılan olarak bilgisayarda çalışan **Whisper large-v3-turbo** (OpenAI) kullanılır. Ücretsizdir ve ses hiçbir yere gönderilmez.

- **Konuşurken:** O ana kadarki ses yaklaşık saniyede bir Whisper'a gönderilir; sonuç yazının devamında gri olarak görünür. Kelimeler tek tek değil, konuşmanın yaklaşık bir-iki saniye gerisinden gruplar halinde gelir. Ses kelimenin ortasında kesilip gönderildiği için son kelime çoğu zaman yarımdır; bu yüzden gösterilmez ve bir sonraki güncellemede tamamı gelir.
- **Duraklayınca:** O bölüm Whisper'a bir kez daha gönderilir ve noktalamalı kesin metin gri yazının yerini alır. Komutlar bu kesin metne göre uygulanır.
- Whisper sunucusu çalışmıyorsa uygulama tarayıcının konuşma tanımasına (Web Speech) geçer ve bunu ekranda belirtir. Web Speech Türkçe'de noktalama koymaz ve sesi Google'a (Chrome) veya Apple'a (Safari) gönderir.

Servisi değiştirmek için proje klasöründe bir `.env.local` dosyası oluşturun:

```bash
VITE_STT_PROVIDER=webspeech   # veya whisper
```

Yeni bir servis eklemek için `src/speech/providers/` altına bir dosya yazmak ve onu `src/speech/index.ts` içinde seçmek yeterlidir. Her servis, `describeTranscriberContract` ile ortak sözleşme testlerinden geçer.

### Whisper kurulumu

Whisper, [whisper.cpp](https://github.com/ggml-org/whisper.cpp) ile bilgisayarda çalışır ve kaynak kodundan derlenir. Program `~/Developer/whisper.cpp`, modeller `~/Developer/whisper-models` klasöründe beklenir (Windows'ta `%USERPROFILE%\Developer\...`).

#### macOS (Apple çipli)

Homebrew paketinde sunucu bulunmadığı için kaynak kodundan derlenir:

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

#### Windows

> Bu adımlar henüz bir Windows bilgisayarda denenmedi.

Gerekli araçları PowerShell'de kurun (Visual Studio derleme araçlarının kurulumu biraz sürer):

```powershell
winget install Git.Git
winget install Kitware.CMake
winget install OpenJS.NodeJS.LTS
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Yeni bir PowerShell penceresi açıp derleyin:

```powershell
git clone --depth 1 --branch v1.9.5 https://github.com/ggml-org/whisper.cpp "$HOME\Developer\whisper.cpp"
cd "$HOME\Developer\whisper.cpp"
cmake -B build -DWHISPER_BUILD_SERVER=ON
cmake --build build -j --config Release --target whisper-server
```

Modelleri indirin (yaklaşık 550 MB):

```powershell
mkdir "$HOME\Developer\whisper-models"
cd "$HOME\Developer\whisper-models"
curl.exe -LO https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
curl.exe -LO https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin
```

NVIDIA ekran kartı varsa ilk `cmake` komutuna `-DGGML_CUDA=ON` eklenerek (CUDA Toolkit kurulu olmalı) Whisper ekran kartında çok daha hızlı çalışır. Ekran kartı olmadan işlemcide çalışır ve önizleme gecikebilir; o zaman daha küçük bir model denenebilir: `ggml-small-q5_1.bin` dosyasını aynı adresten indirip `setx WHISPER_MODEL ggml-small-q5_1.bin` komutunu çalıştırın.

#### Çalıştırma

Proje klasöründe `npm start` Whisper'ı ve uygulamayı birlikte başlatır. Ayrı ayrı başlatmak için iki terminalde `npm run whisper` ve `npm run dev` kullanılabilir.

Klasörler farklıysa `WHISPER_DIR`, `WHISPER_MODELS_DIR` ve `WHISPER_MODEL` ortam değişkenleriyle değiştirilebilir; sunucu programı başka bir yerdeyse tam yolu `WHISPER_SERVER` ile verilir.

## Ölçüm kayıtları

Konuşma tanımadaki bir değişikliğin hızı ve doğruluğu nasıl etkilediği, gerçek sesle kaydedilmiş dikteler üzerinde ölçülür:

1. `npm run dev` ile açılan uygulamada **Ayarlar → Ölçüm için kaydet** seçeneğini açın. Seçenek yalnızca geliştirme sırasında görünür ve sayfa yenilenince kapanır.
2. Mikrofonla her zamanki gibi dikte edin; isterseniz “Nova” ya da ⌃ Control ile komut da verin. Mikrofon kapanınca çıkan kartta metnin olması gereken son halini düzeltip **Kaydet**'e basın.
3. Ses `test-recordings/<tarih>-<ad>.wav` dosyasına; başlangıçtaki metin, komut kelimesi, ⌃ tuşunun basıldığı anlar ve beklenen metin aynı adlı `.json` dosyasına yazılır. Klasör git'e eklenmez, kayıtlar bilgisayarda kalır.
4. Whisper sunucusu açıkken `npm run bench` bütün kayıtları mikrofondan geliyormuş gibi gerçek zamanlı çalar, uygulamanın Whisper akışından geçirir ve sonuçları bir tabloda gösterir. Tek tek dosya da verilebilir: `npm run bench -- kayit.wav` (`--timeline` ile gri ve kesin metnin her hali de yazılır). Kayıt sırasında kullanılan özel kelimeler de kayıtla saklanır; `--no-vocabulary` ile onlarsız ölçülerek etkileri karşılaştırılabilir.

| Ölçüm | Anlamı |
|---|---|
| güncelleme aralığı | Gri metnin ne sıklıkla yenilendiği |
| ilk gri kelime | Konuşma başladıktan sonra ilk gri kelimenin görünmesine kadar geçen süre |
| yanlış gri kelime | Gri kelimelerden, yerine gelen kesin metinle uyuşmayanların oranı (ekranda kalma süresine göre) |
| değişen kelime / güncelleme | Gösterilmiş gri kelimelerden bir sonraki güncellemede değişenler; gri metnin ne kadar “titrediği” |
| geride kalan kelime | Konuşurken söylenmiş ama henüz ekranda görünmeyen kelime sayısı |
| kesin metin gecikmesi | Konuşma bittikten sonra son kesin metnin gelmesine kadar geçen süre |
| metin hatası | Kaydın sonunda ortaya çıkan metinde, beklenen metne göre yanlış, eksik ya da fazla kelimelerin oranı (yalnızca beklenen metni olan kayıtlarda) |

## Geliştirme durumu

Türkçe dikte çalışıyor: konuşurken metin yaklaşık saniyede bir gri önizleme olarak güncelleniyor, duraklayınca noktalamalı kesin metin yerleşiyor (ikisi de Whisper). Silme, düzeltme, gezinme, seçme ve genel sesli komutlar “Nova” ile ya da ⌃ Control basılıyken çalışıyor; komut kelimesi Ayarlar'dan değiştirilebiliyor. Taslak otomatik kaydediliyor, metin indirilebiliyor ve komut geçmişi görülebiliyor. Hız ve doğruluk, kaydedilen gerçek diktelerle ölçülebiliyor (`npm run bench`). macOS'ta çalışıyor; Windows desteği eklendi ama henüz bir Windows bilgisayarda denenmedi. Yapay zekâ gerektiren komutlar (kısaltma, çeviri) henüz yok. Sıradaki işler ve ileride düşünülen fikirler [YOL_HARITASI.md](YOL_HARITASI.md) dosyasındadır.

Bilinen sınırlar:

- Önizleme ve kesin metin aynı Whisper sunucusunu kullandığı için, o an bir önizleme isteği işleniyorsa kesin metin en fazla bir saniye kadar gecikebilir.
- Tarayıcı konuşma tanımasına geçildiğinde metin noktalamasız geldiği için “son cümleyi sil” cümle sınırlarını bulamaz.
- ⌃ ile komut verirken komut modu tuş çeyrek saniye basılı kalınca başlar; dikte sürerken tuşa basar basmaz konuşulursa ilk hece metne kaçabilir.
