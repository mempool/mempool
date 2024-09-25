import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { nextTick } from 'process';

@Component({
  selector: 'app-pool-logo',
  templateUrl: './pool-logo.component.html',
  styleUrls: ['./pool-logo.component.scss']
})
export class PoolLogoComponent implements OnChanges{
  @Input() pool: { slug: string, name: string };
  @Input() width: number = 15;
  @Input() height: number = 15;

  @ViewChild('poolImg') img: ElementRef<HTMLImageElement>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.pool) {
      if (this.img?.nativeElement) {
        this.img.nativeElement.style.opacity = '0';
        setTimeout(() => {
          this.img.nativeElement.style.opacity = '1';
        }, 50);
      }
    }
  }
}
