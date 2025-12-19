import {  Directive, Input, TemplateRef } from '@angular/core';

@Directive({
  selector: 'ng-template[type]',
  standalone: false,
})
export class FaqTemplateDirective {
  @Input() type: string;
  constructor(public template: TemplateRef<any>) { }
}
