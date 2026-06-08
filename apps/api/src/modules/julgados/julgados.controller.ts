import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JulgadosService } from './julgados.service';

@ApiTags('julgados')
@ApiBearerAuth()
@Controller('julgados')
export class JulgadosController {
  constructor(private readonly julgados: JulgadosService) {}

  @Get('courts')
  @ApiOperation({ summary: 'Tribunais com julgados indexados (para o filtro).' })
  courts() {
    return this.julgados.courts().then((data) => ({ data }));
  }

  @Get()
  @ApiOperation({ summary: 'Busca de julgados por tema (full-text), filtro por tribunal e paginação.' })
  search(
    @Query('q') q?: string,
    @Query('courts') courts?: string,
    @Query('page') page?: string,
  ) {
    if (!q || !q.trim()) {
      return Promise.resolve({ data: { items: [], page: 0, hasMore: false } });
    }
    const courtList = (courts ?? '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const pageNum = Number.parseInt(page ?? '0', 10) || 0;
    return this.julgados.search(q.trim(), courtList, pageNum).then((data) => ({ data }));
  }
}
