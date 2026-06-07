import { z } from 'zod';

/**
 * Validação das variáveis de ambiente no boot da API.
 * Falha cedo (fail-fast) se a configuração estiver inválida.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3333),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória.'),
  // Opcional em dev (sem auth o boot ainda funciona); o guard exige quando usado.
  // Aceita vazio (tratado como ausente) para conviver com .env de desenvolvimento.
  SUPABASE_JWT_SECRET: z.string().optional(),
  // Supabase (Auth via JWKS + Storage).
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().optional().default('documents'),
  // E-mails (separados por vírgula) promovidos a ADMIN no provisionamento.
  ADMIN_EMAILS: z.string().optional().default(''),
  // Atalho de autenticação SOMENTE para desenvolvimento (ignorado em produção).
  DEV_AUTH_BYPASS: z.string().optional().default('false'),
  RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const errors = JSON.stringify(parsed.error.flatten().fieldErrors, null, 2);
    throw new Error(`Configuração de ambiente inválida:\n${errors}`);
  }
  return parsed.data;
}
