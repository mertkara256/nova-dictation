import type { ServiceStatus } from './useServiceStatus.ts'

const STATUS_LABELS: Record<ServiceStatus, string> = {
  checking: 'denetleniyor',
  ready: 'hazır',
  offline: 'kapalı',
}

interface StatusBadgeProps {
  /** Konuşma tanıma servisinin adı (ör. "Whisper"). */
  name: string
  status: ServiceStatus
  /** Servis kapalıyken üzerine gelince gösterilen açıklama. */
  offlineHint: string
}

/** Konuşma tanıma servisinin açık olup olmadığını gösteren küçük rozet. */
export function StatusBadge({ name, status, offlineHint }: StatusBadgeProps) {
  return (
    <p
      className="status"
      data-status={status}
      role="status"
      title={status === 'offline' ? offlineHint : undefined}
    >
      <span className="status-dot" aria-hidden="true" />
      {name} {STATUS_LABELS[status]}
    </p>
  )
}
