import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  ApplicationStatus,
  RiskStatus,
} from '../enums/merchant-application.enums';

export const UPDATE_STATUSES = [
  ApplicationStatus.APPROVED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.INFO_REQUESTED,
] as const;

export type UpdateStatusValue = (typeof UPDATE_STATUSES)[number];

const DECISION_RISK = [
  RiskStatus.LOW,
  RiskStatus.MEDIUM,
  RiskStatus.HIGH,
] as const;

export class UpdateStatusDto {
  @ApiProperty({ enum: UPDATE_STATUSES })
  @IsIn(UPDATE_STATUSES)
  status!: UpdateStatusValue;

  @ApiProperty({ enum: DECISION_RISK, required: false })
  @ValidateIf(
    (o: UpdateStatusDto) =>
      o.status === ApplicationStatus.APPROVED ||
      o.status === ApplicationStatus.REJECTED,
  )
  @IsIn(DECISION_RISK)
  riskStatus?: (typeof DECISION_RISK)[number];

  @ApiPropertyOptional({
    description:
      'Required when status is info_requested; optional for approved/rejected',
  })
  @ValidateIf(
    (o: UpdateStatusDto) => o.status === ApplicationStatus.INFO_REQUESTED,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  notes?: string;
}
