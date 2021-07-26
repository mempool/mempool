import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'absolute' })
export class AbsolutePipe implements PipeTransform {
  transform(nr: number) {
    return Math.abs(nr);
  }
}
