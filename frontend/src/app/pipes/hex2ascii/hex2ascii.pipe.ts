import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'hex2ascii'
})
export class Hex2asciiPipe implements PipeTransform {

  transform(hex: string): string {
    const opPush = hex.split(' ').filter((_, i, a) => i > 0 && /^OP_PUSH/.test(a[i - 1]));

    if (opPush[0]) {
      hex = opPush[0];
    }

    if (!hex) {
      return '';
    }
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  }

}
