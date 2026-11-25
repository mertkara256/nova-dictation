# Yol haritası

Sırada ne olduğunu, ileride düşünülen fikirleri ve ölçülüp elenen değişiklikleri tutar. Bir iş bitince ya da sırası değişince, o işin PR'ında burası da güncellenir. Şu an neyin çalıştığı README'deki “Geliştirme durumu” bölümündedir.

## Sırada

1. **Kendi sesimle ölçüm ve hız.**
   - **Kayıt:** Ayarlar → “Ölçüm için kaydet” ile günlük konuşmaya benzeyen 5–6 dikte kaydedilir (dikte, “Nova” ile komut, ⌃ ile komut). İçlerinde özel kelime listesindeki isimler de geçerse onların etkisi de ölçülür.
   - **Ölçüm:** `npm run bench` bu kayıtlarla gri önizlemeyi, hızı ve doğruluğu ölçer; `--no-vocabulary` ile özel kelimesiz sonuçla karşılaştırılır.
   - **Hız ayarları:** Bu kayıtlarla denenir. İlk aday, susunca kesin metnin yaklaşık 2 saniyede gelmesi; bunun 0,7 saniyesi sessizlik beklemesi. `--silence-ms 500,700,1000` ile süreler karşılaştırılır. Süre kısaldıkça cümle ortasındaki duraklamalar da bölünebilir; bunu “parça” ile “noktalama ve büyük harf” sütunları gösterir.
   - **Model:** Aynı kayıtlarla tam large-v3 modeli de turbo ile karşılaştırılır (`WHISPER_MODEL=ggml-large-v3-q5_0.bin npm run whisper`). Sentetik seste fark çıkmadı (bkz. Denenip elenenler).
2. **Yapay zekâ komutları.** “Seçili metni kısalt”, “İngilizceye çevir” gibi komutlar ve sonucu uygulamadan önce gösteren bir “uygula / vazgeç” kartı.
   - **Model:** Gemini Flash-Lite'ın ücretsiz katmanı (Ekim 2026'da günde yaklaşık 500 istek); yedek olarak Groq. Google projesinde ödeme bilgisi olmaz. Anahtar `.env.local`'da durur ve Vite proxy'si üzerinden kullanılır.
   - **Gizlilik:** Seçili metin Google'a gider; bu, arayüzde komutu kullanmadan önce açıkça yazmalı. Ses yine bilgisayardan çıkmaz.
   - **Deneme sürümünde çalışmaz:** Anahtar bilgisayardaki Vite proxy'sinde durduğu için internette barındırılan sürümde bu komutlar olmaz.
   - **Bakılacak:** Chrome'un yerleşik çeviri API'si (Translator) anahtarsız ve bilgisayarda çalışıyor; Türkçeyi destekliyorsa çeviri için yerel bir seçenek olabilir.
   - **Bakılacak:** “Nova, düzelt” komutu. Son paragraf yalnızca tanıma hatalarını düzeltmesi istenerek gönderilir, sonuç aynı “uygula / vazgeç” kartında gösterilir. Konuşma tanımadaki hataları düzeltmenin, sesi bilgisayardan çıkarmayan bir yolu.

## Denenecekler

