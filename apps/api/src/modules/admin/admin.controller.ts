import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import { rejectLawyerSchema, type RejectLawyerInput } from '@app/validation';
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

  @Get('lawyers/pending')
  @ApiOperation({ summary: 'Lista advogados aguardando validação de OAB.' })
  pendingLawyers() {
    return this.admin.listPendingLawyers().then((data) => ({ data }));
  }

  @Post('lawyers/:lawyerId/verify')
  @ApiOperation({ summary: 'Valida a OAB de um advogado.' })
  verify(@CurrentUser() user: User, @Param('lawyerId', ParseUUIDPipe) lawyerId: string) {
    return this.admin.verifyLawyer(user, lawyerId).then((data) => ({ data }));
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

  @Get('users')
  @ApiOperation({ summary: 'Lista usuários.' })
  users() {
    return this.admin.listUsers().then((data) => ({ data }));
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
