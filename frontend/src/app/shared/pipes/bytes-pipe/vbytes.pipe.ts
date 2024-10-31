/* tslint:disable */
import { Pipe, PipeTransform } from '@angular/core';
import { isNumberFinite, isPositive, isInteger, toDecimal } from '@app/shared/pipes/bytes-pipe/utils';

export type ByteUnit = 'vB' | 'kvB' | 'MvB' | 'GvB' | 'TvB';

@Pipe({
    name: 'vbytes'
})
export class VbytesPipe implements PipeTransform {

    static formats: { [key: string]: { max: number, prev?: ByteUnit } } = {
        'vB': {max: 1000},
        'kvB': {max: Math.pow(1000, 2), prev: 'vB'},
        'MvB': {max: Math.pow(1000, 3), prev: 'kvB'},
        'GvB': {max: Math.pow(1000, 4), prev: 'MvB'},
        'TvB': {max: Number.MAX_SAFE_INTEGER, prev: 'GvB'}
    };

    transform(input: any, decimal: number = 0, from: ByteUnit = 'vB', to?: ByteUnit, plainText?: boolean): any {

        if (!(isNumberFinite(input) &&
                isNumberFinite(decimal) &&
                isInteger(decimal) &&
                isPositive(decimal))) {
            return input;
        }

        let bytes = input;
        let unit = from;
        while (unit !== 'vB') {
            bytes *= 1024;
            unit = VbytesPipe.formats[unit].prev!;
        }

        if (to) {
            const format = VbytesPipe.formats[to];

            const result = toDecimal(VbytesPipe.calculateResult(format, bytes), decimal);

            return VbytesPipe.formatResult(result, to, plainText);
        }

        for (const key in VbytesPipe.formats) {
            const format = VbytesPipe.formats[key];
            if (bytes < format.max) {

                const result = toDecimal(VbytesPipe.calculateResult(format, bytes), decimal);

                return VbytesPipe.formatResult(result, key, plainText);
            }
        }
    }

    static formatResult(result: number, unit: string, plainText: boolean): string {
        if(plainText){
            return `${result} ${unit}`;
        }
        return `${result} <span class="symbol">${unit}</span>`;
    }

    static calculateResult(format: { max: number, prev?: ByteUnit }, bytes: number) {
        const prev = format.prev ? VbytesPipe.formats[format.prev] : undefined;
        return prev ? bytes / prev.max : bytes;
    }
}
