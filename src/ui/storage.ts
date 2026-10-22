/** Tarayıcı hafızası (localStorage); gizli pencerede ya da engellenmişse null. */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Kayıtlı değeri okur; kayıt yoksa ya da hafıza kullanılamıyorsa null döner. */
export function readStored(key: string, storage: Storage | null): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** Değeri kaydeder; boş değer kaydı siler. */
export function writeStored(key: string, value: string, storage: Storage | null): boolean {
  if (!storage) return false
  try {
    if (value) storage.setItem(key, value)
    else storage.removeItem(key)
    return true
  } catch {
    return false
  }
}
