import {
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  IsString,
} from 'class-validator';
import { BetStatus } from '../entities/bet.entity';

export class ResolveBetDto {
  @IsEnum(BetStatus)
  status: BetStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  cashoutAmount?: number;

  @IsOptional()
  @IsString()
  postNotes?: string;
}
