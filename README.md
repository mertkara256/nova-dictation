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
| `npm test` | Testleri bir kez çalıştırır |
| `npm run test:watch` | Testleri, değişiklikleri izleyerek çalıştırır |
| `npm run lint` | Oxlint ile kod denetimi yapar |
| `npm run typecheck` | TypeScript tip denetimi yapar |
| `npm run build` | Yayına hazır sürümü `dist/` klasörüne üretir |

Kod yapısı:

- `src/core`: Belge modeli ve metin işlemleri; arayüzden bağımsız, saf TypeScript.
- `src/speech`: Konuşma tanıma. `Transcriber` arayüzü ve tarayıcının Web Speech API'siyle çalışan ilk uygulaması.
- `src/ui`: React bileşenleri.

## Konuşma tanıma

İlk aşamada tarayıcının yerleşik Web Speech API'si kullanılır; kurulum veya API anahtarı gerekmez.

- Chrome ve Safari'de çalışır, Firefox desteklemez.
- Chrome sesi tanıma için Google'ın sunucularına gönderir; internet bağlantısı gerekir.
- İlk kullanımda tarayıcı mikrofon izni ister.

## Geliştirme durumu

Mikrofon düğmesiyle Türkçe dikte çalışıyor: konuşurken ara metin gri görünür, kesinleşen metin editöre eklenir. Sıradaki adım, komut motoru (“son cümleyi sil” ve geri alma).
