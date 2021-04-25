import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'scriptpubkeyType'
})
export class ScriptpubkeyTypePipe implements PipeTransform {

  transform(value: string): string {
    switch (value) {
      case 'fee':
        return $localize`Transaction fee`;
      case 'p2pk':
        return 'P2PK';
      case 'op_return':
        return 'OP_RETURN';
      default:
        return value.toUpperCase();
    }
  }

}
