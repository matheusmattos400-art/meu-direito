import { Global, Module } from '@nestjs/common';
import { LawyerContextService } from './lawyer-context.service';

@Global()
@Module({
  providers: [LawyerContextService],
  exports: [LawyerContextService],
})
export class LawyerModule {}
