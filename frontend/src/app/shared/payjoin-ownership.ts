export type PayjoinOwner = 'sender' | 'recipient';

export interface PayjoinOwnership {
  inputs: PayjoinOwner[];
  outputs: PayjoinOwner[];
}

export function calculatePayjoinActualAmount(
  inputValues: Array<number | null | undefined>,
  outputValues: Array<number | null | undefined>,
  ownership: PayjoinOwnership,
): number | null {
  if (inputValues.length !== ownership.inputs.length || outputValues.length !== ownership.outputs.length) {
    return null;
  }

  const recipientInputValues = inputValues.filter((_, index) => ownership.inputs[index] === 'recipient');
  const recipientOutputValues = outputValues.filter((_, index) => ownership.outputs[index] === 'recipient');
  const values = [...recipientInputValues, ...recipientOutputValues];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    return null;
  }

  const recipientInputs = recipientInputValues.reduce((total, value) => total + (value as number), 0);
  const recipientOutputs = recipientOutputValues.reduce((total, value) => total + (value as number), 0);
  const actualAmount = recipientOutputs - recipientInputs;

  return Number.isSafeInteger(actualAmount) && actualAmount > 0 ? actualAmount : null;
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
