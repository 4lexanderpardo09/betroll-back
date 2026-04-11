import { Module } from '@nestjs/common';
import { NbaController } from './nba.controller';
import { NbaAnalysisService } from './nba-analysis.service';
import { NbaPromptBuilder } from './nba-prompt.builder';

@Module({
  providers: [NbaAnalysisService, NbaPromptBuilder],
  controllers: [NbaController],
  exports: [NbaAnalysisService],
})
export class NbaModule {}
