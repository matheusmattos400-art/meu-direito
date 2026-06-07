import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import {
  openTicketSchema,
  supportAttachmentUrlSchema,
  ticketMessageSchema,
  type OpenTicketInput,
  type SupportAttachmentUrlInput,
  type TicketMessageInput,
} from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Abre um chamado de suporte.' })
  open(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(openTicketSchema)) dto: OpenTicketInput,
  ) {
    return this.support.open(user, dto).then((data) => ({ data }));
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Lista meus chamados.' })
  myTickets(@CurrentUser() user: User) {
    return this.support.myTickets(user).then((data) => ({ data }));
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Abre a conversa de um chamado meu.' })
  myTicket(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.support.myTicket(user, id).then((data) => ({ data }));
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Envia uma mensagem (texto e/ou anexo) no chamado.' })
  reply(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ticketMessageSchema)) dto: TicketMessageInput,
  ) {
    return this.support.reply(user, id, dto, false).then((data) => ({ data }));
  }

  @Post('tickets/:id/attachment-url')
  @ApiOperation({ summary: 'URL assinada para anexar arquivo no chat.' })
  attachmentUrl(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(supportAttachmentUrlSchema)) dto: SupportAttachmentUrlInput,
  ) {
    return this.support
      .attachmentUploadUrl(user, id, dto.fileName, dto.mimeType, false)
      .then((data) => ({ data }));
  }
}
