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

/** Escopos de acesso do administrador (abas do backoffice). */
export const adminScopeSchema = z.enum(['ADVOGADOS', 'FINANCEIRO', 'USUARIOS', 'SUPORTE']);
export type AdminScopeInput = z.infer<typeof adminScopeSchema>;

/** Criação de um administrador (somente o dono). */
export const createAdminSchema = z.object({
  fullName: z.string().min(3, 'Informe o nome.').max(200),
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.').max(100),
  scopes: z.array(adminScopeSchema).default([]),
});
export type CreateAdminInput = z.infer<typeof createAdminSchema>;

/** Atualização dos escopos de um administrador. */
export const setAdminScopesSchema = z.object({
  scopes: z.array(adminScopeSchema),
});
export type SetAdminScopesInput = z.infer<typeof setAdminScopesSchema>;

/** Abertura de um chamado de suporte. */
export const openTicketSchema = z.object({
  subject: z.string().min(3, 'Descreva o assunto.').max(160),
  message: z.string().min(1, 'Escreva sua mensagem.').max(5000),
});
export type OpenTicketInput = z.infer<typeof openTicketSchema>;

/** Mensagem em um chamado de suporte (texto e/ou anexo). */
export const ticketMessageSchema = z
  .object({
    body: z.string().max(5000).optional().default(''),
    attachmentKey: z.string().max(512).optional(),
    attachmentName: z.string().max(255).optional(),
    attachmentMime: z.string().max(150).optional(),
  })
  .refine((d) => (d.body && d.body.trim().length > 0) || d.attachmentKey, {
    message: 'Escreva uma mensagem ou anexe um arquivo.',
  });
export type TicketMessageInput = z.infer<typeof ticketMessageSchema>;

/** URL assinada para anexar um arquivo (boleto/documento) no chat de suporte. */
export const supportAttachmentUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(150),
});
export type SupportAttachmentUrlInput = z.infer<typeof supportAttachmentUrlSchema>;

/** Atribuição de advogado a um cliente, a partir do suporte. */
export const assignLawyerSchema = z.object({
  lawyerId: z.string().uuid(),
});
export type AssignLawyerInput = z.infer<typeof assignLawyerSchema>;

/** Liberação manual de acesso de um advogado (7/30/60 dias) pelo suporte. */
export const grantAccessSchema = z.object({
  days: z.coerce.number().int().refine((d) => [7, 30, 60].includes(d), 'Período inválido (7, 30 ou 60).'),
});
export type GrantAccessInput = z.infer<typeof grantAccessSchema>;

/** Atualização de status de um chamado (admin). */
export const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']),
});
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

/** Criação de um plano SaaS (backoffice). */
export const createPlanSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_]+$/, 'Código em maiúsculas, números e _ (ex.: PREMIUM).'),
  name: z.string().min(2).max(60),
  priceBRL: z.coerce.number().nonnegative('Preço inválido.'),
  casesPerMonth: z.coerce.number().int().nonnegative().default(0),
  // Áreas inteiras (todos os sub-temas) incluídas no combo.
  areaIds: z.array(z.string().uuid()).default([]),
  // Sub-temas específicos incluídos no combo.
  subcategoryIds: z.array(z.string().uuid()).default([]),
  highlights: z.array(z.string().max(80)).max(8).default([]),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

/** Criação de um sub-tema dentro de uma área (ex.: Família em Direito Civil). */
export const createSubareaSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(2).max(60),
});
export type CreateSubareaInput = z.infer<typeof createSubareaSchema>;

/** Edição de um plano combo existente (campos opcionais). */
export const updatePlanSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  priceBRL: z.coerce.number().nonnegative('Preço inválido.').optional(),
  casesPerMonth: z.coerce.number().int().nonnegative().optional(),
  areaIds: z.array(z.string().uuid()).optional(),
  subcategoryIds: z.array(z.string().uuid()).optional(),
  highlights: z.array(z.string().max(80)).max(8).optional(),
  active: z.boolean().optional(),
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

/** Preço mensal de uma área do Direito (definido pelo admin). */
export const areaPriceSchema = z.object({
  priceBRL: z.coerce.number().nonnegative('Preço inválido.'),
  billable: z.boolean().default(true),
});
export type AreaPriceInput = z.infer<typeof areaPriceSchema>;

/** Assinatura de um plano SaaS (advogado). */
export const subscribeSchema = z.object({
  planCode: z.string().min(1).max(40),
  method: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']).default('PIX'),
});
export type SubscribeInput = z.infer<typeof subscribeSchema>;

/**
 * Assinatura/atualização do combo do advogado: um plano combo (planCode) OU
 * um conjunto de áreas montado por ele (areaIds). Migrar/cancelar área = reenviar.
 */
