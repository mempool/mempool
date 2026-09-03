import { Injectable } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '@app/services/api.service';
import { MinFeeRateDay } from '@app/interfaces/node-api.interface';

// Bitcoin Core 30.0 lowered the default -minrelaytxfee to 0.1 sat/vB, which is the
// reference threshold both charts open on.
export const DEFAULT_MIN_FEE_RATE_THRESHOLD = 0.1;

// minRate is a fee/vsize double, so a day sitting exactly on the threshold can land a few
// ulps either side of it. Well below the precision formatFeeRate prints.
export const RATE_EPSILON = 1e-9;

@Injectable({ providedIn: 'root' })
export class MinFeeRateService {
  constructor(private apiService: ApiService) {}

  getMinFeeRates$(interval: string | undefined): Observable<HttpResponse<MinFeeRateDay[]>> {
    return this.apiService.getMinFeeRates$(interval);
  }

  getPercentBelow(data: MinFeeRateDay[], threshold: number): number {
    if (data.length === 0) {
      return 0;
    }
    return (data.filter(d => d.minRate <= threshold + RATE_EPSILON).length / data.length) * 100;
  }

  // Duplicate rates collapse to one step, so the staircase stays monotonic.
  buildCdf(data: MinFeeRateDay[]): number[][] {
    if (data.length === 0) {
      return [];
    }
    const counts = new Map<number, number>();
    for (const d of data) {
      counts.set(d.minRate, (counts.get(d.minRate) || 0) + 1);
    }
    const rates = Array.from(counts.keys()).sort((a, b) => a - b);
    const cdf: number[][] = [];
    let cumulative = 0;
    for (const rate of rates) {
      cumulative += counts.get(rate);
      cdf.push([rate, (cumulative / data.length) * 100]);
    }
    return cdf;
  }

  // Sub-1 sat/vB values need more decimals to stay distinguishable from each other.
  formatFeeRate(val: number): string {
    if (val >= 100) {
      return val.toFixed(0);
    }
    if (val >= 10) {
      return val.toFixed(1);
    }
    if (val >= 0.1) {
      return val.toFixed(2);
    }
    if (val >= 0.01) {
      return val.toFixed(3);
    }
    if (val > 0) {
      return val.toFixed(4);
    }
    return '0';
  }
}
