import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import {
  sendTriageMessageSchema,
  startTriageSchema,
  type SendTriageMessageInput,
  type StartTriageInput,
} from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CasosService } from './casos.service';

@ApiTags('casos')
@ApiBearerAuth()
@Controller('cases')
export class CasosController {
  constructor(private readonly casos: CasosService) {}

  @Post()
  @ApiOperation({ summary: 'Inicia a triagem de um novo caso a partir do relato do cidadão.' })
  start(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(startTriageSchema)) dto: StartTriageInput,
  ) {
    return this.casos.startTriage(user, dto).then((data) => ({ data }));
  }

  @Get()
  @ApiOperation({ summary: 'Lista os casos do cidadão autenticado ("Meus Casos").' })
  list(@CurrentUser() user: User) {
    return this.casos.listMyCases(user).then((data) => ({ data }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um caso e o histórico do chat de triagem.' })
  detail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.casos.getCaseDetail(user, id).then((data) => ({ data }));
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Envia uma mensagem ao assistente de triagem.' })
  message(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(sendTriageMessageSchema)) dto: SendTriageMessageInput,
  ) {
    return this.casos.sendMessage(user, id, dto).then((data) => ({ data }));
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Gera a análise estruturada (classificação, resumo, riscos, próximos passos).' })
  analyze(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.casos.analyze(user, id).then((data) => ({ data }));
  }
}
