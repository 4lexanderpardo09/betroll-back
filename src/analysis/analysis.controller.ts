import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
@UseGuards(JwtAuthGuard)
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * GET /analysis/:id
   * Get a specific analysis
   */
  @Get(':id')
  async getAnalysis(@Request() req: any, @Param('id') id: string) {
    const analysis = await this.analysisService.getAnalysis(req.user.sub, id);

    return {
      success: true,
      data: analysis,
    };
  }

  /**
   * GET /analysis
   * Get all analyses for the current user
   */
  @Get()
  async getUserAnalyses(@Request() req: any) {
    const analyses = await this.analysisService.getUserAnalyses(req.user.sub);

    return {
      success: true,
      data: analyses,
    };
  }
}
