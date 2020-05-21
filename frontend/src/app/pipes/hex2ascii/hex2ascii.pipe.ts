import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'hex2ascii'
})
export class Hex2asciiPipe implements PipeTransform {

  transform(hex: string): string {
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
