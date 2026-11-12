export interface HelpGroup {
  title: string
  commands: { say: string; does: string }[]
  note?: string
}

/** Arayüzdeki "Komutlar" panelinde gösterilen liste. Yeni komut eklenince burası da güncellenir. */
export const COMMAND_HELP: HelpGroup[] = [
  {
    title: 'Silme',
    commands: [
      { say: 'bunu sil', does: 'Son söylediğini ya da seçili metni siler' },
      { say: 'son cümleyi sil', does: 'İmlecin önündeki son cümleyi siler' },
      { say: 'ilk cümleyi sil · ikinci cümleyi sil', does: 'Sırası verilen cümleyi siler' },
      { say: 'son kelimeyi sil · son üç kelimeyi sil', does: 'İmlecin önündeki kelimeleri siler' },
      { say: 'son paragrafı sil', does: 'Son paragrafı siler' },
      { say: 'son satırı sil · ikinci satırı sil', does: 'Satırı siler' },
      { say: 'yarın kelimesini sil', does: 'Kelimenin son geçtiği yeri siler' },
      { say: 'her şeyi sil', does: 'Bütün metni siler (geri alınabilir)' },
    ],
  },
  {
    title: 'Düzeltme ve biçim',
    commands: [
      { say: 'yarın yerine perşembe yaz', does: 'Kelimenin son geçtiği yeri değiştirir' },
      { say: 'yeni satır · yeni paragraf', does: 'Alt satıra ya da yeni paragrafa geçer' },
      { say: 'nokta · virgül · soru işareti · ünlem', does: 'Noktalama işareti koyar' },
      { say: 'tırnak aç · tırnak kapat · parantez aç · parantez kapat · kısa çizgi', does: 'Tırnak, parantez ya da kısa çizgi koyar' },
      { say: 'yarın kelimesini tırnak içine al · bunu parantez içine al', does: 'Tırnak ya da parantez içine alır' },
      { say: 'ankara kelimesini büyük harfle yaz · bunu küçük harfle yaz', does: 'Kelimelerin baş harflerini büyütür ya da hepsini küçültür' },
      { say: 'üç boş madde ekle', does: 'Boş maddeler ekler; her duraklamada bir madde dolar' },
    ],
  },
  {
    title: 'Gezinme',
    commands: [
      { say: 'üçüncü satıra git', does: 'İmleci satırın sonuna taşır' },
      { say: 'ikinci paragrafa git', does: 'İmleci paragrafın sonuna taşır' },
      { say: 'cümlenin başına git · cümlenin sonuna git', does: 'İmleci bulunduğu cümlenin başına ya da sonuna taşır' },
      { say: 'başa git · sona git', does: 'İmleci metnin başına ya da sonuna taşır' },
      { say: 'sonraki maddeye geç · önceki maddeye geç', does: 'Liste maddeleri arasında gezinir' },
      { say: 'toplantı kelimesinden sonra yaz', does: 'Kelimenin arkasından (ya da "önce yaz" ile önünden) yazar' },
    ],
    note: 'Gezinmeden sonra söylediklerin imlecin olduğu yere yazılır.',
  },
  {
    title: 'Seçme',
    commands: [
      { say: 'son cümleyi seç · ikinci cümleyi seç', does: 'Cümleyi seçer' },
      { say: 'son paragrafı seç', does: 'Paragrafı seçer' },
      { say: 'yarın kelimesini seç · son üç kelimeyi seç', does: 'Kelimeyi ya da imlecin önündeki kelimeleri seçer' },
      { say: 'bunu seç · her şeyi seç', does: 'Son söylediğini ya da bütün metni seçer' },
      { say: 'yarın kelimesinden onda kelimesine kadar seç', does: 'İki kelime arasını seçer' },
      { say: 'seçili metni sil · seçimi kaldır', does: 'Seçimi siler ya da kaldırır' },
    ],
    note: 'Seçim varken konuşursan seçili metnin yerine yazılır.',
  },
  {
    title: 'Genel',
    commands: [
      { say: 'geri al · yinele', does: 'Son değişikliği geri alır ya da yeniden yapar' },
      { say: 'üç kere geri al · iki kez ileri al', does: 'Birden fazla değişikliği geri alır ya da yineler' },
      { say: 'kopyala', does: 'Seçili metni, seçim yoksa bütün metni panoya kopyalar' },
      { say: 'metni kopyala', does: 'Bütün metni panoya kopyalar' },
      { say: 'kes · son cümleyi kes', does: 'Seçili metni, son söylediğini ya da cümleyi keser ve panoya kopyalar' },
      { say: 'yapıştır', does: 'Son kesilen ya da kopyalanan metni imlecin olduğu yere yazar' },
      { say: 'son cümleyi başa taşı · bunu sona taşı', does: 'Cümleyi ya da son söylediğini metnin başına veya sonuna taşır' },
      { say: 'dinlemeyi durdur', does: 'Mikrofonu kapatır' },
      { say: 'duraklat · devam et', does: 'Dinlemeyi duraklatır; “devam et” denene kadar söylenenler yazılmaz' },
      { say: 'komutları göster', does: 'Bu listeyi açar' },
    ],
  },
]

/**
 * Komut tuşu basılıyken söylenenler için Whisper'a verilen ipucu: listedeki her satırın ilk
 * söyleyişi. Örnek kelime içerenler ("yarın kelimesini sil") girmez; Whisper o kelimeleri
 * duymaya yatkınlaşmasın. Ses taramasında ⌃ ile söylenen komutları, en çok hızlı seste, daha doğru
 * yazdırdı; isteği yalnızca birkaç on milisaniye uzatıyor.
 */
export const COMMAND_PROMPT = `${COMMAND_HELP.flatMap((group) => group.commands.map(({ say }) => say.split(' · ')[0]))
  .filter((phrase) => !/kelimesi|yerine/.test(phrase))
  .join(', ')}.`
