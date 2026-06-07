import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { LawyerModule } from './common/lawyer/lawyer.module';
import { StorageModule } from './common/storage/storage.module';
import { SupabaseAuthGuard } from './common/auth/supabase-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { IdentityModule } from './modules/identity/identity.module';
import { CasosModule } from './modules/casos/casos.module';
import { OportunidadesModule } from './modules/oportunidades/oportunidades.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { AdminModule } from './modules/admin/admin.module';
import { ConsentModule } from './modules/consent/consent.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { PecasModule } from './modules/pecas/pecas.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    LawyerModule,
    StorageModule,
    IdentityModule,
    CasosModule,
    OportunidadesModule,
    WorkspaceModule,
    AdminModule,
    ConsentModule,
    DocumentsModule,
    PecasModule,
  ],
  controllers: [HealthController],
  providers: [
    // Ordem importa: rate limit → autenticação → autorização (RBAC).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
