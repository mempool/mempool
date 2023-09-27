import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'decimal2hex'
})
export class Decimal2HexPipe implements PipeTransform {
  transform(decimal: number): string {
    return `0x` + ( decimal.toString(16) ).padStart(8, '0');
  }
}
