import { calculatePayjoinActualAmount, calculatePayjoinDetails, parsePayjoinOwnership } from './payjoin-ownership';

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

  it('calculates the recipient net gain as the actual amount sent', () => {
    const ownership = parsePayjoinOwnership('1:ssr:rs', 3, 2);

    expect(calculatePayjoinActualAmount(
      [80_000, 30_000, 20_000],
      [70_000, 59_000],
      ownership!,
    )).toBe(50_000);
  });

  it('reconciles participant totals, the actual amount, and the network fee', () => {
    const ownership = parsePayjoinOwnership('1:ssr:rs', 3, 2);

    expect(calculatePayjoinDetails(
      [80_000, 30_000, 20_000],
      [70_000, 59_000],
      ownership!,
    )).toEqual({
      senderInputs: 110_000,
      recipientInputs: 20_000,
      totalInputs: 130_000,
      senderOutputs: 59_000,
      recipientOutputs: 70_000,
      totalOutputs: 129_000,
      fee: 1_000,
      senderNetDebit: 51_000,
      recipientNetGain: 50_000,
      actualAmount: 50_000,
    });
  });

  it('rejects missing values and non-positive recipient gains', () => {
    const ownership = parsePayjoinOwnership('1:sr:rs', 2, 2);

    expect(calculatePayjoinActualAmount([80_000, null], [50_000, 49_000], ownership!)).toBeNull();
    expect(calculatePayjoinActualAmount([80_000, 50_000], [50_000, 79_000], ownership!)).toBeNull();
  });

  it('rejects calculations that do not balance to a non-negative fee', () => {
    const ownership = parsePayjoinOwnership('1:sr:rs', 2, 2);

    expect(calculatePayjoinDetails([50_000, 20_000], [60_000, 20_000], ownership!)).toBeNull();
  });
});
