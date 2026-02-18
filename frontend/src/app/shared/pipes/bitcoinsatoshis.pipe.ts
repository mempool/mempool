import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'bitcoinsatoshis',
  standalone: false,
})
export class BitcoinsatoshisPipe implements PipeTransform {

  constructor(private sanitizer: DomSanitizer) { }

  transform(value: string, firstPartClass?: string): SafeHtml {
    const numValue = parseFloat(value || '0');
    const newValue = this.insertSpaces(numValue.toFixed(8));
    const position = (newValue || '0').search(/[1-9]/);

    const firstPart = newValue.slice(0, position);
    const secondPart = newValue.slice(position);

    return this.sanitizer.bypassSecurityTrustHtml(
      `<span class="${firstPartClass ? firstPartClass : 'text-secondary'}">${firstPart}</span>${secondPart}`
    );
  }

  insertSpaces(str: string): string {
    const [integerPart, decimalPart] = str.split('.');

    // Format integer part with thousand separators (right to left)
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    // Format decimal part: first 2 digits, then groups of 3
    const formattedDecimal = decimalPart.slice(0, 2) + ' ' +
                             decimalPart.slice(2, 5) + ' ' +
                             decimalPart.slice(5);

    return formattedInteger + '.' + formattedDecimal;
  }

}
