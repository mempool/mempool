import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'ceil',
    standalone: false
})
export class CeilPipe implements PipeTransform {
  transform(nr: number) {
    return Math.ceil(nr);
  }
}
