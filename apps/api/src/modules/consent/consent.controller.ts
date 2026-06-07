import { Body, Controller, Get, Headers, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import { grantConsentSchema, type GrantConsentInput } from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ConsentService } from './consent.service';

@ApiTags('consent')
@ApiBearerAuth()
@Controller('consents')
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  @Get('required')
  @ApiOperation({ summary: 'Lista os termos vigentes e o status de consentimento do usuário.' })
  required(@CurrentUser() user: User) {
    return this.consent.listRequired(user).then((data) => ({ data }));
  }

  @Post()
  @ApiOperation({ summary: 'Concede ou revoga um consentimento (registra IP e User-Agent).' })
  set(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(grantConsentSchema)) dto: GrantConsentInput,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.consent.setConsent(user, dto, { ipAddress: ip, userAgent }).then((data) => ({ data }));
  }
}