export const subscribeComboSchema = z
  .object({
    planCode: z.string().min(1).max(40).optional(),
    areaIds: z.array(z.string().uuid()).optional(),
    method: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']).default('PIX'),
  })
  .refine((d) => !!d.planCode || (d.areaIds?.length ?? 0) > 0, {
    message: 'Escolha um combo ou ao menos uma área.',
  });
export type SubscribeComboInput = z.infer<typeof subscribeComboSchema>;

/** Adiciona um processo para acompanhamento (Datajud). */
export const addProcessSchema = z.object({
  processNumber: z
    .string()
    .min(15, 'Número de processo inválido.')
    .max(30)
    .regex(/[\d.\-]+/, 'Use apenas números e os separadores . -'),
  court: z.string().max(40).optional(),
  partyName: z.string().max(120).optional(),
  caseId: z.string().uuid().optional(),
});
export type AddProcessInput = z.infer<typeof addProcessSchema>;

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

/** Ingestão de um documento na base de conhecimento (RAG). */
export const ingestKnowledgeSchema = z.object({
  title: z.string().min(1).max(200),
  source: z.string().min(1).max(200),
  type: z.enum(['LEGISLATION', 'JURISPRUDENCE', 'ADMINISTRATIVE', 'INTERNAL']),
  content: z.string().min(20).max(200_000),
});
export type IngestKnowledgeInput = z.infer<typeof ingestKnowledgeSchema>;

/** URL assinada para upload de documento de verificação (ID/OAB/residência). */
export const verificationUploadUrlSchema = z.object({
  kind: z.enum(['IDENTITY', 'OAB', 'RESIDENCE', 'OTHER']),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(150),
});
export type VerificationUploadUrlInput = z.infer<typeof verificationUploadUrlSchema>;

/** Registro do documento de verificação após upload. */
export const registerVerificationDocSchema = z.object({
  kind: z.enum(['IDENTITY', 'OAB', 'RESIDENCE', 'OTHER']),
  storageKey: z.string().min(1).max(512),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(150),
  sizeBytes: z.number().int().nonnegative(),
});
export type RegisterVerificationDocInput = z.infer<typeof registerVerificationDocSchema>;

/** Cadastro completo do advogado (formulário do perfil profissional). */
export const lawyerRegistrationSchema = z.object({
  fullName: z.string().min(3, 'Informe o nome completo.').max(200),
  cpf: z.string().min(11, 'CPF inválido.').max(18),
  email: z.string().email('E-mail inválido.').optional(),
  phone: z.string().min(8, 'Telefone inválido.').max(20),
  phone2: z.string().max(20).optional(),
  gender: z.enum(['M', 'F', 'OUTRO']).optional(),
  birthDate: z.string().min(8, 'Informe a data de nascimento.'),
  oabNumber: z.string().min(2, 'Informe o número da OAB.').max(20),
  oabState: z.string().length(2, 'UF da OAB com 2 letras.'),
  city: z.string().max(120).optional(),
  avatarUrl: z.string().url('URL de foto inválida.').max(500).optional().or(z.literal('')),
  residentialAddress: z.string().min(5, 'Informe o endereço residencial.').max(300),
  professionalAddress: z.string().min(5, 'Informe o endereço profissional.').max(300),
  specialties: z.array(z.string()).min(1, 'Selecione ao menos uma área de atuação.'),
});
export type LawyerRegistrationInput = z.infer<typeof lawyerRegistrationSchema>;

/** Criação de advogado diretamente pelo backoffice (com login e senha). */
export const adminCreateLawyerSchema = z.object({
  fullName: z.string().min(3, 'Informe o nome completo.').max(200),
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.').max(100),
  cpf: z.string().min(11, 'CPF inválido.').max(18),
  phone: z.string().min(8, 'Telefone inválido.').max(20),
  phone2: z.string().max(20).optional(),
  gender: z.enum(['M', 'F', 'OUTRO']).optional(),
  birthDate: z.string().optional(),
  oabNumber: z.string().min(2).max(20),
  oabState: z.string().length(2),
  city: z.string().max(120).optional(),
  avatarUrl: z.string().url('URL de foto inválida.').max(500).optional().or(z.literal('')),
  residentialAddress: z.string().max(300).optional(),
  professionalAddress: z.string().max(300).optional(),
  specialties: z.array(z.string()).min(1, 'Selecione ao menos uma área.'),
  status: z.enum(['PRE_REGISTRATION', 'IN_ANALYSIS', 'ACTIVE']).default('ACTIVE'),
});
export type AdminCreateLawyerInput = z.infer<typeof adminCreateLawyerSchema>;

/** Aceite do termo de responsabilidade do advogado. */
export const acceptTermSchema = z.object({
  accepted: z.literal(true),
});
export type AcceptTermInput = z.infer<typeof acceptTermSchema>;

/** Tipos de documento exigidos do advogado. */
export const documentKindSchema = z.enum(['IDENTITY', 'OAB', 'RESIDENCE', 'OTHER']);
export type DocumentKindInput = z.infer<typeof documentKindSchema>;
