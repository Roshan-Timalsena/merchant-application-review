import {
  KybProviderOutcome,
  RiskStatus,
} from './enums/merchant-application.enums';
import {
  mapOutcomeToRiskStatus,
  simulateRiskProvider,
} from './risk-kyb.simulator';

describe('simulateRiskProvider', () => {
  it('returns one of the provider outcomes with mapped risk status', () => {
    const result = simulateRiskProvider({ businessName: 'Acme' });

    expect(Object.values(KybProviderOutcome)).toContain(result.outcome);
    expect(result.riskStatus).toBe(mapOutcomeToRiskStatus(result.outcome));
    expect(result.flags).toEqual(['random_simulation']);
    expect(result.summary).toContain('Acme');
  });
});

describe('mapOutcomeToRiskStatus', () => {
  it('maps provider outcomes to risk statuses', () => {
    expect(mapOutcomeToRiskStatus(KybProviderOutcome.LOW_RISK)).toBe(
      RiskStatus.LOW,
    );
    expect(mapOutcomeToRiskStatus(KybProviderOutcome.MANUAL_REVIEW)).toBe(
      RiskStatus.MEDIUM,
    );
    expect(mapOutcomeToRiskStatus(KybProviderOutcome.HIGH_RISK)).toBe(
      RiskStatus.HIGH,
    );
  });
});
