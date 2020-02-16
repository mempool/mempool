import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, Input } from '@angular/core';
import * as ClipboardJS from 'clipboard';
import * as tlite from 'tlite';

@Component({
  selector: 'app-clipboard',
  templateUrl: './clipboard.component.html',
  styleUrls: ['./clipboard.component.scss']
})
export class ClipboardComponent implements AfterViewInit {
  @ViewChild('btn') btn: ElementRef;
  @ViewChild('buttonWrapper') buttonWrapper: ElementRef;
  @Input() text: string;

  clipboard: any;

  constructor() { }

  ngAfterViewInit() {
    this.clipboard = new ClipboardJS(this.btn.nativeElement);
    this.clipboard.on('success', (e) => {
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
