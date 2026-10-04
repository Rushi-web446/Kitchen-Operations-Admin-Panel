import { describe, expect, it } from 'vitest';
import { canonicalizeDeliveryAddress, deliveryGroupKey } from './delivery-address.util';

describe('delivery group key', () => {
  it('normalizes address casing, spacing and recipient identity', () => {
    const first = canonicalizeDeliveryAddress({
      recipientName: 'Asha Rao',
      addressLine1: '  123   Main Street ',
      city: 'Pune',
      postalCode: '411001',
      country: 'IN',
    });
    const second = canonicalizeDeliveryAddress({
      recipientName: 'Another Recipient',
      addressLine1: '123 main street',
      city: 'PUNE',
      postalCode: '411001',
      country: 'in',
    });

    expect(first.key).toBe(second.key);
  });

  it('groups only matching company, canonical address, date and exact time', () => {
    const common = {
      companyId: 1,
      deliveryDate: '2026-10-06',
      deliveryAddressKey: 'same-address-hash',
      deliveryTime: '12:00:00.000',
    };
    const key = deliveryGroupKey(common);

    expect(deliveryGroupKey({ ...common })).toBe(key);
    expect(deliveryGroupKey({ ...common, companyId: 2 })).not.toBe(key);
    expect(deliveryGroupKey({ ...common, deliveryAddressKey: 'other-address' })).not.toBe(key);
    expect(deliveryGroupKey({ ...common, deliveryTime: '12:30:00.000' })).not.toBe(key);
    expect(deliveryGroupKey({ ...common, deliveryDate: '2026-10-07' })).not.toBe(key);
  });
});