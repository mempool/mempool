import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "feeRounding",
})
export class FeeRoundingPipe implements PipeTransform {
  transform(fee: number): string {
    if (fee >= 100) {
      return fee.toFixed(0);
    } else if (fee < 10) {
      return fee.toFixed(2);
    }
    return fee.toFixed(1);
  }
}
