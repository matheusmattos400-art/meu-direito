import { z } from 'zod';

/**
 * Schemas Zod compartilhados (validação de entrada na API e no front).
 * Mantém uma fonte única de verdade para as regras de validação.
 */

/** Início de uma triagem pelo cidadão (Módulo B). */
export const startTriageSchema = z.object({
  narrative: z
    .string()
    .min(20, 'Descreva seu caso com pelo menos 20 caracteres.')
    .max(10_000, 'Relato muito longo.'),
  city: z.string().max(120).optional(),
  state: z.string().length(2).optional(),
});
export type StartTriageInput = z.infer<typeof startTriageSchema>;

/** Mensagem dentro do chat de triagem (com caseId — uso interno/genérico). */
export const triageMessageSchema = z.object({
  caseId: z.string().uuid(),
  content: z.string().min(1).max(10_000),
});
export type TriageMessageInput = z.infer<typeof triageMessageSchema>;

/** Corpo da mensagem quando o caseId vem na URL (endpoint REST). */
export const sendTriageMessageSchema = z.object({
  content: z.string().min(1, 'Mensagem vazia.').max(10_000, 'Mensagem muito longa.'),
});
export type SendTriageMessageInput = z.infer<typeof sendTriageMessageSchema>;

/** Registro de consentimento (LGPD). */
export const grantConsentSchema = z.object({
  termId: z.string().uuid(),
  granted: z.boolean(),
});
export type GrantConsentInput = z.infer<typeof grantConsentSchema>;

/** Solicitação de URL assinada para upload de documento. */
export const documentUploadUrlSchema = z.object({
  caseId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(150),
});
export type DocumentUploadUrlInput = z.infer<typeof documentUploadUrlSchema>;

/** Registro dos metadados do documento após o upload direto ao Storage. */
export const registerDocumentSchema = z.object({
  caseId: z.string().uuid(),
  storageKey: z.string().min(1).max(512),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(150),
  sizeBytes: z.number().int().nonnegative(),
  checksum: z.string().max(128).optional(),
});
export type RegisterDocumentInput = z.infer<typeof registerDocumentSchema>;

/** Aceite/recusa de uma oportunidade pelo advogado (Módulo C). */
export const respondAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
  decision: z.enum(['ACCEPT', 'DECLINE']),
  declineReason: z.string().max(500).optional(),
});
export type RespondAssignmentInput = z.infer<typeof respondAssignmentSchema>;

/** Rejeição de um cadastro de advogado pelo backoffice. */
export const rejectLawyerSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type RejectLawyerInput = z.infer<typeof rejectLawyerSchema>;

/** Recusa de uma oportunidade pelo advogado. */
export const declineOpportunitySchema = z.object({
  reason: z.string().max(500).optional(),
});
export type DeclineOpportunityInput = z.infer<typeof declineOpportunitySchema>;

/** Criação de etapa do Kanban (configurável). */
export const createKanbanStageSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().max(20).optional(),
});
export type CreateKanbanStageInput = z.infer<typeof createKanbanStageSchema>;

/** Mover um card (caso aceito) para outra etapa do Kanban. */
export const moveKanbanCardSchema = z.object({
  kanbanStageId: z.string().uuid(),
});
export type MoveKanbanCardInput = z.infer<typeof moveKanbanCardSchema>;

/** Criação de uma peça (documento gerado). */
export const createPecaSchema = z.object({
  caseId: z.string().uuid(),
  type: z.enum(['DRAFT_PETITION', 'PETITION', 'TRIAGE_REPORT', 'OTHER']).default('DRAFT_PETITION'),
  title: z.string().min(1).max(200),
  content: z.string().max(100_000).default(''),
});
export type CreatePecaInput = z.infer<typeof createPecaSchema>;

/** Atualização de uma peça. */
export const updatePecaSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(100_000),
});
export type UpdatePecaInput = z.infer<typeof updatePecaSchema>;

/** Pedido de assistência de IA no editor de peças. */
export const pecaAiSchema = z.object({
  caseId: z.string().uuid(),
  instruction: z.string().min(1).max(4_000),
  currentContent: z.string().max(100_000).optional(),
});
export type PecaAiInput = z.infer<typeof pecaAiSchema>;

/** Validação de OAB no cadastro do advogado. */
export const lawyerRegistrationSchema = z.object({
  fullName: z.string().min(3).max(200),
  oabNumber: z.string().min(2).max(20),
  oabState: z.string().length(2),
  specialties: z.array(z.string()).min(1, 'Selecione ao menos uma área de atuação.'),
});
export type LawyerRegistrationInput = z.infer<typeof lawyerRegistrationSchema>;
