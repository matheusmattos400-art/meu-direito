import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import {
  ticketMessageSchema,
  updateTicketSchema,
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

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Abre a conversa de um chamado.' })
  ticket(@Param('id', ParseUUIDPipe) id: string) {
    return this.support.adminTicket(id).then((data) => ({ data }));
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Responde a um chamado (chat).' })
  reply(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ticketMessageSchema)) dto: TicketMessageInput,
  ) {
    return this.support.reply(user, id, dto.body, true).then((data) => ({ data }));
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
}
