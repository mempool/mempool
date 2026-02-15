import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AddressFormattingService } from '@app/services/address-formatting.service';

@Pipe({
  name: 'addressChunk',
  standalone: false,
  pure: false
})
export class AddressChunkPipe implements PipeTransform {

  private colors = ['#05ddff', '#6c92f9'];

  constructor(
    private sanitizer: DomSanitizer,
    private formattingService: AddressFormattingService
  ) {}

  transform(chunk: string | null | undefined, offset: number = 0, fullString?: string): SafeHtml {
    if (!this.formattingService.useColors) return chunk || '';
    if (!chunk) return '';

    const context = fullString || chunk;
    const isPureHex = /^[0-9a-fA-F]{64,66}$/.test(context);

    if (isPureHex) return chunk;

    let html = '';
    let i = 0;
    
    const useSpacing = this.formattingService.useSpacing;

    while (i < chunk.length) {
      const realIndex = i + offset;
      const positionInBlock = realIndex % 4;
      const charsLeftInColorGroup = 4 - positionInBlock;
      const lengthToTake = Math.min(charsLeftInColorGroup, chunk.length - i);
      const segment = chunk.substr(i, lengthToTake);
      const colorIndex = Math.floor(realIndex / 4) % 2;
      const color = this.colors[colorIndex];

      const isLastSegment = (i + lengthToTake) >= chunk.length;
      
      const margin = (useSpacing && !isLastSegment) ? ' margin-right: 3px;' : '';
      const style = `color: ${color};${margin}`;

      html += `<span style="${style}">${segment}</span>`;
      i += lengthToTake;
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}