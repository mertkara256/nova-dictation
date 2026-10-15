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
      { say: 'üç boş madde ekle', does: 'Boş maddeler ekler; her duraklamada bir madde dolar' },
    ],
  },
  {
    title: 'Gezinme',
    commands: [
      { say: 'üçüncü satıra git', does: 'İmleci satırın sonuna taşır' },
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
      { say: 'yarın kelimesinden onda kelimesine kadar seç', does: 'İki kelime arasını seçer' },
      { say: 'seçili metni sil · seçimi kaldır', does: 'Seçimi siler ya da kaldırır' },
    ],
    note: 'Seçim varken konuşursan seçili metnin yerine yazılır.',
  },
  {
    title: 'Genel',
    commands: [
      { say: 'geri al · yinele', does: 'Son değişikliği geri alır ya da yeniden yapar' },
      { say: 'metni kopyala', does: 'Bütün metni panoya kopyalar' },
      { say: 'dinlemeyi durdur', does: 'Mikrofonu kapatır' },
      { say: 'komutları göster', does: 'Bu listeyi açar' },
    ],
  },
]
