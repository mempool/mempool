import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'capAddress' })
export class CapAddressPipe implements PipeTransform {
  transform(str: string, cap: number, leftover: number) {
    if (!str) { return; }
    if (str.length <= cap) {
      return str;
    }
    return str.slice(-Math.max(cap - str.length, leftover));
  }
}
