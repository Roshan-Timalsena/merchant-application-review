import {
  KybProviderOutcome,
  RiskStatus,
} from './enums/merchant-application.enums';
import { MerchantApplication } from './entities/merchant-application.entity';

const PROVIDER_OUTCOMES = Object.values(KybProviderOutcome);

export interface SimulatedRiskProviderResult {
  outcome: KybProviderOutcome;
  riskStatus: RiskStatus;
  score: number;
  flags: string[];
  summary: string;
}

export function mapOutcomeToRiskStatus(
  outcome: KybProviderOutcome,
): RiskStatus {
  switch (outcome) {
    case KybProviderOutcome.LOW_RISK:
      return RiskStatus.LOW;
    case KybProviderOutcome.HIGH_RISK:
      return RiskStatus.HIGH;
    case KybProviderOutcome.MANUAL_REVIEW:
      return RiskStatus.MEDIUM;
  }
}

export function simulateRiskProvider(
  application: Pick<MerchantApplication, 'businessName'>,
): SimulatedRiskProviderResult {
  const outcome =
    PROVIDER_OUTCOMES[Math.floor(Math.random() * PROVIDER_OUTCOMES.length)];
  const riskStatus = mapOutcomeToRiskStatus(outcome);
  const summary = `Simulated KYB for ${application.businessName}: ${outcome}`;

  return {
    outcome,
    riskStatus,
    score: 0,
    flags: ['random_simulation'],
    summary,
  };
}
