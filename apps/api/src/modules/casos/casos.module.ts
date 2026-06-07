import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { CasosController } from './casos.controller';
import { CasosService } from './casos.service';

@Module({
  imports: [KnowledgeModule],
  controllers: [CasosController],
  providers: [CasosService],
  exports: [CasosService],
})
export class CasosModule {}
