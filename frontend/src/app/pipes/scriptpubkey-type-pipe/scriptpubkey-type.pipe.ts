import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'scriptpubkeyType'
})
export class ScriptpubkeyTypePipe implements PipeTransform {

  transform(value: string): string {
    switch (value) {
      case 'fee':
        return 'Transaction fee';
      case 'op_return':
      default:
          return 'OP_RETURN';
    }
  }

}
