export function formatSlaStatus(slaDeadline: string, now = Date.now()) {
  const diffMs = new Date(slaDeadline).getTime() - now;
  const overdue = diffMs < 0;
  const totalMinutes = Math.floor(Math.abs(diffMs) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return {
    overdue,
    label: overdue ? `Vencido hace ${duration}` : `Vence en ${duration}`,
  };
}
