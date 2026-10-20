# Yol haritası

Sırada ne olduğunu ve ileride düşünülen fikirleri tutar. Bir iş bitince ya da sırası değişince, o işin PR'ında burası da güncellenir. Şu an neyin çalıştığı README'deki “Geliştirme durumu” bölümündedir.

## Sırada

1. **Kendi sesimle ölçüm ve hız.**
   - **Kayıt:** Ayarlar → “Ölçüm için kaydet” ile günlük konuşmaya benzeyen 5–6 dikte kaydedilir (dikte, “Nova” ile komut, ⌃ ile komut). İçlerinde özel kelime listesindeki isimler de geçerse onların etkisi de ölçülür.
   - **Ölçüm:** `npm run bench` bu kayıtlarla gri önizlemeyi, hızı ve doğruluğu ölçer; `--no-vocabulary` ile özel kelimesiz sonuçla karşılaştırılır.
   - **Hız ayarları:** Bu kayıtlarla denenir. İlk aday, susunca kesin metnin yaklaşık 2 saniyede gelmesi; bunun 0,7 saniyesi sessizlik beklemesi.
2. **Yapay zekâ komutları.** “Seçili metni kısalt”, “İngilizceye çevir” gibi komutlar ve sonucu uygulamadan önce gösteren bir “uygula / vazgeç” kartı. Ücretsiz ve bilgisayarda çalışan bir model kullanılır (ör. Ollama ile Qwen ya da Gemma).

## Denenecekler

- **Windows.** Windows desteği eklendi ama henüz bir Windows bilgisayarda denenmedi. Kontrol listesi [PR #21](https://github.com/mertkara256/nova-dictation/pull/21)'de: kurulum, `npm run whisper`, `npm start`, masaüstü kısayolu, Alt + M, Ctrl ile komut, Ctrl+C'de mikrofonun açılmaması ve hız. Denenince README'deki “henüz denenmedi” notu kaldırılır.

## Fikirler

- **Her yazı alanında çalışan uygulama.** Google arama kutusu, mesajlaşma uygulamaları ya da kod editörleri gibi her yazı alanına tıklayıp dikte edebilmek. Uygulama Mac'te menü çubuğunda, Windows'ta tepside durur.
  - **Başlatma:** Her uygulamanın içindeyken çalışan bir kısayolla (basılı tut, konuş, bırak).
  - **Önizleme:** Gri metin küçük, yüzen bir pencerede gösterilir.
  - **Metni yazma:** Kesin metin panoya konup Cmd/Ctrl + V ile yazı alanına yapıştırılır, panonun eski içeriği geri konur.
  - **Kod:** Mevcut kod Tauri ile bir masaüstü uygulamasına sarılabilir.
  - **Sınırlar:**
    - Başka uygulamaların metnini güvenilir şekilde okuyamadığımız için komutlar orada yalnızca bizim yazdığımız metin üzerinde çalışır.
    - Mac'te mikrofon ve Erişilebilirlik izni gerekir.
    - Sürekli dinleyen “Nova” ile açma önerilmez (pil, gizlilik).
    - Başkalarına dağıtmak için imzalama gerekir.
  - **İlk adım:** Yalnızca Mac'te küçük bir deneme sürümü.
- **Özel kelimeler için düzeltme sözlüğü.** İpucu yetmezse, Whisper'ın yazdığı metinde listedeki kelimelere çok benzeyenleri o kelimeye çevirmek. Normal kelimeleri de yanlışlıkla değiştirebileceği için yalnızca ölçümler gerektirirse.
- **Birden fazla not.** Notları kaydedip aralarında geçiş yapabilmek; şu an tek bir taslak var.
- **Dil seçimi.** Türkçe dışında (ör. İngilizce) dikte; Whisper zaten çok dilli.
- **Core ML ile hızlandırma.** Whisper'ın bir kısmını Mac'in yapay zekâ işlemcisinde çalıştırmak. Ancak ölçümler hızın asıl sorun olduğunu gösterirse.
