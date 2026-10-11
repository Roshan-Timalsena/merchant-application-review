export enum ApplicationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  INFO_REQUESTED = 'info_requested',
}

export const EDITABLE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.INFO_REQUESTED,
];

export enum BusinessType {
  SOLE_PROPRIETOR = 'sole_proprietor',
  LLC = 'llc',
  CORPORATION = 'corporation',
  PARTNERSHIP = 'partnership',
  OTHER = 'other',
}

export enum KybCheckStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum KybProviderOutcome {
  LOW_RISK = 'LOW_RISK',
  HIGH_RISK = 'HIGH_RISK',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
}

export enum RiskStatus {
  NOT_ASSESSED = 'not_assessed',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}
