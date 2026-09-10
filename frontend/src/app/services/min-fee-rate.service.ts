import { Injectable } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '@app/services/api.service';
import { MinFeeRateDay } from '@app/interfaces/node-api.interface';

export const DEFAULT_MIN_FEE_RATE_THRESHOLD = 0.1;

// minRate is a fee/vsize double, so a day sitting exactly on the threshold can land either side.
export const RATE_EPSILON = 1e-9;

export const MIN_FEE_RATE_TIMESPANS = ['1m', '3m', '6m', '1y', '2y', '3y', 'all'];

export const THRESHOLD_GRAB_RADIUS = 6;

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
