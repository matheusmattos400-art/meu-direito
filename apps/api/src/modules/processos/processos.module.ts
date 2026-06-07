import { Module } from '@nestjs/common';
import { ProcessosController } from './processos.controller';
import { ProcessosService } from './processos.service';

@Module({
  controllers: [ProcessosController],
  providers: [ProcessosService],
})
export class ProcessosModule {}
