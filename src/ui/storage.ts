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
export function writeStored(key: string, value: string, storage: Storage | null) {
  try {
    if (value) storage?.setItem(key, value)
    else storage?.removeItem(key)
  } catch {
    // Hafıza doluysa ya da gizli pencerede kapalıysa kaydedilmez.
  }
}
