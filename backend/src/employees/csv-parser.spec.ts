import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseCsvRecords } from './csv-parser';

describe('parseCsvRecords', () => {
  it('parses headers and quoted fields containing commas, escaped quotes, and newlines', () => {
    expect(parseCsvRecords('\uFEFFname,email\r\n"Doe, Jane","jane@example.com"\r\n"Sam ""Quote""","sam@example.com"')).toEqual([
      ['name', 'email'],
      ['Doe, Jane', 'jane@example.com'],
      ['Sam "Quote"', 'sam@example.com'],
    ]);
    expect(parseCsvRecords('name,note\n"Jane\nDoe",Employee')).toEqual([
      ['name', 'note'],
      ['Jane\nDoe', 'Employee'],
    ]);
  });

  it('rejects malformed quoted fields', () => {
    expect(() => parseCsvRecords('name,email\n"Jane,jane@example.com')).toThrow(BadRequestException);
    expect(() => parseCsvRecords('name,email\n"Jane"x,jane@example.com')).toThrow(BadRequestException);
  });

  it('rejects empty input', () => {
    expect(() => parseCsvRecords('')).toThrow(BadRequestException);
  });
});
