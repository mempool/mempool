import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'round' })
export class RoundPipe implements PipeTransform {
  transform(nr: number) {
    return Math.round(nr);
  }
}
