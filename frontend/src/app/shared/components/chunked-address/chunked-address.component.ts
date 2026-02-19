import { Component, Input, ChangeDetectionStrategy, OnChanges, OnInit, OnDestroy, LOCALE_ID, Inject } from '@angular/core';
import { Subscription } from 'rxjs';

interface AddressChunk {
  text: string;
  color: string;
  hasMargin: boolean;
}

@Component({
  selector: 'app-chunked-address',
  templateUrl: './chunked-address.component.html',
  styleUrls: ['./chunked-address.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ChunkedAddressComponent implements OnChanges, OnInit, OnDestroy {
  @Input() address: string;
  @Input() link: any = null;
  @Input() external: boolean = false;
  @Input() queryParams: any = undefined;
  @Input() lastChars: number = 8;
  @Input() maxWidth: number = null;
  @Input() inline: boolean = false;
  @Input() textAlign: 'start' | 'end' = 'start';
  @Input() disabled: boolean = false;
  rtl: boolean;

  headChunks: AddressChunk[] = [];
  tailChunks: AddressChunk[] = [];

  private colors = ['var(--info)', 'var(--primary)'];

  constructor(
    @Inject(LOCALE_ID) private locale: string
  ) {
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.rtl = true;
    }
  }

  ngOnInit(): void {}

  ngOnChanges(): void {
      this.updateView();
  }

  ngOnDestroy(): void {}

  private updateView() {
    if (!this.address) {
      return
    };

    const splitIndex = this.address.length - this.lastChars;
    const headText = this.address.slice(0, splitIndex);
    const tailText = this.address.slice(splitIndex);

    this.headChunks = this.chunkify(headText, 0);
    this.tailChunks = this.chunkify(tailText, splitIndex);
  }

  private chunkify(chunk: string, offset: number): AddressChunk[] {
    const result: AddressChunk[] = [];
    const totalLen = this.address.length;

    let i = 0;
    while (i < chunk.length) {
      const realIndex = i + offset;
      const lengthToTake = Math.min(4 - (realIndex % 4), chunk.length - i);
      const segment = chunk.substring(i, i + lengthToTake);
      
      const currentEndIndex = realIndex + lengthToTake;

      result.push({
        text: segment,
        color: this.colors[Math.floor(realIndex / 4) % 2],
        hasMargin: (currentEndIndex % 4 === 0) && (currentEndIndex !== totalLen)
      });
      i += lengthToTake;
    }
    return result;
  }
}