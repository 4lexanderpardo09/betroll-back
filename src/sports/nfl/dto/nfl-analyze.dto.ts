import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class NflAnalyzeDto {
  @IsString()
  homeTeam: string;

  @IsString()
  awayTeam: string;

  @IsString()
  matchDate: string; // ISO format: '2026-04-11'

  @IsOptional()
  @IsNumber()
  @Min(0)
  userBankroll?: number;
}
