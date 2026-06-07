import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import {
  lawyerRegistrationSchema,
  registerVerificationDocSchema,
  verificationUploadUrlSchema,
  type LawyerRegistrationInput,
  type RegisterVerificationDocInput,
  type VerificationUploadUrlInput,
} from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { IdentityService } from './identity.service';

@ApiTags('identity')
@ApiBearerAuth()
@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna o perfil do usuário autenticado.' })
  me(@CurrentUser() user: User) {
    return { data: this.identity.toProfile(user) };
  }

  @Post('lawyers/register')
  @ApiOperation({ summary: 'Cadastra o perfil de advogado (validação de OAB no backoffice).' })
  registerLawyer(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(lawyerRegistrationSchema))
    dto: LawyerRegistrationInput,
  ) {
    return this.identity.registerLawyer(user, dto).then((data) => ({ data }));
  }

  @Get('lawyers/me')
  @Roles('LAWYER')
  @ApiOperation({ summary: 'Perfil do advogado atual (status de verificação).' })
  myLawyer(@CurrentUser() user: User) {
    return this.identity.getMyLawyer(user).then((data) => ({ data }));
  }

  @Post('lawyers/verification-documents/upload-url')
  @Roles('LAWYER')
  @ApiOperation({ summary: 'URL assinada para enviar o comprovante de OAB.' })
  verificationUploadUrl(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(verificationUploadUrlSchema)) dto: VerificationUploadUrlInput,
  ) {
    return this.identity.verificationUploadUrl(user, dto).then((data) => ({ data }));
  }

  @Post('lawyers/verification-documents')
  @Roles('LAWYER')
  @ApiOperation({ summary: 'Registra o comprovante de OAB enviado.' })
  registerVerificationDoc(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(registerVerificationDocSchema)) dto: RegisterVerificationDocInput,
  ) {
    return this.identity.registerVerificationDoc(user, dto).then((data) => ({ data }));
  }

  @Get('lawyers/verification-documents')
  @Roles('LAWYER')
  @ApiOperation({ summary: 'Lista os comprovantes de OAB do advogado atual.' })
  listVerificationDocs(@CurrentUser() user: User) {
    return this.identity.listVerificationDocs(user).then((data) => ({ data }));
  }
}
