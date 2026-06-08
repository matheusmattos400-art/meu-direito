import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { LawyerModule } from './common/lawyer/lawyer.module';
import { StorageModule } from './common/storage/storage.module';
import { DatajudModule } from './common/datajud/datajud.module';
import { SupabaseAuthGuard } from './common/auth/supabase-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { ScopesGuard } from './common/auth/scopes.guard';
import { IdentityModule } from './modules/identity/identity.module';
import { CasosModule } from './modules/casos/casos.module';
import { OportunidadesModule } from './modules/oportunidades/oportunidades.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { AdminModule } from './modules/admin/admin.module';
import { ConsentModule } from './modules/consent/consent.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { PecasModule } from './modules/pecas/pecas.module';
import { ProcessosModule } from './modules/processos/processos.module';
import { JulgadosModule } from './modules/julgados/julgados.module';
import { BillingModule } from './modules/billing/billing.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { SupportModule } from './modules/support/support.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Lê o .env da raiz do monorepo (e também um .env local em apps/api).
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    LawyerModule,
    StorageModule,
    DatajudModule,
    IdentityModule,
    CasosModule,
    OportunidadesModule,
    WorkspaceModule,
    AdminModule,
    ConsentModule,
    DocumentsModule,
    PecasModule,
    ProcessosModule,
    JulgadosModule,
    BillingModule,
    KnowledgeModule,
    CatalogModule,
    SupportModule,
  ],
  controllers: [HealthController],
  providers: [
    // Ordem importa: rate limit → autenticação → autorização (RBAC).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ScopesGuard },
  ],
})
export class AppModule {}
