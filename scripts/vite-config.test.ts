import { resolveConfig } from 'vite'
import { describe, expect, it } from 'vitest'

describe('vite.config.ts', () => {
  it('/whisper yönlendirmesini yalnızca geliştirme sunucusunda açar, önizlemede açmaz', async () => {
    const dev = await resolveConfig({ configFile: 'vite.config.ts', logLevel: 'silent' }, 'serve')
    expect(dev.server.proxy).toHaveProperty('/whisper')

    // vite preview yapılandırmayı bu bağımsız değişkenlerle çözer.
    const preview = await resolveConfig(
      { configFile: 'vite.config.ts', logLevel: 'silent' },
      'serve',
      'production',
      'production',
      true,
    )
    expect(preview.preview.proxy ?? {}).not.toHaveProperty('/whisper')
  })
})
