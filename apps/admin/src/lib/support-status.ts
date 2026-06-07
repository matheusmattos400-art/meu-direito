export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export const STATUS_META: Record<TicketStatus, { label: string; variant: 'danger' | 'warning' | 'success' }> = {
  OPEN: { label: 'Não resolvido', variant: 'danger' },
  IN_PROGRESS: { label: 'Em andamento', variant: 'warning' },
  RESOLVED: { label: 'Resolvido', variant: 'success' },
};
