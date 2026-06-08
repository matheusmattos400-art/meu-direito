import { Module } from '@nestjs/common';
import { JulgadosController } from './julgados.controller';
import { JulgadosService } from './julgados.service';

@Module({
  controllers: [JulgadosController],
  providers: [JulgadosService],
})
export class JulgadosModule {}
