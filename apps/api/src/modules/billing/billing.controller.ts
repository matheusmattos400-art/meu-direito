import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import { subscribeSchema, type SubscribeInput } from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BillingService } from './billing.service';

@ApiTags('billing')
@ApiBearerAuth()
@Roles('LAWYER')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Lista os planos de assinatura disponíveis.' })
  plans() {
    return { data: this.billing.listPlans() };
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Retorna a assinatura atual do advogado.' })
  subscription(@CurrentUser() user: User) {
    return this.billing.currentSubscription(user).then((data) => ({ data }));
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Assina ou atualiza um plano (cobrança por assinatura).' })
  subscribe(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(subscribeSchema)) dto: SubscribeInput,
  ) {
    return this.billing.subscribe(user, dto).then((data) => ({ data }));
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancela a assinatura ativa.' })
  cancel(@CurrentUser() user: User) {
    return this.billing.cancel(user).then((data) => ({ data }));
  }
}
