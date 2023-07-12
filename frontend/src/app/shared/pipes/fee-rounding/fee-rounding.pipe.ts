import { formatNumber } from "@angular/common";
import { Inject, LOCALE_ID, Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "feeRounding",
})
export class FeeRoundingPipe implements PipeTransform {
  constructor(
    @Inject(LOCALE_ID) private locale: string,
  ) {}

  transform(fee: number, rounding = null): string {
    if (rounding) {
      return formatNumber(fee, this.locale, rounding);
    }

    if (fee >= 100) {
      return formatNumber(fee, this.locale, '1.0-0')
    } else if (fee < 10) {
      return formatNumber(fee, this.locale, '1.2-2')
    }
    return formatNumber(fee, this.locale, '1.1-1')
  }
}
