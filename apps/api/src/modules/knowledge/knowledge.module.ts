import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { RagService } from './rag.service';

@Module({
  controllers: [KnowledgeController],
  providers: [RagService],
  exports: [RagService],
})
export class KnowledgeModule {}
