export const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'token',
  'authorization',
  'apiKey',
  'api_key',
  'secret',
  'jwt',
]);

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || !local) {
    return '***';
  }
  const visible = local[0] ?? '';
  return `${visible}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const last4 = digits.slice(-4) || '****';
  return `***-***-${last4}`;
}

export function maskOwnerName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0] ?? ''}***`)
    .join(' ');
}

export function redactAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.has(key)) {
      continue;
    }

    if (key === 'contactEmail' && typeof value === 'string') {
      result[key] = maskEmail(value);
      continue;
    }
    if (key === 'contactPhone' && typeof value === 'string') {
      result[key] = maskPhone(value);
      continue;
    }
    if (key === 'ownerName' && typeof value === 'string') {
      result[key] = maskOwnerName(value);
      continue;
    }
    if (key === 'kybResult') {
      continue;
    }

    result[key] = value;
  }

  return result;
}
