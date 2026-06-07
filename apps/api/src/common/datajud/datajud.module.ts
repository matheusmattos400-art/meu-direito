import { Global, Module } from '@nestjs/common';
import { DatajudService } from './datajud.service';

@Global()
@Module({
  providers: [DatajudService],
  exports: [DatajudService],
})
export class DatajudModule {}
