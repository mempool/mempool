/* tslint:disable */
import { Pipe, PipeTransform } from '@angular/core';
import { isNumberFinite, isPositive, isInteger, toDecimal, toSigFigs } from '@app/shared/pipes/bytes-pipe/utils';

export type ByteUnit = 'B' | 'kB' | 'MB' | 'GB' | 'TB';

@Pipe({
    name: 'bytes'
})
export class BytesPipe implements PipeTransform {

    static formats: { [key: string]: { max: number, prev?: ByteUnit } } = {
        'B': {max: 1000},
        'kB': {max: Math.pow(1000, 2), prev: 'B'},
        'MB': {max: Math.pow(1000, 3), prev: 'kB'},
        'GB': {max: Math.pow(1000, 4), prev: 'MB'},
        'TB': {max: Number.MAX_SAFE_INTEGER, prev: 'GB'}
    };

    transform(input: any, decimal: number = 0, from: ByteUnit = 'B', to?: ByteUnit, plaintext = false, sigfigs?: number): any {

        if (!(isNumberFinite(input) &&
                isNumberFinite(decimal) &&
                isInteger(decimal) &&
                isPositive(decimal))) {
            return input;
        }

        let bytes = input;
        let unit = from;
        while (unit !== 'B') {
            bytes *= 1024;
            unit = BytesPipe.formats[unit].prev!;
        }

        let numberFormat = sigfigs == null ?
            (number) => toDecimal(number, decimal).toString() :
            (number) => toSigFigs(number, sigfigs);

        if (to) {
            const format = BytesPipe.formats[to];

            const result = numberFormat(BytesPipe.calculateResult(format, bytes));

            return BytesPipe.formatResult(result, to, plaintext);
        }

        for (const key in BytesPipe.formats) {
            const format = BytesPipe.formats[key];
            if (bytes < format.max) {

                const result = numberFormat(BytesPipe.calculateResult(format, bytes));

                return BytesPipe.formatResult(result, key, plaintext);
            }
        }
    }

    static formatResult(result: string, unit: string, plaintext): string {
        if (plaintext) {
            return `${result} ${unit}`;
        } else {
            return `${result} <span class="symbol">${unit}</span>`;
        }
    }

    static calculateResult(format: { max: number, prev?: ByteUnit }, bytes: number) {
        const prev = format.prev ? BytesPipe.formats[format.prev] : undefined;
        return prev ? bytes / prev.max : bytes;
    }
}