- **Windows.** Windows desteği eklendi ama henüz bir Windows bilgisayarda elle denenmedi; testler ve derleme GitHub'da Windows'ta da çalışıyor. Kontrol listesi [PR #21](https://github.com/mertkara256/nova-dictation/pull/21)'de: kurulum, `npm run whisper`, `npm start`, masaüstü kısayolu, Alt + M, Ctrl ile komut, Ctrl+C'de mikrofonun açılmaması ve hız. Denenince README'deki “henüz denenmedi” notu kaldırılır.
- **Ortaya dikte ederken baş harf.** Whisper her sözü büyük harfle başlatır; metnin ortasına dikte edilince “Toplantı Perşembe saat üçte” gibi olur. Harfi doğrudan küçültmek özel isimleri de küçültür. Whisper'a imlecin önündeki metni ipucu olarak vermek, kısa bir denemede özel isimleri bozmadan bunu kısmen düzeltti; kendi kayıtlarla ölçülerek denenecek.
- **Duraklamada bölünen cümle.** Cümlenin ortasında 0,7 saniyeden uzun duraklanınca “Bugün toplantıda. Bütçeyi konuştuk.” gibi yazılıyor. Yeni parça öncekinden kısa süre sonra başladıysa önceki metin Whisper'a ipucu olarak verilir; Whisper küçük harfle başlarsa önceki parçanın noktası atılır. Bir üstteki maddeyle aynı yöntem; ikisi birlikte, kendi kayıtlarla ve `npm run bench`'in “parça” ile “noktalama ve büyük harf” sütunlarıyla ölçülür.
  - **Sentetik sesle ölçüldü:** Whisper ipucunun nasıl bittiğini taklit ediyor. Cümle ortasındaki duraklamadan sonra devamın küçük harfle başlaması:
    - İlk parça virgülle bittiyse: 46'da 39 (ipuçsuz 4).
    - Hiç işaretsiz bittiyse: 47'de 26 (ipuçsuz 2); ama bu kez cümlenin sonundaki nokta da 28'inde kayboldu.
    - Noktayla bittiyse: 67'de 2 (ipuçsuz 5), yani hiç işe yaramadı.
  - Yukarıdaki örnekte ilk parça noktayla bittiği için ipucu tek başına yetmiyor; başka bir yol gerekebilir. İpucundaki noktayı atmak da çözüm değil (bkz. Denenip elenenler).
- **Tarayıcının ses işlemesi.** Mikrofon yankı engelleme ve gürültü bastırma açık olarak açılıyor; otomatik ses yükseltme de varsayılan olarak açık. Bunlar görüntülü görüşme için; Google'ın konuşma tanıma rehberi gürültü azaltmanın ve otomatik ses yükseltmenin kapatılmasını öneriyor. Aynı cümleler iki ayarla kaydedilip karşılaştırılır. Risk: ses yükseltme kapanınca kısık bir mikrofonda konuşma hiç algılanmayabilir.
- **Örnekleme hızını düşürme.** 48 kHz'lik ses, üç örneğin ortalaması alınarak 16 kHz'e indiriliyor. Bu süzgeç 10 kHz'deki sesi yalnızca 5,9 dB zayıflatıyor, kalanı 6 kHz'e katlanıyor; “s, ş, ç” gibi sesler bulanıklaşabilir. Düzeltmesi küçük; etkisi kendi kayıtlarla ölçülür.
- **⌃ bırakılınca kesilen komut.** Tuş bırakılınca ses anında kesiliyor ve çeyrek saniyeden kısa konuşma atılıyor. Tek heceli “kes” gibi komutlar kaybolabilir ya da yarım sesle uydurma metne dönebilir. Komut modunda bu süzgeç gevşetilip, bırakınca kelimenin bitmesi beklenebilir.

## Denenip elenenler

Ölçülüp şimdilik bırakılan değişiklikler; yeniden denemeden önce buraya bakılır. Ölçümler Kasım 2026'da M1 Pro bir Mac'te, aksi yazmıyorsa turbo modeliyle ve sentetik sesle yapıldı: Yelda sesi, ses taramasının 222 vakası, gürültülü ve hızlı çeşitleri. Sentetik ses bu ayarlara az duyarlı; kendi kayıtlar farklı bir sonuç gösterirse yeniden bakılır.

- **Tam large-v3 modeli.** `ggml-large-v3-q5_0.bin` (1,1 GB) turbo ile karşılaştırıldı; turbo kaldı.
  - **Doğruluk:** Gürültülü seste 179'a karşı 181, hızlı seste 203'e karşı 205 doğru; fark gürültü düzeyinde. 3–15 saniyelik temiz diktelerde iki model harfi harfine aynı metni yazdı.
  - **Hız:** Her parça 0,3–1 saniye daha yavaş. Önizleme ve kesin metin aynı anda çalışınca ikisi de yaklaşık iki kat yavaşlıyor.
  - Kendi kayıtlarla bir kez daha karşılaştırılacak (Sırada, 1. madde).
- **Işın araması (beam 5).** Doğruluk artmadı (179'dan 176'ya, 203'ten 202'ye). Kısa ⌃ komutlarında (“kopyala”, “kes”, “ünlem”) üç kez “İzlediğiniz için teşekkür ederim.” uydurdu.
- **Baştaki “Nova”nın düşmesi.** Whisper sunucusunun konuşma algılaması (VAD) parçanın başlangıcını bazen birkaç ms geç seçip “Nova”nın başını kesiyor; Whisper kesik kelimeyi yazmıyor ve komut metne gidiyor. Whisper'a giden ses tam, uygulama bir şey kesmiyor. Uygulamadan (Chrome'dan) geçen sesle, “Nova”lı 81 ifade 8 farklı hizayla gönderildi: baştaki “Nova” 576 istekte 14 kez düştü. Ses taramasının sesinde bu düşme hiç görülmüyor. Denenen yolların hiçbiri başka bir şeyi bozmadan çözmedi:
  - **VAD'ı kapatmak.** Düşme 0'a indi. Ama ses taramasında 20 yeni hata, 15 düzelen (888 vakada 792'den 787'ye); uçtan uca testin 3 çalıştırmasından birinde iki senaryo bozuldu (“Toplantı yarın.” → “Uyarım.”).
  - **VAD'ın konuşma payını 30 ms'den 100 ms'ye çıkarmak.** Düşme 0'a indi. Ses taramasında 15 yeni hata, 16 düzelen (793); uçtan uca testin iki çalıştırmasında da cümle başları kesildi (“Toplantı” → “Plantı”). Whisper ayrıca 576 istekte 12 kez “Nova. Tırnak kapat.” diye nokta koydu; ayrıştırıcı bunu metin sayıyor. 200 ms'de düşme 1, nokta 4.
  - **Komut kelimesini dikteye ipucu vermek.** Düşme 14'ten 143'e çıktı: Whisper ipucundaki “Nova”yı söylenmiş sayıp atlıyor ya da noktayla yazıyor. Ses taramasında 57 yeni hata; diktenin doğruluğu değişmedi.
  - **Parçanın başına daha uzun ses (`preRollMs`) ya da sessizlik eklemek.** VAD sessizliği attığı için yalnızca hizayı kaydırıyor: başarısız bir parça 200 ms eklenince düzeldi, 224 ya da 512 ms eklenince yine düştü.
  - **Komut kelimesi olmadan bilinen bir komut kalıbına uyan parçayı komut saymak.** Düşen 14 isteğin 12'sini düzeltirdi. Ama tek başına dikte edilen sıradan cümlelerin çoğu komut kalıbına uyuyor: denenen 24 cümlenin 17'si (“Geri al.”, “Kes.”, “Devam et.”, “Her şeyi sil.”) komut sanılırdı. Bunun yerine böyle bir parça metne yazılıyor ve bildirimde **Komut olarak uygula** düğmesi çıkıyor.
