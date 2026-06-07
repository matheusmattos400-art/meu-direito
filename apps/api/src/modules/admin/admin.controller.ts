import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import {
  adminCreateLawyerSchema,
  createAdminSchema,
  createPlanSchema,
  rejectLawyerSchema,
  setAdminScopesSchema,
  type AdminCreateLawyerInput,
  type CreateAdminInput,
  type CreatePlanInput,
  type RejectLawyerInput,
  type SetAdminScopesInput,
} from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { OwnerOnly, RequireScope } from '../../common/auth/scopes.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('lawyers')
  @RequireScope('ADVOGADOS')
  @ApiOperation({ summary: 'Lista os advogados (status, estado, nº de processos).' })
  lawyers() {
    return this.admin.listLawyers().then((data) => ({ data }));
  }

  @Post('lawyers')
  @RequireScope('ADVOGADOS')
  @ApiOperation({ summary: 'Cria um advogado diretamente (com login e senha).' })
  createLawyer(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(adminCreateLawyerSchema)) dto: AdminCreateLawyerInput,
  ) {
    return this.admin.createLawyer(user, dto).then((data) => ({ data }));
  }

  @Get('finance')
  @RequireScope('FINANCEIRO')
  @ApiOperation({ summary: 'Visão financeira (assinaturas, MRR, pagamentos, advogados por estado).' })
  finance() {
    return this.admin.finance().then((data) => ({ data }));
  }

  @Get('finance/sheet')
  @RequireScope('FINANCEIRO')
  @ApiOperation({ summary: 'Planilha de pagamentos por advogado (status, casos no mês, atraso).' })
  financeSheet() {
    return this.admin.paymentSheet().then((data) => ({ data }));
  }

  @Get('finance/evolution')
  @RequireScope('FINANCEIRO')
  @ApiOperation({ summary: 'Evolução do número de advogados por mês (filtro de data).' })
  financeEvolution(@Query('from') from?: string, @Query('to') to?: string) {
    return this.admin.evolution(from, to).then((data) => ({ data }));
  }

  @Post('plans')
  @RequireScope('FINANCEIRO')
  @ApiOperation({ summary: 'Cria um novo plano de assinatura.' })
  createPlan(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createPlanSchema)) dto: CreatePlanInput,
  ) {
    return this.admin.createPlan(user, dto).then((data) => ({ data }));
  }

  @Get('lawyers/:lawyerId')
  @RequireScope('ADVOGADOS')
  @ApiOperation({ summary: 'Ficha completa do advogado (formulário + documentos).' })
  lawyerDetail(@Param('lawyerId', ParseUUIDPipe) lawyerId: string) {
    return this.admin.getLawyerDetail(lawyerId).then((data) => ({ data }));
  }

  @Post('lawyers/:lawyerId/activate')
  @RequireScope('ADVOGADOS')
  @ApiOperation({ summary: 'Ativa a conta do advogado (cadastro aprovado).' })
  activate(@CurrentUser() user: User, @Param('lawyerId', ParseUUIDPipe) lawyerId: string) {
    return this.admin.activateLawyer(user, lawyerId).then((data) => ({ data }));
  }

  @Post('lawyers/:lawyerId/reject')
  @RequireScope('ADVOGADOS')
  @ApiOperation({ summary: 'Rejeita o cadastro de um advogado.' })
  reject(
    @CurrentUser() user: User,
    @Param('lawyerId', ParseUUIDPipe) lawyerId: string,
    @Body(new ZodValidationPipe(rejectLawyerSchema)) dto: RejectLawyerInput,
  ) {
    return this.admin.rejectLawyer(user, lawyerId, dto).then((data) => ({ data }));
  }

  @Post('lawyers/:lawyerId/cancel')
  @RequireScope('ADVOGADOS')
  @ApiOperation({ summary: 'Cancela a conta do advogado.' })
  cancel(@CurrentUser() user: User, @Param('lawyerId', ParseUUIDPipe) lawyerId: string) {
    return this.admin.cancelLawyer(user, lawyerId).then((data) => ({ data }));
  }

  // -------- Gestão de administradores (somente o dono) --------
  @Get('admins')
  @RequireScope('USUARIOS')
  @ApiOperation({ summary: 'Lista os administradores e seus escopos.' })
  admins() {
    return this.admin.listAdmins().then((data) => ({ data }));
  }

  @Get('users')
  @RequireScope('USUARIOS')
  @ApiOperation({ summary: 'Lista usuários.' })
  users() {
    return this.admin.listUsers().then((data) => ({ data }));
  }

  @Post('admins')
  @OwnerOnly()
  @ApiOperation({ summary: 'Cria um administrador (login, senha e escopos).' })
  createAdmin(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createAdminSchema)) dto: CreateAdminInput,
  ) {
    return this.admin.createAdmin(user, dto).then((data) => ({ data }));
  }

  @Post('admins/:userId/scopes')
  @OwnerOnly()
  @ApiOperation({ summary: 'Define os escopos de acesso de um administrador.' })
  setScopes(
    @CurrentUser() user: User,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(setAdminScopesSchema)) dto: SetAdminScopesInput,
  ) {
    return this.admin.setAdminScopes(user, userId, dto.scopes).then((data) => ({ data }));
  }

  @Post('admins/:userId/remove')
  @OwnerOnly()
  @ApiOperation({ summary: 'Remove o acesso de administrador.' })
  removeAdmin(@CurrentUser() user: User, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.admin.removeAdmin(user, userId).then((data) => ({ data }));
  }

  @Get('audit')
  @ApiOperation({ summary: 'Lista os registros de auditoria mais recentes.' })
  audit() {
    return this.admin.listAuditLogs().then((data) => ({ data }));
  }

  @Get('stats')
  @ApiOperation({ summary: 'Métricas de BI (cadastros, casos por categoria/status/cidade, conversão).' })
  stats() {
    return this.admin.stats().then((data) => ({ data }));
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Contadores para os badges do menu (chamados abertos, advogados em análise).' })
  notifications() {
    return this.admin.notifications().then((data) => ({ data }));
  }

  @Get('people')
  @RequireScope('CADASTROS')
  @ApiOperation({ summary: 'Pessoas cadastradas (nome, telefone, região, sexo).' })
  people() {
    return this.admin.listPeople().then((data) => ({ data }));
  }
}
