import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';

export enum SportEnum {
  BASKETBALL = 'BASKETBALL',
  FOOTBALL = 'FOOTBALL',
  TENNIS = 'TENNIS',
  OTHER = 'OTHER',
}

export class AnalyzeBetDto {
  @IsString()
  homeTeam: string;

  @IsString()
  awayTeam: string;

  @IsEnum(SportEnum)
  sport: SportEnum;

  @IsOptional()
  @IsString()
  tournament?: string;

  @IsOptional()
  @IsString()
  eventDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  userOdds?: number;

  @IsOptional()
  @IsString()
  userSportsbook?: string;
}
