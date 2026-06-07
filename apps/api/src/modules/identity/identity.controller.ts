import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import {
  lawyerRegistrationSchema,
  type LawyerRegistrationInput,
} from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
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
}
