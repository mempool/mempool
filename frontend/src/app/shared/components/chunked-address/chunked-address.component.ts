import { Component, Input, ChangeDetectionStrategy, OnChanges, LOCALE_ID, Inject } from '@angular/core';
import { AddressMatch } from '@app/shared/address-utils';

interface AddressChunk {
  text: string;
  prefixLength?: number;
  postfixLength?: number;
}

@Component({
  selector: 'app-chunked-address',
  templateUrl: './chunked-address.component.html',
  styleUrls: ['./chunked-address.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ChunkedAddressComponent implements OnChanges {
  @Input() address: string;
  @Input() similarity: { score: number, match: AddressMatch, group: number } | null;
  @Input() link: any = null;
  @Input() external: boolean = false;
  @Input() queryParams: any = undefined;
  @Input() lastChars: number = 8;
  @Input() maxWidth: number = null;
  @Input() inline: boolean = false;
  @Input() textAlign: 'start' | 'end' = 'start';
  @Input() disabled: boolean = false;
  @Input() showClipboard: boolean = false;
  @Input() chunkSize = 4;
  rtl: boolean;

  headChunks: AddressChunk[] = [];
  tailChunks: AddressChunk[] = [];

  groupColors: string[] = [
    'var(--primary)',
    'var(--success)',
    'var(--info)',
    'white',
  ];

  matchColor: string = 'var(--primary)';

  constructor(
    @Inject(LOCALE_ID) private locale: string
  ) {
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.rtl = true;
    }
  }

  ngOnChanges(): void {
    if (this.similarity) {
      this.matchColor = this.groupColors[this.similarity.group % (this.groupColors.length)];
    }
    this.updateView();
  }

  private updateView(): void {
    if (!this.address) {
      return;
    }

    const split = this.address.length - this.lastChars;
    const prefixLen = this.similarity?.match?.prefix?.length || 0;
    const postfixStart = this.address.length - (this.similarity?.match?.postfix?.length || 0);
    this.headChunks = [];
    this.tailChunks = [];

    for (let i = 0; i < this.address.length; i += this.chunkSize) {
      const text = this.address.slice(i, i + this.chunkSize);
      const chunk = {
        text,
        prefixLength: prefixLen > i ? Math.min(text.length, prefixLen - i) : undefined,
        postfixLength: postfixStart < i + text.length ? Math.min(text.length, i + text.length - postfixStart) : undefined,
      };
      if (i + this.chunkSize <= split) {
        this.headChunks.push(chunk);
      } else if (i >= split) {
        this.tailChunks.push(chunk);
      } else {
        // split chunk across head and tail
        const [ headChunk, tailChunk ] = this.splitChunk(chunk, split - i);
        this.headChunks.push(headChunk);
        this.tailChunks.push(tailChunk);
      }
    }
  }

  private splitChunk(chunk: AddressChunk, at: number): [AddressChunk, AddressChunk] {
    return [{
      text: chunk.text.slice(0, at),
      prefixLength: chunk.prefixLength ? Math.min(chunk.prefixLength, at) : undefined,
      postfixLength: chunk.postfixLength ? Math.max(0, at - chunk.postfixLength) : undefined,
    }, {
      text: chunk.text.slice(at),
      prefixLength: chunk.prefixLength ? Math.max(0, at - chunk.prefixLength) : undefined,
      postfixLength: chunk.postfixLength ? Math.min(chunk.postfixLength, chunk.text.length - at) : undefined,
    }];
  }
}