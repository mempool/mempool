import { parsePayjoinOwnership } from './payjoin-ownership';

describe('parsePayjoinOwnership', () => {
  it('parses ownership for a nine-input, two-output Payjoin', () => {
    expect(parsePayjoinOwnership('1:ssssssssr:rs', 9, 2)).toEqual({
      inputs: [
        'sender', 'sender', 'sender', 'sender', 'sender',
        'sender', 'sender', 'sender', 'recipient',
      ],
      outputs: ['recipient', 'sender'],
    });
  });

  it('rejects unsupported versions', () => {
    expect(parsePayjoinOwnership('2:sr:rs', 2, 2)).toBeNull();
  });

  it('rejects vectors that do not match the transaction', () => {
    expect(parsePayjoinOwnership('1:sr:rs', 3, 2)).toBeNull();
    expect(parsePayjoinOwnership('1:sr:rs', 2, 1)).toBeNull();
  });

  it('rejects unknown ownership codes', () => {
    expect(parsePayjoinOwnership('1:sx:rs', 2, 2)).toBeNull();
  });

  it('rejects transactions without both Payjoin input participants', () => {
    expect(parsePayjoinOwnership('1:ss:rs', 2, 2)).toBeNull();
    expect(parsePayjoinOwnership('1:rr:rs', 2, 2)).toBeNull();
  });

  it('rejects missing or malformed values', () => {
    expect(parsePayjoinOwnership(null, 2, 2)).toBeNull();
    expect(parsePayjoinOwnership('1:sr', 2, 2)).toBeNull();
  });
});
