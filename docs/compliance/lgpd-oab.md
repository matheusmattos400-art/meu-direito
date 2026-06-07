# Conformidade — LGPD e Ética OAB

Checklist vivo. Toda feature deve ser avaliada contra estes pontos.

## LGPD

- [ ] **Base legal + consentimento versionado** antes de coletar/tratar dados
      (`ConsentTerm` / `UserConsent`).
- [ ] **Consentimento específico de transferência internacional** antes de
      enviar dados (pseudonimizados) a LLM no exterior.
- [ ] **Minimização**: coletar só o necessário; localização em granularidade de município.
- [ ] **Pseudonimização de PII** antes do envio ao LLM (`@app/ai-core/guardrails/pii`).
- [ ] **Direito ao esquecimento**: `deletedAt` / `anonymizedAt` + rotina de anonimização.
- [ ] **DSR** (exportar / excluir dados do titular) desde o MVP.
- [ ] **Criptografia**: TLS em trânsito + repouso (Supabase) + documentos sensíveis.
- [ ] **Auditoria imutável** de acesso a dados pessoais (`AuditLog`).

## Ética OAB

- [ ] **Sem comissão por caso** — receita só por assinatura (garantido no schema).
- [ ] **Sem promessa de resultado** — disclaimer obrigatório da IA
      (`@app/ai-core/guardrails/disclaimer`).
- [ ] **Sem captação mercantil**; terminologia pública controlada (nunca "lead").
- [ ] **Validação final por advogado habilitado** sempre sinalizada.
- [ ] **Validação de OAB** no cadastro do advogado.

## Segurança

- [ ] RBAC (NestJS guards) + RLS (Postgres) — isolamento entre perfis.
- [ ] Rate limiting + monitoramento de abuso (endpoints de IA).
- [ ] Proteção contra prompt injection (separação estrutural instrução × dados).
- [ ] Signed URLs para documentos (nunca expor o bucket).
