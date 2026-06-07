import type { BadgeProps } from '@app/ui';

export type LawyerStatus =
  | 'PRE_REGISTRATION'
  | 'IN_ANALYSIS'
  | 'ACTIVE'
  | 'REJECTED'
  | 'CANCELED';

export const LAWYER_STATUS_META: Record<
  LawyerStatus,
  { label: string; variant: BadgeProps['variant'] }
> = {
  ACTIVE: { label: 'Ativo', variant: 'success' },
  IN_ANALYSIS: { label: 'Em análise', variant: 'warning' },
  PRE_REGISTRATION: { label: 'Pré-cadastro', variant: 'neutral' },
  REJECTED: { label: 'Rejeitado', variant: 'danger' },
  CANCELED: { label: 'Cancelado', variant: 'neutral' },
};
