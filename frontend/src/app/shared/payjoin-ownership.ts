export type PayjoinOwner = 'sender' | 'recipient';

export interface PayjoinOwnership {
  inputs: PayjoinOwner[];
  outputs: PayjoinOwner[];
}

const OWNERSHIP_CODES: Record<string, PayjoinOwner> = {
  s: 'sender',
  r: 'recipient',
};

export function parsePayjoinOwnership(
  value: string | null,
  inputCount: number,
  outputCount: number,
): PayjoinOwnership | null {
  if (!value) {
    return null;
  }

  const parts = value.split(':');
  if (parts.length !== 3 || parts[0] !== '1') {
    return null;
  }

  const inputCodes = Array.from(parts[1]);
  const outputCodes = Array.from(parts[2]);
  if (inputCodes.length !== inputCount || outputCodes.length !== outputCount) {
    return null;
  }
  if (!inputCodes.includes('s') || !inputCodes.includes('r')) {
    return null;
  }
  if ([...inputCodes, ...outputCodes].some((code) => !OWNERSHIP_CODES[code])) {
    return null;
  }

  return {
    inputs: inputCodes.map((code) => OWNERSHIP_CODES[code]),
    outputs: outputCodes.map((code) => OWNERSHIP_CODES[code]),
  };
}
