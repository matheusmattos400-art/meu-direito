import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import { declineOpportunitySchema, type DeclineOpportunityInput } from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OportunidadesService } from './oportunidades.service';

@ApiTags('oportunidades')
@ApiBearerAuth()
@Roles('LAWYER')
@Controller('opportunities')
export class OportunidadesController {
  constructor(private readonly oportunidades: OportunidadesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista oportunidades de atendimento nas áreas do advogado.' })
  list(@CurrentUser() user: User) {
    return this.oportunidades.list(user).then((data) => ({ data }));
  }

  @Post(':caseId/accept')
  @ApiOperation({ summary: 'Aceita uma oportunidade de atendimento.' })
  accept(@CurrentUser() user: User, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.oportunidades.accept(user, caseId).then((data) => ({ data }));
  }

  @Post(':caseId/decline')
  @ApiOperation({ summary: 'Recusa uma oportunidade de atendimento.' })
  decline(
    @CurrentUser() user: User,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body(new ZodValidationPipe(declineOpportunitySchema)) dto: DeclineOpportunityInput,
  ) {
    return this.oportunidades.decline(user, caseId, dto).then((data) => ({ data }));
  }
}
