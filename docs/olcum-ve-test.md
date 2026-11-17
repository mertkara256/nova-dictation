# Ölçüm ve test

**Türkçe** · [English](olcum-ve-test.en.md)

Konuşma tanımanın hızını ve doğruluğunu ölçen, uygulamayı gerçek sesle deneyen araçlar. Bütün npm komutları ve birim testleri için README'deki [Geliştirme](../README.md#geliştirme) bölümüne bakın.

## Ölçüm kayıtları

Konuşma tanımadaki bir değişikliğin hızı ve doğruluğu nasıl etkilediği, gerçek sesle kaydedilmiş dikteler üzerinde ölçülür:

1. `npm run dev` ile açılan uygulamada **Ayarlar → Ölçüm için kaydet** seçeneğini açın. Seçenek yalnızca geliştirme sırasında görünür ve sayfa yenilenince kapanır.
2. Mikrofonla her zamanki gibi dikte edin; isterseniz “Nova” ya da ⌃ Control ile komut da verin. Mikrofon kapanınca çıkan kartta metnin olması gereken son halini düzeltip **Kaydet**'e basın.
3. Ses ev klasöründeki `nova-test-recordings/<tarih>-<ad>.wav` dosyasına; başlangıçtaki metin, komut kelimesi, ⌃ tuşunun basıldığı anlar ve beklenen metin aynı adlı `.json` dosyasına yazılır. Klasör proje klasörünün dışındadır: git'e eklenemez, iCloud ya da OneDrive'ın Masaüstü ve Belgeler eşitlemesine de girmez; kayıtlar bilgisayarda kalır.
4. Whisper sunucusu açıkken `npm run bench` bütün kayıtları mikrofondan geliyormuş gibi gerçek zamanlı çalar, uygulamanın Whisper akışından geçirir ve sonuçları bir tabloda gösterir. Tek tek dosya da verilebilir: `npm run bench -- kayit.wav` (`--timeline` ile gri ve kesin metnin her hali de yazılır). Kayıt sırasında kullanılan özel kelimeler de kayıtla saklanır; `--no-vocabulary` ile onlarsız ölçülerek etkileri karşılaştırılabilir. Konuşma parçasını bitiren sessizlik süresi (uygulamada 700 ms) `--silence-ms 500,700,1000` gibi verilirse kayıtlar her süreyle ayrı ayrı ölçülür; kısa süre kesin metni hızlandırır ama cümle ortasındaki duraklamaları da bölebilir.

| Ölçüm | Anlamı |
|---|---|
| güncelleme aralığı | Gri metnin ne sıklıkla yenilendiği |
| ilk gri kelime | Konuşma başladıktan sonra ilk gri kelimenin görünmesine kadar geçen süre |
| yanlış gri kelime | Gri kelimelerden, yerine gelen kesin metinle uyuşmayanların oranı (ekranda kalma süresine göre) |
| değişen kelime / güncelleme | Gösterilmiş gri kelimelerden bir sonraki güncellemede değişenler; gri metnin ne kadar “titrediği” |
| geride kalan kelime | Konuşurken söylenmiş ama henüz ekranda görünmeyen kelime sayısı |
| kesin metin gecikmesi | Konuşma bittikten sonra son kesin metnin gelmesine kadar geçen süre |
| parça | Whisper'a giden konuşma parçası sayısı; aynı kayıtta artması, duraklamalarda bölünme demektir |
| metin hatası | Kaydın sonunda ortaya çıkan metinde, beklenen metne göre yanlış, eksik ya da fazla kelimelerin oranı (yalnızca beklenen metni olan kayıtlarda) |
| noktalama ve büyük harf | Kelimeler dışındaki farkların oranı: eksik, fazla ya da yanlış noktalama, satır sonu ve büyük/küçük harf. Duraklamada bölünen bir cümle (“Bugün toplantıda. Bütçeyi konuştuk.”) burada görünür (yalnızca beklenen metni olan kayıtlarda) |

## Uçtan uca test

Birim testleri konuşma tanımayı sahte bir servisle dener. `npm run test:e2e` ise uygulamayı gerçek bir Chrome'da, biri mikrofona konuşuyormuş gibi baştan sona dener: Türkçe cümleler macOS'un Yelda sesiyle seslendirilir ve Chrome'a mikrofon yerine bu ses verilir. Böylece mikrofon, konuşma algılama, Whisper, sesli komutlar, mikrofon düğmesi ve ⌃ Control tuşu birlikte çalışır.

