import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import {
  documentUploadUrlSchema,
  registerDocumentSchema,
  type DocumentUploadUrlInput,
  type RegisterDocumentInput,
} from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Gera URL assinada para upload (exige consentimento).' })
  uploadUrl(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(documentUploadUrlSchema)) dto: DocumentUploadUrlInput,
    @Ip() ip: string,
  ) {
    return this.documents.createUploadUrl(user, dto, { ip }).then((data) => ({ data }));
  }

  @Post()
  @ApiOperation({ summary: 'Registra os metadados do documento enviado.' })
  register(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(registerDocumentSchema)) dto: RegisterDocumentInput,
    @Ip() ip: string,
  ) {
    return this.documents.register(user, dto, { ip }).then((data) => ({ data }));
  }

  @Get()
  @ApiOperation({ summary: 'Lista os documentos de um caso com URLs de download.' })
  list(@CurrentUser() user: User, @Query('caseId', ParseUUIDPipe) caseId: string) {
    return this.documents.list(user, caseId).then((data) => ({ data }));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Exclui um documento (lógico + Storage).' })
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.documents.remove(user, id, { ip }).then((data) => ({ data }));
  }
}
