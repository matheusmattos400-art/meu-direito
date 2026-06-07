/** Rótulos padronizados do status de um caso (fonte única de verdade). */
export const CASE_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Enviado',
  TRIAGING: 'Em triagem',
  TRIAGED: 'Triado',
  RESOLVED_INFO: 'Dúvida resolvida',
  QUALIFIED: 'Qualificado',
  AVAILABLE: 'Disponível',
  ASSIGNED: 'Em atendimento',
  IN_PROGRESS: 'Em andamento',
  CLOSED: 'Encerrado',
  ARCHIVED: 'Arquivado',
};

export function caseStatusLabel(status: string): string {
  return CASE_STATUS_LABEL[status] ?? status;
}
