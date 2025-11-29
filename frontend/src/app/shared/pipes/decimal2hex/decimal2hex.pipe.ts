import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'decimal2hex',
  standalone: false,
})
export class Decimal2HexPipe implements PipeTransform {
  transform(decimal: number, bytes: number = 4): string {
    return `0x` + ( decimal.toString(16) ).padStart(bytes * 2, '0');
  }
}
