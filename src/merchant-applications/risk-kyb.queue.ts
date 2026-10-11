export const RISK_KYB_QUEUE = 'risk-kyb';

export interface RiskKybJobPayload {
  applicationId: string;
  submissionVersion: number;
}

export function riskKybJobId(
  applicationId: string,
  submissionVersion: number,
): string {
  return `risk-kyb:${applicationId}:${submissionVersion}`;
}
