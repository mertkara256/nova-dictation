import { browserStorage, readStored, writeStored } from './storage.ts'

const SETUP_KEY = 'nova-dictation:setup-seen'

/** Var olan bir taslak veya kurtarma kopyası varsa çalışma alanını rehberle açma. */
export function shouldShowSetup(hasDraft: boolean, storage = browserStorage()) {
  return !hasDraft && readStored(SETUP_KEY, storage) !== '1'
}

export function markSetupSeen(storage = browserStorage()) {
  return writeStored(SETUP_KEY, '1', storage)
}
