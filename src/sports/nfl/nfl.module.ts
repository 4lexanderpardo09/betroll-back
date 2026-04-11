import { Module } from '@nestjs/common';
import { NflController } from './nfl.controller';
import { NflAnalysisService } from './nfl-analysis.service';
import { NflPromptBuilder } from './nfl-prompt.builder';

@Module({
  providers: [NflAnalysisService, NflPromptBuilder],
  controllers: [NflController],
  exports: [NflAnalysisService],
})
export class NflModule {}
