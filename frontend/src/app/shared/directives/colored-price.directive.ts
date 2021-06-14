import { Directive, ElementRef, Input, OnChanges } from '@angular/core';

@Directive({
  selector: '[appColoredPrice]',
})
export class ColoredPriceDirective implements OnChanges {
  @Input() appColoredPrice: number;
  previousValue = null;

  constructor(
    private element: ElementRef
  ) { }

  ngOnChanges() {
    if (this.previousValue && this.appColoredPrice < this.previousValue) {
      this.element.nativeElement.classList.add('red-color');
    } else {
      this.element.nativeElement.classList.remove('red-color');
    }
    this.previousValue = this.appColoredPrice;
  }
}
