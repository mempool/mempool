import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'ceil' })
export class CeilPipe implements PipeTransform {
  transform(nr: number) {
    return Math.ceil(nr);
  }
}
