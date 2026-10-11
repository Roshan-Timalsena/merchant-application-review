import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { RiskStatus } from '../enums/merchant-application.enums';

const DECISION_RISK = [
  RiskStatus.LOW,
  RiskStatus.MEDIUM,
  RiskStatus.HIGH,
] as const;

export class ReviewDecisionDto {
  @ApiProperty({ enum: DECISION_RISK, default: RiskStatus.LOW })
  @IsIn(DECISION_RISK)
  riskStatus: (typeof DECISION_RISK)[number] = RiskStatus.LOW;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
