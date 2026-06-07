import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import { ingestKnowledgeSchema, type IngestKnowledgeInput } from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RagService } from './rag.service';

@ApiTags('knowledge')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/knowledge')
export class KnowledgeController {
  constructor(private readonly rag: RagService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os documentos da base de conhecimento (RAG).' })
  list() {
    return this.rag.listDocuments().then((data) => ({ data }));
  }

  @Post()
  @ApiOperation({ summary: 'Ingere um documento na base (chunk + embeddings).' })
  ingest(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(ingestKnowledgeSchema)) dto: IngestKnowledgeInput,
  ) {
    return this.rag.ingest(user, dto).then((data) => ({ data }));
  }
}
