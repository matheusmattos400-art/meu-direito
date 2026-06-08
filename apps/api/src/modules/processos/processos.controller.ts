import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import { addProcessSchema, type AddProcessInput } from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ProcessosService } from './processos.service';

@ApiTags('processos')
@ApiBearerAuth()
@Controller('processos')
export class ProcessosController {
  constructor(private readonly processos: ProcessosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os processos acompanhados ("Meus Processos").' })
  list(@CurrentUser() user: User) {
    return this.processos.list(user).then((data) => ({ data }));
  }

  @Post()
  @ApiOperation({ summary: 'Adiciona um processo para acompanhamento (Datajud).' })
  add(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(addProcessSchema)) dto: AddProcessInput,
  ) {
    return this.processos.add(user, dto).then((data) => ({ data }));
  }

  @Get('preview')
  @ApiOperation({ summary: 'Consulta um processo no Datajud sem salvar (prévia da busca).' })
  preview(@Query('number') number: string, @Query('court') court?: string) {
    return this.processos.preview(number, court).then((data) => ({ data }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um processo e seus movimentos (em linguagem simples).' })
  detail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.processos.detail(user, id).then((data) => ({ data }));
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Sincroniza os movimentos com o Datajud.' })
  sync(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.processos.sync(user, id).then((data) => ({ data }));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Encerra o acompanhamento de um processo.' })
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.processos.remove(user, id).then((data) => ({ data }));
  }
}
