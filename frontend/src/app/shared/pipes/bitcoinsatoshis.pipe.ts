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
    // Don't show decimals at max supply (21M BTC)
    if (numValue >= 21000000) {
      return this.sanitizer.bypassSecurityTrustHtml('21 000 000');
    }
    const newValue = this.insertSpaces(numValue.toFixed(8));
    const position = (newValue || '0').search(/[1-9]/);

    const firstPart = newValue.slice(0, position);
    const secondPart = newValue.slice(position);

    return this.sanitizer.bypassSecurityTrustHtml(
      `<span class="${firstPartClass ? firstPartClass : 'text-secondary'}">${firstPart}</span>${secondPart}`
    );
  }

  insertSpaces(str: string): string {
    const length = str.length;
    return str.slice(0, length - 6) + ' ' + str.slice(length - 6, length - 3) + ' ' + str.slice(length - 3);
  }

}
