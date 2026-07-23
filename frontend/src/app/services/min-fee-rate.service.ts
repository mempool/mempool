import { Injectable } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '@app/services/api.service';
import { MinFeeRateDay } from '@app/interfaces/node-api.interface';

// Bitcoin Core 30.0 lowered the default -minrelaytxfee to 0.1 sat/vB, which is the
// reference threshold both charts open on.
export const DEFAULT_MIN_FEE_RATE_THRESHOLD = 0.1;

export interface MinFeeRateStats {
  totalDays: number;
  medianRate: number;
  daysBelow: number;
  percentBelow: number;
}

@Injectable({ providedIn: 'root' })
export class MinFeeRateService {
  constructor(private apiService: ApiService) {}

  getMinFeeRates$(interval: string | undefined): Observable<HttpResponse<MinFeeRateDay[]>> {
    return this.apiService.getMinFeeRates$(interval);
  }

  getStats(data: MinFeeRateDay[], threshold: number): MinFeeRateStats {
    const totalDays = data.length;
    if (totalDays === 0) {
      return { totalDays: 0, medianRate: 0, daysBelow: 0, percentBelow: 0 };
    }
    const rates = data.map(d => d.minRate).sort((a, b) => a - b);
    const mid = Math.floor(rates.length / 2);
    const medianRate = rates.length % 2 === 0 ? (rates[mid - 1] + rates[mid]) / 2 : rates[mid];
    const daysBelow = rates.filter(r => r <= threshold).length;
    return {
      totalDays,
      medianRate,
      daysBelow,
      percentBelow: (daysBelow / totalDays) * 100,
    };
  }

  // Cumulative share of days whose minRate is <= a given fee rate. Duplicate rates are
  // collapsed to a single step so the staircase stays monotonic and clean.
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

  // Minimum daily fee rates are often sub-1 sat/vB, so round adaptively: more decimals
  // below 1 to keep values distinguishable, fewer as they grow.
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
