import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { SigInfo, SighashLabels } from '@app/shared/transaction.utils';

@Component({
  selector: 'app-asm',
  templateUrl: './asm.component.html',
  styleUrls: ['./asm.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AsmComponent {
  @Input() asm: string;
  @Input() crop: number = 0;
  @Input() annotations: {
    signatures: Record<string, { sig: SigInfo, vindex: number }>,
    selectedSig: SigInfo | null,
    p2sh: boolean
  } = {
    signatures: {},
    selectedSig: null,
    p2sh: false
  };
  @Output() showSigInfo = new EventEmitter<SigInfo>();
  @Output() hideSigInfo = new EventEmitter<void>();

  instructions: { instruction: string, args: string[], cltvTimestamp?: number }[] = [];
  sighashLabels: Record<number, string> = SighashLabels;

  ngOnInit(): void {
    this.parseASM();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['asm'] || changes['crop']) {
      this.parseASM();
    }
  }

  parseASM(): void {
    const allInstructions = this.asm.split('OP_').filter(instruction => instruction.trim() !== '');

    const cltvTimestamps: Map<number, number> = new Map();
    allInstructions.forEach((instruction, index, arr) => {
      const parts = instruction.split(' ');
      const instructionName = parts[0];
      const args = parts.slice(1);

      if (instructionName === 'PUSHBYTES_4' && args.length > 0 && args[0].length === 8 && /^[0-9a-fA-F]+$/.test(args[0])) {
        if (index + 1 < arr.length) {
          const nextInstruction = arr[index + 1].split(' ')[0];
          if (nextInstruction === 'CLTV') {
            const bytes = args[0].match(/.{2}/g) || [];
            const littleEndianValue = bytes.reverse().join('');
            const timestamp = parseInt(littleEndianValue, 16);
            cltvTimestamps.set(index, timestamp);
            cltvTimestamps.set(index + 1, timestamp);
          }
        }
      }
    });

    let instructions = allInstructions;
    if (this.crop && this.asm.length > this.crop) {
      let chars = 0;
      for (let i = 0; i < instructions.length; i++) {
        if (chars + instructions[i].length + 3 > this.crop) {
          const croppedInstruction = instructions[i];
          instructions = instructions.slice(0, i);
          let remainingChars = this.crop - chars;
          let parts = croppedInstruction.split(' ');
          if (remainingChars > parts[0].length + 10) {
            remainingChars -= parts[0].length + 1;
            for (let j = 1; j < parts.length; j++) {
              const arg = parts[j];
              if (remainingChars >= arg.length) {
                remainingChars -= arg.length + 1;
              } else {
                parts[j] = arg.slice(0, remainingChars);
                parts = parts.slice(0, j + 1);
                break;
              }
            }
            instructions.push(`${parts.join(' ')}`);
          }
          break;
        }
        chars += instructions[i].length + 3;
      }
    }

    this.instructions = instructions.map((instruction, index) => {
      const parts = instruction.split(' ');
      const instructionName = parts[0];
      const args = parts.slice(1);

      return {
        instruction: instructionName,
        args: args,
        cltvTimestamp: cltvTimestamps.get(index)
      };
    });
  }

  doShowSigInfo(sig: SigInfo): void {
    this.showSigInfo.emit(sig);
  }

  doHideSigInfo(): void {
    this.hideSigInfo.emit();
  }

  formatTimestamp(timestamp: number): string {
    if (timestamp < 500000000) {
      return `Block height: ${timestamp}`;
    }
    if (timestamp > 4294967295) {
      return `Invalid timestamp: ${timestamp}`;
    }
    const date = new Date(timestamp * 1000);
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
  }

  readonly opcodeStyles: Map<string, string> = new Map([
    // Constants
    ['0', 'constants'],
    ['FALSE', 'constants'],
    ['TRUE', 'constants'],
    ...Array.from({length: 75}, (_, i) => [`PUSHBYTES_${i + 1}`, 'constants']),
    ['PUSHDATA1', 'constants'],
    ['PUSHDATA2', 'constants'],
    ['PUSHDATA4', 'constants'],
    ['PUSHNUM_NEG1', 'constants'],
    ...Array.from({length: 16}, (_, i) => [`PUSHNUM_${i + 1}`, 'constants']),

    // Control flow
    ['NOP', 'control'],
    ['IF', 'control'],
    ['NOTIF', 'control'],
    ['ELSE', 'control'],
    ['ENDIF', 'control'],
    ['VERIFY', 'control'],
    ['RETURN', 'control'],
    ...Array.from({length: 70}, (_, i) => [`RETURN_${i + 186}`, 'control']),

    // Stack
    ['TOALTSTACK', 'stack'],
    ['FROMALTSTACK', 'stack'],
    ['IFDUP', 'stack'],
    ['DEPTH', 'stack'],
    ['DROP', 'stack'],
    ['DUP', 'stack'],
    ['NIP', 'stack'],
    ['OVER', 'stack'],
    ['PICK', 'stack'],
    ['ROLL', 'stack'],
    ['ROT', 'stack'],
    ['SWAP', 'stack'],
    ['TUCK', 'stack'],
    ['2DROP', 'stack'],
    ['2DUP', 'stack'],
    ['3DUP', 'stack'],
    ['2OVER', 'stack'],
    ['2ROT', 'stack'],
    ['2SWAP', 'stack'],

    // String
    ['CAT', 'splice'],
    ['SUBSTR', 'splice'],
    ['LEFT', 'splice'],
    ['RIGHT', 'splice'],
    ['SIZE', 'splice'],

    // Logic
    ['INVERT', 'logic'],
    ['AND', 'logic'],
    ['OR', 'logic'],
    ['XOR', 'logic'],
    ['EQUAL', 'logic'],
    ['EQUALVERIFY', 'logic'],

    // Arithmetic
    ['1ADD', 'arithmetic'],
    ['1SUB', 'arithmetic'],
    ['2MUL', 'arithmetic'],
    ['2DIV', 'arithmetic'],
    ['NEGATE', 'arithmetic'],
    ['ABS', 'arithmetic'],
    ['NOT', 'arithmetic'],
    ['0NOTEQUAL', 'arithmetic'],
    ['ADD', 'arithmetic'],
    ['SUB', 'arithmetic'],
    ['MUL', 'arithmetic'],
    ['DIV', 'arithmetic'],
    ['MOD', 'arithmetic'],
    ['LSHIFT', 'arithmetic'],
    ['RSHIFT', 'arithmetic'],
    ['BOOLAND', 'arithmetic'],
    ['BOOLOR', 'arithmetic'],
    ['NUMEQUAL', 'arithmetic'],
    ['NUMEQUALVERIFY', 'arithmetic'],
    ['NUMNOTEQUAL', 'arithmetic'],
    ['LESSTHAN', 'arithmetic'],
    ['GREATERTHAN', 'arithmetic'],
    ['LESSTHANOREQUAL', 'arithmetic'],
    ['GREATERTHANOREQUAL', 'arithmetic'],
    ['MIN', 'arithmetic'],
    ['MAX', 'arithmetic'],
    ['WITHIN', 'arithmetic'],

    // Crypto
    ['RIPEMD160', 'crypto'],
    ['SHA1', 'crypto'],
    ['SHA256', 'crypto'],
    ['HASH160', 'crypto'],
    ['HASH256', 'crypto'],
    ['CODESEPARATOR', 'crypto'],
    ['CHECKSIG', 'crypto'],
    ['CHECKSIGVERIFY', 'crypto'],
    ['CHECKMULTISIG', 'crypto'],
    ['CHECKMULTISIGVERIFY', 'crypto'],
    ['CHECKSIGADD', 'crypto'],

    // Locktime
    ['CLTV', 'locktime'],
    ['CSV', 'locktime'],

    // Reserved
    ['RESERVED', 'reserved'],
    ['VER', 'reserved'],
    ['VERIF', 'reserved'],
    ['VERNOTIF', 'reserved'],
    ['RESERVED1', 'reserved'],
    ['RESERVED2', 'reserved'],
    ...Array.from({length: 10}, (_, i) => [`NOP${i + 1}`, 'reserved'])
  ] as [string, string][]);
}
