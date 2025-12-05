import { formatNumber } from "@angular/common";
import { Inject, LOCALE_ID, Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "feeRounding",
  standalone: false,
})
export class FeeRoundingPipe implements PipeTransform {
  constructor(
    @Inject(LOCALE_ID) private locale: string,
  ) {}

  transform(fee: number, rounding = null, dp = 3): string {
    if (rounding) {
      return formatNumber(fee, this.locale, rounding);
    }

    if (fee >= Math.pow(10, (dp || 3) - 1)) {
      return formatNumber(fee, this.locale, '1.0-0');
    } else if (fee < Math.pow(10, (dp || 3) - 2)) {
      return formatNumber(fee, this.locale, '1.2-2');
    }
    return formatNumber(fee, this.locale, '1.1-1');
  }
}
