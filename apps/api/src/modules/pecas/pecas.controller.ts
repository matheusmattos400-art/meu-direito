import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import {
  createPecaSchema,
  pecaAiSchema,
  updatePecaSchema,
  type CreatePecaInput,
  type PecaAiInput,
  type UpdatePecaInput,
} from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PecasService } from './pecas.service';

@ApiTags('pecas')
@ApiBearerAuth()
@Roles('LAWYER')
@Controller('pecas')
export class PecasController {
  constructor(private readonly pecas: PecasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as peças de um caso.' })
  list(@CurrentUser() user: User, @Query('caseId', ParseUUIDPipe) caseId: string) {
    return this.pecas.list(user, caseId).then((data) => ({ data }));
  }

  // Importante: rota estática antes da rota com parâmetro (:id).
  @Get('documents')
  @ApiOperation({ summary: 'Documentos do caso (somente leitura) para o advogado.' })
  caseDocuments(@CurrentUser() user: User, @Query('caseId', ParseUUIDPipe) caseId: string) {
    return this.pecas.caseDocuments(user, caseId).then((data) => ({ data }));
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova peça.' })
  create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createPecaSchema)) dto: CreatePecaInput,
  ) {
    return this.pecas.create(user, dto).then((data) => ({ data }));
  }

  @Post('ai')
  @ApiOperation({ summary: 'Assistência de IA contextual no editor de peças.' })
  ai(@CurrentUser() user: User, @Body(new ZodValidationPipe(pecaAiSchema)) dto: PecaAiInput) {
    return this.pecas.aiAssist(user, dto).then((data) => ({ data }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtém uma peça.' })
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.pecas.get(user, id).then((data) => ({ data }));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza o conteúdo de uma peça (nova versão).' })
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePecaSchema)) dto: UpdatePecaInput,
  ) {
    return this.pecas.update(user, id, dto).then((data) => ({ data }));
  }
}
