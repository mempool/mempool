import { Directive, HostListener } from '@angular/core';
import { EventEmitter } from '@angular/core';
import { Output } from '@angular/core';

@Directive({
  // tslint:disable-next-line:directive-selector
  selector: '[offClick]',
})

export class OffClickDirective {
  @Output('offClick') onOffClick = new EventEmitter<any>();

  private _clickEvent: MouseEvent;
  private _touchEvent: TouchEvent;

  @HostListener('click', ['$event']) 
  public onClick(event: MouseEvent): void {
    this._clickEvent = event;
  }

  @HostListener('touchstart', ['$event'])
  public onTouch(event: TouchEvent): void {
    this._touchEvent = event;
  }

  @HostListener('document:click', ['$event']) 
  public onDocumentClick(event: MouseEvent): void {
    if (event !== this._clickEvent) {
      this.onOffClick.emit(event);
    }
  }

  @HostListener('document:touchstart', ['$event'])
  public onDocumentTouch(event: TouchEvent): void {
    if (event !== this._touchEvent) {
      this.onOffClick.emit(event);
    }
  }
}
