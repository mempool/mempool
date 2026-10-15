import { Injectable } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '@app/services/api.service';
import { MinFeeRateDay } from '@app/interfaces/node-api.interface';

export const DEFAULT_MIN_FEE_RATE_THRESHOLD = 0.1;

// minRate is a fee/vsize double, so a day sitting exactly on the threshold can land either side.
export const RATE_EPSILON = 1e-9;

export const MIN_FEE_RATE_TIMESPANS = ['1m', '3m', '6m', '1y', '2y', '3y', 'all'];

// Days of published history a period needs before its button is shown.
export const MIN_FEE_RATE_TIMESPAN_MIN_DAYS: Record<string, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  '2y': 730,
  '3y': 1095,
};

export const THRESHOLD_GRAB_RADIUS = 6;

@Injectable({ providedIn: 'root' })
export class MinFeeRateService {
  constructor(private apiService: ApiService) {}

  getMinFeeRates$(interval: string | undefined): Observable<HttpResponse<MinFeeRateDay[]>> {
    return this.apiService.getMinFeeRates$(interval);
  }

  // The mining window preference is shared across graphs and can name a period this
  // series has no button for yet. Over the whole history it returns what 'all' does.
  fitTimespan(timespan: string, dayCount: number): string {
    return dayCount < (MIN_FEE_RATE_TIMESPAN_MIN_DAYS[timespan] ?? 0) ? 'all' : timespan;
  }

  getPercentBelow(data: MinFeeRateDay[], threshold: number): number {
    if (data.length === 0) {
      return 0;
    }
    return (data.filter(d => d.minRate <= threshold + RATE_EPSILON).length / data.length) * 100;
  }

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