- Gerekenler: macOS, Google Chrome ve açık bir Whisper sunucusu (`npm run whisper` ya da `npm start`). Chrome boş, geçici bir profille açılır; tarayıcı verilerine dokunmaz.
- Denenenler (11 senaryo):
  - dikte ve “Nova” ile komut; “Nova” deyip duraklayınca komutun bir sonraki sözde beklenmesi
  - konuşma biter bitmez kapatılan mikrofonun son sözü kaybetmemesi
  - ⌃ basılıyken söylenen tek komut ve art arda iki komut
  - sesle geri alma ve komuttan sonra çıkan bildirimdeki **Geri al** düğmesi
  - sesle seçilen kelimenin yerine dikte
  - “dinlemeyi durdur”dan sonra söylenenlerin yazılmaması; “duraklat”tan sonra söylenenlerin “devam et”e kadar yazılmaması
  - yeni bir notta dikte ve önceki notun korunması
- Noktalama karşılaştırılmaz; Whisper'ın seçimi değişebilir, noktalama kuralları birim testlerinde denenir. Bir senaryo başarısız olursa beklenen ve çıkan metinle birlikte Whisper'ın yanıtları da yazılır.
- Whisper modeli ve Türkçe ses gerektiği için GitHub'daki testlerde çalışmaz; konuşma tanımaya dokunan değişikliklerden sonra elle çalıştırılır. Bir çalıştırma yaklaşık iki dakika sürer.

## Ses taraması

`npm run scan:speech`, `scripts/speech-cases.ts` içindeki vakaları macOS'un Yelda sesiyle seslendirip Whisper'a yazdırır. Whisper'ın yazdığı metin uygulamanın düzenleyicisinden geçirilir ve ortaya çıkan metin beklenenle karşılaştırılır. Böylece Whisper'ın bir ifadeyi nasıl yazdığı ve uygulamanın buna ne yaptığı birlikte denenir.

| Kategori | Denenen |
|---|---|
| `komut` | Komutlar panelindeki her ifade, “Nova” ile ve ⌃ basılıyken söylenir gibi; aynı komut olarak anlaşılıyor mu |
| `sonuc` | Bir metin üzerinde verilen komutun sonucu (“son cümleyi sil”, “yarın yerine perşembe yaz”…) |
| `zincir` | Art arda komutlar (“son cümleyi sil ve yeni satır”) |
| `ara` | Dikte arasında söylenen komutlar |
| `dikte` | Sayılar, saatler, özel isimler ve kesme işaretli ekler içeren dikte |
| `degil` | Komut sanılmaması gereken cümleler (“Parayı geri aldım.”, “Nova adlı bir uygulama kullanıyorum.”) |

- ⌃ basılıyken söylenen vakalarda Whisper'a uygulamadaki gibi komut listesi ipucu olarak verilir.
- Dikte edilen cümlelerde (`ara`, `dikte`) büyük/küçük harf ve noktalama karşılaştırılmaz; komut sonuçlarında yalnızca büyük/küçük harf farkı gözetilmez. `degil` kategorisinde yalnızca bir komut uygulanıp uygulanmadığına bakılır. Bir vaka için birden fazla doğru biçim verilebilir (“saat üçte” ya da “saat 3'te”).
- Her vakanın, ifadenin kendisi yazılınca beklenen sonucu verdiği `npm test` içinde de denenir; bu kısım GitHub'da da çalışır.
- Sesin dört çeşidi var: `normal`, `hızlı`, `yavaş` ve `gürültülü` (arkada hafif bir hışırtı). Varsayılan yalnızca `normal`dır. Kategoriler ve çeşitler seçilebilir:

```bash
npm run scan:speech -- --category komut,sonuc
npm run scan:speech -- --variant normal,hızlı,yavaş,gürültülü
```

- Sonuçlar `scripts/speech-scan-results.json` dosyasındaki kayıtlı sonuçlarla karşılaştırılır. Yanlış sonuç verenler “✗” ile, kayda göre yeni bozulanlar “(YENİ)”, düzelenler “(düzeldi)” ile gösterilir; yeni bozulan varsa çıkış kodu 1 olur. `--save` sonuçları bu dosyaya yazar; bir değişikliğin sonucu kabul edilince kaydedilir. Sonuçlar her kategori bitince yazılır, tarama yarıda kalırsa biten kategoriler kaybolmaz. Whisper'a giden bir istek koparsa hemen, o da olmazsa iki saniye sonra yeniden denenir. Kayıt macOS'ta large-v3-turbo modeliyle alındı; başka bir modelde ya da bilgisayarda sonuçlar farklı olabilir.
- Konuşma tanımaya, komut kalıplarına ya da komutların uygulanmasına dokunan değişikliklerden önce ve sonra çalıştırılır. Bütün kategoriler tek çeşitle yaklaşık 8 dakika, dört çeşitle yaklaşık 30 dakika sürer.
- Yelda'nın sesi gerçek bir sesten farklıdır; örneğin Whisper onun “sil” deyişini sık sık “si” ya da “C” diye yazar. Tarama bir değişikliğin eskiden çalışanı bozup bozmadığını gösterir; gerçek doğruluğu kendi kayıtlarla `npm run bench` gösterir. Gereken: macOS ve açık bir Whisper sunucusu.
