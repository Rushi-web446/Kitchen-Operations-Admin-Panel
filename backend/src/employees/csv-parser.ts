import { BadRequestException } from '@nestjs/common';

export function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let closedQuote = false;
  const source = csv.replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (inQuotes && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (inQuotes) {
        inQuotes = false;
        closedQuote = true;
      } else if (field.length === 0 && !closedQuote) {
        inQuotes = true;
      } else {
        throw new BadRequestException('CSV contains an invalid quote');
      }
    } else if (character === ',' && !inQuotes) {
      record.push(field);
      field = '';
      closedQuote = false;
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      closedQuote = false;
    } else if (closedQuote && !inQuotes) {
      if (character.trim() !== '') throw new BadRequestException('CSV contains text after a quoted field');
    } else if (character !== '\r' || inQuotes) {
      field += character;
    }
  }

  if (inQuotes) throw new BadRequestException('CSV contains an unclosed quoted field');
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  if (records.length === 0) throw new BadRequestException('CSV file is empty');
  return records;
}
