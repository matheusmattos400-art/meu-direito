import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { LawyerModule } from './common/lawyer/lawyer.module';
import { SupabaseAuthGuard } from './common/auth/supabase-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { IdentityModule } from './modules/identity/identity.module';
import { CasosModule } from './modules/casos/casos.module';
import { OportunidadesModule } from './modules/oportunidades/oportunidades.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    LawyerModule,
    IdentityModule,
    CasosModule,
    OportunidadesModule,
    WorkspaceModule,
    AdminModule,
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
