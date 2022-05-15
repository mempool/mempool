import { Component, Input, AfterViewInit, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import * as QRCode from 'qrcode';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-qrcode',
  templateUrl: './qrcode.component.html',
  styleUrls: ['./qrcode.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrcodeComponent implements AfterViewInit {
  @Input() data: string;
  @Input() size = 125;
  @Input() imageUrl: string;
  @ViewChild('canvas') canvas: ElementRef;

  qrcodeObject: any;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnChanges() {
    if (!this.canvas || !this.canvas.nativeElement) {
      return;
    }
    this.render();
  }

  ngAfterViewInit() {
    this.render();
  }

  render() {
    if (!this.stateService.isBrowser) {
      return;
    }
    const opts: QRCode.QRCodeRenderersOptions = {
      errorCorrectionLevel: 'H',
      margin: 0,
      color: {
        dark: '#000',
        light: '#fff'
      },
      width: this.size,
    };

    if (!this.data) {
      return;
    }

    const address = this.data;
    if (this.data.indexOf('bc1') === 0 || this.data.indexOf('tb1') === 0) {
      address.toUpperCase();
    }

    QRCode.toCanvas(this.canvas.nativeElement, address, opts, (error: any) => {
      if (error) {
         console.error(error);
      }
    });
  }
}
