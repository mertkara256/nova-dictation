// Bu seviyenin altı sessizlik sayılır (yaklaşık -55 dBFS); çizgi nokta olarak kalır.
const SILENT_DB = -55
// Bu seviye çizgiyi tam boyuna uzatır (yaklaşık -5 dBFS, çok yüksek ses).
const LOUD_DB = -5
// Eğri, yüksek seslerin hepsinin tam boya yığılmasını önler; dalga daha canlı görünür.
const CURVE = 1.5

/**
 * Ses seviyesini (RMS, 0–1) çizgi boyuna (0–1) çevirir. Kulak sesi doğrusal
 * değil logaritmik algıladığı için desibel üzerinden ölçeklenir; böylece alçak
 * sesle konuşma da görünür, yüksek sesle konuşma ise ondan belirgin şekilde ayrılır.
 */
export function levelToBar(level: number): number {
  if (level <= 0) return 0
  const db = 20 * Math.log10(level)
  const linear = Math.min(Math.max((db - SILENT_DB) / (LOUD_DB - SILENT_DB), 0), 1)
  return linear ** CURVE
}
