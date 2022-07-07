import { Directive, ElementRef, Host, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[ssAutofocus]'
})
export class AutofocusDirective implements OnInit, OnChanges {

  /**
   * Will set focus if set to falsy value or not set at all
   */
  @Input() ssAutofocus: any;

  get element(): { focus?: Function } {
    return this.elemRef.nativeElement;
  }

  constructor(
    @Host() private elemRef: ElementRef,
  ) { }

  ngOnInit() {
    this.focus();
  }

  ngOnChanges(changes: SimpleChanges) {
    const ssAutofocusChange = changes.ssAutofocus;

    if (ssAutofocusChange && !ssAutofocusChange.isFirstChange()) {
      this.focus();
    }
  }

  focus() {
    if (this.ssAutofocus) {
      return;
    }

    this.element.focus && this.element.focus();
  }

}
