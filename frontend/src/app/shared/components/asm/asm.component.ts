import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { SigInfo, SighashLabels } from '@app/shared/transaction.utils';

@Component({
  selector: 'app-asm',
  templateUrl: './asm.component.html',
  styleUrls: ['./asm.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AsmComponent {
  @Input() asm: string;
  @Input() crop: number = 0;
  @Input() annotations: {
    signatures: Record<string, { sig: SigInfo, vindex: number }>,
    selectedSig: SigInfo | null
  } = {
    signatures: {},
    selectedSig: null
  };
  @Output() showSigInfo = new EventEmitter<SigInfo>();
  @Output() hideSigInfo = new EventEmitter<void>();

  instructions: { instruction: string, args: string[] }[] = [];
  sighashLabels: Record<number, string> = SighashLabels;

  ngOnInit(): void {
    this.parseASM();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['asm']) {
      this.parseASM();
    }
  }

  parseASM(): void {
    let instructions = this.asm.split('OP_');
    // trim instructions to a whole number of instructions with at most `crop` characters total
    if (this.crop) {
      let chars = 0;
      for (let i = 0; i < instructions.length; i++) {
        chars += instructions[i].length + 3;
        if (chars > this.crop) {
          instructions = instructions.slice(0, i);
          break;
        }
      }
    }
    this.instructions = instructions.filter(instruction => instruction.trim() !== '').map(instruction => {
      const parts = instruction.split(' ');
      return {
        instruction: parts[0],
        args: parts.slice(1)
      };
    });
  }

  doShowSigInfo(sig: SigInfo): void {
    this.showSigInfo.emit(sig);
  }

  doHideSigInfo(): void {
    this.hideSigInfo.emit();
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