- **Kısa ses penceresi (`audio_ctx`).** Hızlandırmak için denendi; turbo modelinin çıktısını tamamen bozdu (67 vakada 1 doğru).
- **Önceki metni ipucu vermek.** Duraklamayla bölünmüş 60 cümlede ve 136 tarama vakasında denendi.
  - İpucunun tekrar yazılması hiç görülmedi; hız değişmedi.
  - Kelime doğruluğu artmadı (örneğin gürültülü seste 136 vakada 107'ye karşı 105 doğru). Etkisi yalnızca noktalamada (bkz. Denenecekler, “Duraklamada bölünen cümle”).
  - İpucundaki son noktayı atmak zararlı: gerçek cümle sınırlarının yarıya yakını birleşti, doğru sonuç 107'den 99'a düştü.
  - İpucu verilince komut kayıtlarının yaklaşık %1'inde baştaki “Nova” yazılmadı; komut metne yazılır.
- **Başka modeller (yalnızca araştırıldı).** Türkçe için en iyi yerel seçenek hâlâ Whisper large-v3 (FLEURS'te kelime hatası yaklaşık %6).
  - Qwen3-ASR-1.7B Türkçeyi destekliyor ama daha kötü (%9,5).
  - Cohere Transcribe Türkçeyi desteklemiyor.
  - Türkçeye ince ayarlı bir large-v3 (BuzzASR/turkish) kendi ölçümüne göre biraz daha iyi; noktalama koyup koymadığı bilinmiyor ve whisper.cpp biçimine çevrilmesi gerekiyor.

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
- **Özel kelimeler için düzeltme sözlüğü.** İpucu yetmezse Whisper'ın sık yanlış yazdığı kelimeleri düzeltmek. Benzerliğe bakıp tahmin etmek normal kelimeleri de değiştirebilir. Daha güvenli yol: “X yerine Y yaz” komutunun bildirimine bir “Hep böyle düzelt” düğmesi konur ve yalnızca kullanıcının onayladığı çiftler sonraki diktelerde uygulanır.
- **Şüpheli kelimeleri işaretlemek.** Whisper'ın emin olmadığı kelimelerin altı ince çizilir; uzun bir dikteden sonra hata aramak yerine çizili kelimelere bakılır, sesle seçilip düzeltilir. whisper.cpp sunucusu `verbose_json` biçiminde her parçacığın olasılığını veriyor. Önce yalnızca ölçülür: düşük olasılıklı kelimelerin ne kadarı gerçekten yanlış? Sonuç kötüyse burada durulur. Kendi kayıtlar gerekir.
- **Bütün notların yedeği.** Notların hepsi tek dosyaya indirilir ve geri yüklenir. Notlar tarayıcıda adrese bağlı tek bir kayıtta duruyor; tarayıcı verisi silinirse ya da uygulama başka bir adreste açılırsa kaybolur.
- **Tarayıcının tanımasında ⌃ ile komut.** Deneme sürümünde ⌃ kapalı, çünkü tarayıcının tanıması komut modunu bilmiyor. Tuşa basılınca ve bırakılınca tanıma yeniden başlatılarak açılabilir.
- **Dil seçimi.** Türkçe dışında (ör. İngilizce) dikte; Whisper zaten çok dilli.
- **Core ML ile hızlandırma.** Whisper'ın bir kısmını Mac'in yapay zekâ işlemcisinde çalıştırmak. Ancak ölçümler hızın asıl sorun olduğunu gösterirse.

## İlk sürümün hedefleri

- Uygulamanın kendi web editöründe Türkçe dikte.
- Konuşmayı canlı metin olarak takip etme.
- “Nova” ifadesi veya bir tuş aracılığıyla komut verme.
- Son cümleyi silme ve boş liste maddeleri ekleme.
- Seçili metni kısaltma ve İngilizceye çevirme.
- AI ile yeniden yazılan metni uygulamadan önce önizleme.
- Yapılan düzenlemeleri geri alma ve taslakları kaydetme.

## İlk sürümün dışında

- İşletim sistemindeki diğer uygulamaların metin alanlarına müdahale.
- Mikrofon kapalıyken arka planda sürekli dinleyen bir uyandırma sistemi.
- Mobil uygulamalar, kullanıcı hesapları ve ödeme sistemi.
