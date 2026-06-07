import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import {
  adminCreateLawyerSchema,
  createPlanSchema,
  rejectLawyerSchema,
  type AdminCreateLawyerInput,
  type CreatePlanInput,
  type RejectLawyerInput,
} from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('lawyers')
  @ApiOperation({ summary: 'Lista os advogados (status, estado, nº de processos).' })
  lawyers() {
    return this.admin.listLawyers().then((data) => ({ data }));
  }

  @Post('lawyers')
  @ApiOperation({ summary: 'Cria um advogado diretamente (com login e senha).' })
  createLawyer(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(adminCreateLawyerSchema)) dto: AdminCreateLawyerInput,
  ) {
    return this.admin.createLawyer(user, dto).then((data) => ({ data }));
  }

  @Get('finance')
  @ApiOperation({ summary: 'Visão financeira (assinaturas, MRR, pagamentos, advogados por estado).' })
  finance() {
    return this.admin.finance().then((data) => ({ data }));
  }

  @Get('finance/sheet')
  @ApiOperation({ summary: 'Planilha de pagamentos por advogado (status, casos no mês).' })
  financeSheet() {
    return this.admin.paymentSheet().then((data) => ({ data }));
  }

  @Post('plans')
  @ApiOperation({ summary: 'Cria um novo plano de assinatura.' })
  createPlan(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createPlanSchema)) dto: CreatePlanInput,
  ) {
    return this.admin.createPlan(user, dto).then((data) => ({ data }));
  }

  @Get('lawyers/:lawyerId')
  @ApiOperation({ summary: 'Ficha completa do advogado (formulário + documentos).' })
  lawyerDetail(@Param('lawyerId', ParseUUIDPipe) lawyerId: string) {
    return this.admin.getLawyerDetail(lawyerId).then((data) => ({ data }));
  }

  @Post('lawyers/:lawyerId/activate')
  @ApiOperation({ summary: 'Ativa a conta do advogado (cadastro aprovado).' })
  activate(@CurrentUser() user: User, @Param('lawyerId', ParseUUIDPipe) lawyerId: string) {
    return this.admin.activateLawyer(user, lawyerId).then((data) => ({ data }));
  }

  @Post('lawyers/:lawyerId/reject')
  @ApiOperation({ summary: 'Rejeita o cadastro de um advogado.' })
  reject(
    @CurrentUser() user: User,
    @Param('lawyerId', ParseUUIDPipe) lawyerId: string,
    @Body(new ZodValidationPipe(rejectLawyerSchema)) dto: RejectLawyerInput,
  ) {
    return this.admin.rejectLawyer(user, lawyerId, dto).then((data) => ({ data }));
  }

  @Post('lawyers/:lawyerId/cancel')
  @ApiOperation({ summary: 'Cancela a conta do advogado.' })
  cancel(@CurrentUser() user: User, @Param('lawyerId', ParseUUIDPipe) lawyerId: string) {
    return this.admin.cancelLawyer(user, lawyerId).then((data) => ({ data }));
  }

  @Get('users')
  @ApiOperation({ summary: 'Lista usuários.' })
  users() {
    return this.admin.listUsers().then((data) => ({ data }));
  }

  @Post('users/:userId/promote')
  @ApiOperation({ summary: 'Promove um usuário a administrador (sem exigir OAB).' })
  promote(@CurrentUser() user: User, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.admin.promoteToAdmin(user, userId).then((data) => ({ data }));
  }

  @Post('users/:userId/revoke-admin')
  @ApiOperation({ summary: 'Remove o acesso de administrador de um usuário.' })
  revoke(@CurrentUser() user: User, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.admin.revokeAdmin(user, userId).then((data) => ({ data }));
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
}
