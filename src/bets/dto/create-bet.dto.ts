import {
  IsString,
  IsEnum,
  IsNumber,
  IsDateString,
  IsOptional,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Sport, BetType } from '../entities/bet.entity';

export class CreateBetDto {
  @IsEnum(Sport)
  sport: Sport;

  @IsString()
  tournament: string;

  @IsString()
  homeTeam: string;

  @IsString()
  awayTeam: string;

  @IsDateString()
  eventDate: string;

  @IsEnum(BetType)
  betType: BetType;

  @IsString()
  selection: string;

  @IsNumber()
  @Min(1.01)
  odds: number;

  @IsInt()
  @Min(500)
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  confidence?: number;

  @IsOptional()
  @IsString()
  reasoning?: string;
}

export class ResolveBetDto {
  @IsEnum(['WON', 'LOST', 'VOID', 'CASHOUT'])
  status: 'WON' | 'LOST' | 'VOID' | 'CASHOUT';

  @IsOptional()
  @IsInt()
  @Min(0)
  cashoutAmount?: number;

  @IsOptional()
  @IsString()
  postNotes?: string;
}

export class UpdateBetDto {
  @IsOptional()
  @IsString()
  tournament?: string;

  @IsOptional()
  @IsString()
  homeTeam?: string;

  @IsOptional()
  @IsString()
  awayTeam?: string;

  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsEnum(BetType)
  betType?: BetType;

  @IsOptional()
  @IsString()
  selection?: string;

  @IsOptional()
  @IsNumber()
  @Min(1.01)
  odds?: number;

  @IsOptional()
  @IsInt()
  @Min(500)
  amount?: number;

  @IsOptional()
  @IsString()
  reasoning?: string;
}
