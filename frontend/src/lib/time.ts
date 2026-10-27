export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return 'Not available';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeOnly(isoString?: string | null): string {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getRelativeTimeString(isoString?: string | null): string {
  if (!isoString) return 'Unknown';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return 'Invalid date';

  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < -60) return 'Future timestamp (clock anomaly)';
  if (diffSec < 45) return 'Just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ${diffMin % 60}m ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
