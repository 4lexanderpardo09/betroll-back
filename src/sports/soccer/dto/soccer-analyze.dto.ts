import { IsString, IsOptional, IsNumber, Min, IsIn } from 'class-validator';

export class SoccerAnalyzeDto {
  @IsString()
  homeTeam: string;

  @IsString()
  awayTeam: string;

  @IsString()
  matchDate: string; // ISO format: '2026-04-11'

  @IsOptional()
  @IsString()
  league?: string; // e.g., 'eng.1' for EPL, 'esp.1' for La Liga

  @IsOptional()
  @IsNumber()
  @Min(0)
  userBankroll?: number;
}
