import { describe, it, expect } from 'vitest';
import {
  validatePincode,
  sanitizePincode,
  parseIndiaPostResponse,
} from '@/lib/pincode';

describe('validatePincode', () => {
  it('accepts a real 6-digit PIN', () => {
    expect(validatePincode('332001')).toBe(true);
    expect(validatePincode('110001')).toBe(true);
  });

  it('rejects a leading-zero / all-zero PIN', () => {
    expect(validatePincode('000000')).toBe(false);
    expect(validatePincode('012345')).toBe(false);
  });

  it('rejects the wrong number of digits', () => {
    expect(validatePincode('999')).toBe(false);
    expect(validatePincode('12345')).toBe(false);
    expect(validatePincode('1234567')).toBe(false);
    expect(validatePincode('')).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(validatePincode('ABC123')).toBe(false);
    expect(validatePincode('12A456')).toBe(false);
    expect(validatePincode('12 456')).toBe(false);
  });
});

describe('sanitizePincode', () => {
  it('strips non-digits and caps at 6', () => {
    expect(sanitizePincode('33 20 01')).toBe('332001');
    expect(sanitizePincode('12A456')).toBe('12456');
    expect(sanitizePincode('3320019999')).toBe('332001');
    expect(sanitizePincode('abc')).toBe('');
  });
});

describe('parseIndiaPostResponse', () => {
  const success = [
    {
      Message: 'Number of pincode(s) found:1',
      Status: 'Success',
      PostOffice: [
        {
          Name: 'Bajaj Road-Sikar',
          District: 'Sikar',
          State: 'Rajasthan',
          Block: 'Sikar',
          Pincode: '332001',
        },
      ],
    },
  ];

  it('maps a Success entry to a normalised location', () => {
    expect(parseIndiaPostResponse(success)).toEqual({
      pincode: '332001',
      district: 'Sikar',
      state: 'Rajasthan',
      city: 'Sikar',
    });
  });

  it('falls back to the post-office Name when Block is absent', () => {
    const noBlock = [
      { Status: 'Success', PostOffice: [{ Name: 'Central', District: 'X', State: 'Y' }] },
    ];
    expect(parseIndiaPostResponse(noBlock)?.city).toBe('Central');
  });

  it('returns null for an error status', () => {
    const error = [{ Message: 'No records found', Status: 'Error', PostOffice: null }];
    expect(parseIndiaPostResponse(error)).toBeNull();
  });

  it('returns null when PostOffice is empty or missing', () => {
    expect(parseIndiaPostResponse([{ Status: 'Success', PostOffice: [] }])).toBeNull();
    expect(parseIndiaPostResponse([{ Status: 'Success' }])).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseIndiaPostResponse(null)).toBeNull();
    expect(parseIndiaPostResponse([])).toBeNull();
    expect(parseIndiaPostResponse({})).toBeNull();
    expect(parseIndiaPostResponse('nope')).toBeNull();
  });
});
