import {
  maskEmail,
  maskOwnerName,
  maskPhone,
  redactAuditMetadata,
} from './redact';

describe('redact helpers', () => {
  it('masks email, phone, and owner name', () => {
    expect(maskEmail('jane@example.com')).toBe('j***@example.com');
    expect(maskPhone('+15551234567')).toBe('***-***-4567');
    expect(maskOwnerName('Jane Doe')).toBe('J*** D***');
  });

  it('strips secrets and masks PII in audit metadata', () => {
    const redacted = redactAuditMetadata({
      contactEmail: 'owner@example.com',
      contactPhone: '5551234567',
      ownerName: 'Jane Doe',
      password: 'secret',
      accessToken: 'token',
      kybResult: { raw: true },
      status: 'draft',
      providerRef: 'sim-1',
    });

    expect(redacted.contactEmail).toBe('o***@example.com');
    expect(redacted.contactPhone).toBe('***-***-4567');
    expect(redacted.ownerName).toBe('J*** D***');
    expect(redacted.password).toBeUndefined();
    expect(redacted.accessToken).toBeUndefined();
    expect(redacted.kybResult).toBeUndefined();
    expect(redacted.status).toBe('draft');
    expect(redacted.providerRef).toBe('sim-1');
  });
});
