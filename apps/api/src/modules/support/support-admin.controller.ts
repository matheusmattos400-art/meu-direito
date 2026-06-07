import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import {
  assignLawyerSchema,
  grantAccessSchema,
  supportAttachmentUrlSchema,
  ticketMessageSchema,
  updateTicketSchema,
  type AssignLawyerInput,
  type GrantAccessInput,
  type SupportAttachmentUrlInput,
  type TicketMessageInput,
  type UpdateTicketInput,
} from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { RequireScope } from '../../common/auth/scopes.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SupportService } from './support.service';

@ApiTags('support-admin')
@ApiBearerAuth()
@Roles('ADMIN')
@RequireScope('SUPORTE')
@Controller('admin/support')
export class SupportAdminController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'Lista chamados (filtra por status e tipo de solicitante).' })
  list(@Query('status') status?: string, @Query('requesterRole') requesterRole?: string) {
    return this.support.adminList(status, requesterRole).then((data) => ({ data }));
  }

  @Get('lawyers')
  @ApiOperation({ summary: 'Lista advogados ativos (filtra por estado/região).' })
  lawyers(@Query('state') state?: string) {
    return this.support.listActiveLawyers(state).then((data) => ({ data }));
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Abre a conversa de um chamado (com advogado do cliente).' })
  ticket(@Param('id', ParseUUIDPipe) id: string) {
    return this.support.adminTicket(id).then((data) => ({ data }));
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Responde a um chamado (texto e/ou anexo).' })
  reply(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ticketMessageSchema)) dto: TicketMessageInput,
  ) {
    return this.support.reply(user, id, dto, true).then((data) => ({ data }));
  }

  @Post('tickets/:id/attachment-url')
  @ApiOperation({ summary: 'URL assinada para anexar boleto/documento no chat.' })
  attachmentUrl(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(supportAttachmentUrlSchema)) dto: SupportAttachmentUrlInput,
  ) {
    return this.support
      .attachmentUploadUrl(user, id, dto.fileName, dto.mimeType, true)
      .then((data) => ({ data }));
  }

  @Post('tickets/:id/status')
  @ApiOperation({ summary: 'Atualiza o status do chamado (em andamento / resolvido).' })
  setStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTicketSchema)) dto: UpdateTicketInput,
  ) {
    return this.support.setStatus(user, id, dto.status).then((data) => ({ data }));
  }

  @Post('tickets/:id/assign-lawyer')
  @ApiOperation({ summary: 'Atribui (ou substitui) o advogado do cliente.' })
  assignLawyer(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(assignLawyerSchema)) dto: AssignLawyerInput,
  ) {
    return this.support.assignLawyer(user, id, dto.lawyerId).then((data) => ({ data }));
  }

  @Post('tickets/:id/cancel-lawyer')
  @ApiOperation({ summary: 'Cancela o acesso do cliente com o advogado.' })
  cancelLawyer(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.support.cancelLawyer(user, id).then((data) => ({ data }));
  }

  @Post('tickets/:id/grant-access')
  @ApiOperation({ summary: 'Libera acesso do advogado por 7/30/60 dias.' })
  grantAccess(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(grantAccessSchema)) dto: GrantAccessInput,
  ) {
    return this.support.grantAccess(user, id, dto.days).then((data) => ({ data }));
  }
}
