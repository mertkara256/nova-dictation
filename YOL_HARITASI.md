# Yol haritası

Sırada ne olduğunu ve ileride düşünülen fikirleri tutar. Bir iş bitince ya da sırası değişince, o işin PR'ında burası da güncellenir. Şu an neyin çalıştığı README'deki “Geliştirme durumu” bölümündedir.

## Sırada

1. **Kendi sesimle ölçüm ve hız.**
   - **Kayıt:** Ayarlar → “Ölçüm için kaydet” ile günlük konuşmaya benzeyen 5–6 dikte kaydedilir (dikte, “Nova” ile komut, ⌃ ile komut). İçlerinde özel kelime listesindeki isimler de geçerse onların etkisi de ölçülür.
   - **Ölçüm:** `npm run bench` bu kayıtlarla gri önizlemeyi, hızı ve doğruluğu ölçer; `--no-vocabulary` ile özel kelimesiz sonuçla karşılaştırılır.
   - **Hız ayarları:** Bu kayıtlarla denenir. İlk aday, susunca kesin metnin yaklaşık 2 saniyede gelmesi; bunun 0,7 saniyesi sessizlik beklemesi. `--silence-ms 500,700,1000` ile süreler karşılaştırılır. Süre kısaldıkça cümle ortasındaki duraklamalar da bölünebilir; bunu “parça” ile “noktalama ve büyük harf” sütunları gösterir.
2. **Yapay zekâ komutları.** “Seçili metni kısalt”, “İngilizceye çevir” gibi komutlar ve sonucu uygulamadan önce gösteren bir “uygula / vazgeç” kartı. Ücretsiz ve bilgisayarda çalışan bir model kullanılır (ör. Ollama ile Qwen ya da Gemma).

## Herkese açmadan önce

Proje biraz daha gelişince repo herkese açılacak. Ondan önce yapılacaklar:

1. **README'nin üst kısmı vitrin gibi olsun.** Şu sırayla: tek cümlelik tanıtım, video, öne çıkan özellikler, teknik açıdan ilginç noktalar (Türkçe ekleri bilen komut eşleştirme, sahte mikrofonla uçtan uca test, sentetik sesle ses taraması), nasıl çalıştırılır. Planlama bölümleri ve ayrıntılar aşağıya iner. İlk cümle yapay zekâ komutları gelene kadar "yapay zekâ destekli" demesin.
2. **Tanıtım videosu ya da GIF (30–60 saniye).** Whisper'la tam deneyim: konuşunca metnin yazılması, "Nova, son cümleyi sil", ⌃ ile komut, geri alma.
3. **Kurulumsuz deneme sürümü.** Chrome'un kendi konuşma tanımasıyla (Web Speech) çalışan, internette barındırılan bir sürüm. Whisper'a ulaşılamayınca uygulama zaten buna geçiyor.
   - Sayfanın üstünde bunun bir deneme sürümü olduğu, noktalamanın ve bütün komutların bilgisayarda Whisper'la çalışan tam sürümde olduğu yazar.
   - Bu modda Türkçe noktalama yok, bu yüzden cümle komutları çalışmaz. Ses Google'a gider. Firefox'ta çalışmaz.
   - Bakılacaklar: ⌃ ile komut bu modda neden kapalı, açılabilir mi? Duraklamalarda otomatik nokta konabilir mi? (Cümle komutlarını kabaca çalıştırır ama yanlış yerlere de nokta koyar.)
   - Barındırma: GitHub Pages ücretsiz planda yalnızca herkese açık repolarda çalışır. Repo gizliyken Cloudflare Pages, Netlify ya da Vercel'in ücretsiz planı kullanılabilir.
4. **Repoyu herkese açmak.** Eski commit'lerdeki e-posta adresi görünür kalacak; bu kabul edildi. Lisans şimdilik eklenmeyecek.
5. **Yapay zekâ komutları** (Sırada, 2. madde). README'nin verdiği sözü tamamlar.
6. **Mülakata hazırlık.** `src/commands` ve `src/core` klasörlerini kendi cümlelerimle anlatabilecek kadar gözden geçirmek. Örnek sorular: komut eşleştirmede neden hata payı var, olumsuz fiil ("silme") sorunu nasıl bulundu ve çözüldü?

## Denenecekler

- **Windows.** Windows desteği eklendi ama henüz bir Windows bilgisayarda elle denenmedi; testler ve derleme GitHub'da Windows'ta da çalışıyor. Kontrol listesi [PR #21](https://github.com/mertkara256/nova-dictation/pull/21)'de: kurulum, `npm run whisper`, `npm start`, masaüstü kısayolu, Alt + M, Ctrl ile komut, Ctrl+C'de mikrofonun açılmaması ve hız. Denenince README'deki “henüz denenmedi” notu kaldırılır.
- **Ortaya dikte ederken baş harf.** Whisper her sözü büyük harfle başlatır; metnin ortasına dikte edilince “Toplantı Perşembe saat üçte” gibi olur. Harfi doğrudan küçültmek özel isimleri de küçültür. Whisper'a imlecin önündeki metni ipucu olarak vermek, kısa bir denemede özel isimleri bozmadan bunu kısmen düzeltti; kendi kayıtlarla ölçülerek denenecek.

## Fikirler

- **Kolay kurulum paketi.** İlk kullanım rehberi, yerel mikrofon kontrolü ve servis/model durumu hazır. Whisper'ın derlenmesi ve model indirme adımları hâlâ kurulum rehberinden yapılıyor; dağıtılabilir bir paket ve model kurulum sihirbazı ayrı bir sonraki çalışma olabilir.
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
- **Dil seçimi.** Türkçe dışında (ör. İngilizce) dikte; Whisper zaten çok dilli.
- **Core ML ile hızlandırma.** Whisper'ın bir kısmını Mac'in yapay zekâ işlemcisinde çalıştırmak. Ancak ölçümler hızın asıl sorun olduğunu gösterirse.
