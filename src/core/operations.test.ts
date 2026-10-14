import { describe, expect, it } from 'vitest'
import { addBullets, deleteLastSentence, insertDictation } from './operations.ts'

describe('deleteLastSentence', () => {
  it('son cümleyi siler ve sondaki boşluğu temizler', () => {
    expect(deleteLastSentence('Toplantı yarın. Gündem hazır.')).toEqual({
      text: 'Toplantı yarın.',
      removed: 'Gündem hazır.',
    })
  })

  it('tek cümle varsa metni boşaltır', () => {
    expect(deleteLastSentence('Merhaba dünya.')).toEqual({ text: '', removed: 'Merhaba dünya.' })
  })

  it('noktası olmayan son cümleyi de siler', () => {
    expect(deleteLastSentence('Birinci cümle. İkinci cümle')?.text).toBe('Birinci cümle.')
  })

  it('son satırdaki liste maddesini siler', () => {
    expect(deleteLastSentence('Gündem:\n- Bütçe\n- Takvim')).toEqual({
      text: 'Gündem:\n- Bütçe\n',
      removed: '- Takvim',
    })
  })

  it('silinecek cümle yoksa null döner', () => {
    expect(deleteLastSentence('')).toBeNull()
    expect(deleteLastSentence('  ')).toBeNull()
  })
})

describe('addBullets', () => {
  it('metnin altına yeni satırlarda boş maddeler ekler', () => {
    expect(addBullets('Gündem:', 3)).toBe('Gündem:\n- \n- \n- ')
  })

  it('boş metne doğrudan madde ekler', () => {
    expect(addBullets('', 2)).toBe('- \n- ')
  })

  it('metin zaten satır sonuyla bitiyorsa boş satır bırakmaz', () => {
    expect(addBullets('Gündem:\n', 1)).toBe('Gündem:\n- ')
  })
})

describe('insertDictation', () => {
  it('liste yoksa metnin sonuna ekler', () => {
    expect(insertDictation('Toplantı yarın.', 'Gündem hazır.')).toBe('Toplantı yarın. Gündem hazır.')
  })

  it('sondaki boş maddeleri sırayla doldurur', () => {
    let text = addBullets('Gündem:', 3)
    text = insertDictation(text, 'Bütçe')
    expect(text).toBe('Gündem:\n- Bütçe\n- \n- ')
    text = insertDictation(text, 'Takvim')
    text = insertDictation(text, 'Yeni ekip üyeleri')
    expect(text).toBe('Gündem:\n- Bütçe\n- Takvim\n- Yeni ekip üyeleri')
  })

  it('maddeler dolunca son maddenin devamına ekler', () => {
    expect(insertDictation('- Bütçe', 've takvim')).toBe('- Bütçe ve takvim')
  })

  it('boş metin parçasını yok sayar', () => {
    expect(insertDictation('Merhaba', '  ')).toBe('Merhaba')
  })
})
