export type PayjoinOwner = 'sender' | 'recipient';

export interface PayjoinOwnership {
  inputs: PayjoinOwner[];
  outputs: PayjoinOwner[];
}

export interface PayjoinCalculation {
  senderInputs: number;
  recipientInputs: number;
  totalInputs: number;
  senderOutputs: number;
  recipientOutputs: number;
  totalOutputs: number;
  fee: number;
  senderNetDebit: number;
  recipientNetGain: number;
  actualAmount: number;
}

export function calculatePayjoinDetails(
  inputValues: Array<number | null | undefined>,
  outputValues: Array<number | null | undefined>,
  ownership: PayjoinOwnership,
): PayjoinCalculation | null {
  if (inputValues.length !== ownership.inputs.length || outputValues.length !== ownership.outputs.length) {
    return null;
  }

  const values = [...inputValues, ...outputValues];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    return null;
  }

  const inputs = inputValues as number[];
  const outputs = outputValues as number[];
  const senderInputs = inputs.reduce((total, value, index) => total + (ownership.inputs[index] === 'sender' ? value : 0), 0);
  const recipientInputs = inputs.reduce((total, value, index) => total + (ownership.inputs[index] === 'recipient' ? value : 0), 0);
  const senderOutputs = outputs.reduce((total, value, index) => total + (ownership.outputs[index] === 'sender' ? value : 0), 0);
  const recipientOutputs = outputs.reduce((total, value, index) => total + (ownership.outputs[index] === 'recipient' ? value : 0), 0);
  const totalInputs = senderInputs + recipientInputs;
  const totalOutputs = senderOutputs + recipientOutputs;
  const fee = totalInputs - totalOutputs;
  const senderNetDebit = senderInputs - senderOutputs;
  const recipientNetGain = recipientOutputs - recipientInputs;
  const calculatedValues = [
    senderInputs,
    recipientInputs,
    totalInputs,
    senderOutputs,
    recipientOutputs,
    totalOutputs,
    fee,
    senderNetDebit,
    recipientNetGain,
  ];

  if (
    calculatedValues.some((value) => !Number.isSafeInteger(value))
    || fee < 0
    || senderNetDebit <= 0
    || recipientNetGain <= 0
    || senderNetDebit - recipientNetGain !== fee
  ) {
    return null;
  }

  return {
    senderInputs,
    recipientInputs,
    totalInputs,
    senderOutputs,
    recipientOutputs,
    totalOutputs,
    fee,
    senderNetDebit,
    recipientNetGain,
    actualAmount: recipientNetGain,
  };
}

export function calculatePayjoinActualAmount(
  inputValues: Array<number | null | undefined>,
  outputValues: Array<number | null | undefined>,
  ownership: PayjoinOwnership,
): number | null {
  return calculatePayjoinDetails(inputValues, outputValues, ownership)?.actualAmount ?? null;
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
