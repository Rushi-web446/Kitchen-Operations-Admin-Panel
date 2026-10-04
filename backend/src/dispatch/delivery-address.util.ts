import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

const NON_ADDRESS_FIELDS = new Set([
  'recipient',
  'recipientname',
  'contact',
  'contactname',
  'contactphone',
  'phone',
  'email',
]);

function normalizeAddressValue(value: unknown, key = ''): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAddressValue(item)).sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([field]) => !NON_ADDRESS_FIELDS.has(field.replace(/[^a-z]/gi, '').toLowerCase()))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([field, item]) => [field.toLowerCase(), normalizeAddressValue(item, field)]);
    return Object.fromEntries(entries);
  }
  return key ? String(value) : null;
}

export function canonicalizeDeliveryAddress(snapshot: Prisma.JsonValue): {
  key: string;
  snapshot: Prisma.InputJsonValue;
} {
  const canonical = normalizeAddressValue(snapshot);
  const canonicalJson = JSON.stringify(canonical);
  return {
    key: createHash('sha256').update(canonicalJson).digest('hex'),
    snapshot: snapshot as Prisma.InputJsonValue,
  };
}

export function advisoryLockId(key: string): bigint {
  const bytes = createHash('sha256').update(key).digest();
  return bytes.readBigInt64BE(0);
}

export function deliveryGroupKey(input: {
  companyId: number;
  deliveryDate: string;
  deliveryAddressKey: string;
  deliveryTime: string;
}): string {
  return [
    input.companyId,
    input.deliveryDate,
    input.deliveryAddressKey,
    input.deliveryTime,
  ].join('|');
}