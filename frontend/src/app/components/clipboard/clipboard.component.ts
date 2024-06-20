import { Component, ViewChild, ElementRef, AfterViewInit, Input, ChangeDetectionStrategy } from '@angular/core';
import * as ClipboardJS from 'clipboard';
import * as tlite from 'tlite';

@Component({
  selector: 'app-clipboard',
  templateUrl: './clipboard.component.html',
  styleUrls: ['./clipboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClipboardComponent implements AfterViewInit {
  @ViewChild('btn') btn: ElementRef;
  @ViewChild('buttonWrapper') buttonWrapper: ElementRef;
  @Input() button = false;
  @Input() class = 'btn btn-secondary ml-1';
  @Input() size: 'small' | 'normal' | 'large' = 'normal';
  @Input() text: string;
  @Input() leftPadding = true;
  copiedMessage: string = $localize`:@@clipboard.copied-message:Copied!`;

  widths = {
    small: '10',
    normal: '13',
    large: '18',
  };

  clipboard: any;

  constructor() { }

  ngAfterViewInit() {
    this.clipboard = new ClipboardJS(this.btn.nativeElement);
    this.clipboard.on('success', () => {
      tlite.show(this.buttonWrapper.nativeElement);
      setTimeout(() => {
        tlite.hide(this.buttonWrapper.nativeElement);
      }, 1000);
    });
  }

  onDestroy() {
    this.clipboard.destroy();
  }

}
