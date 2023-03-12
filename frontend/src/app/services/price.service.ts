import { Injectable } from '@angular/core';
import { map, Observable, of, share, shareReplay, tap } from 'rxjs';
import { ApiService } from './api.service';
import { StateService } from './state.service';

// nodejs backend interfaces
export interface ApiPrice {
  time?: number,
  USD: number,
  EUR: number,
  GBP: number,
  CAD: number,
  CHF: number,
  AUD: number,
  JPY: number,
}
export interface ExchangeRates {
  USDEUR: number,
  USDGBP: number,
  USDCAD: number,
  USDCHF: number,
  USDAUD: number,
  USDJPY: number,
}
export interface Conversion {
  prices: ApiPrice[],
  exchangeRates: ExchangeRates;
}

// frontend interface
export interface Price {
  price: ApiPrice,
  exchangeRates: ExchangeRates,
}
export interface ConversionDict {
  prices: { [timestamp: number]: ApiPrice }
  exchangeRates: ExchangeRates;
}

@Injectable({
  providedIn: 'root'
})
export class PriceService {
  priceObservable$: Observable<Conversion>;
  singlePriceObservable$: Observable<Conversion>;

  lastQueriedTimestamp: number;
  lastPriceHistoryUpdate: number;

  historicalPrice: ConversionDict = {
    prices: null,
    exchangeRates: null,
  };

  constructor(
    private apiService: ApiService,
    private stateService: StateService
  ) {
  }

  getEmptyPrice(): Price {
    return {
      price: {
        USD: 0, EUR: 0, GBP: 0, CAD: 0, CHF: 0, AUD: 0, JPY: 0,
      },
      exchangeRates: {
        USDEUR: 0, USDGBP: 0, USDCAD: 0, USDCHF: 0, USDAUD: 0, USDJPY: 0,
      },
    };
  }

  getBlockPrice$(blockTimestamp: number, singlePrice = false): Observable<Price | undefined> {
    if (this.stateService.env.BASE_MODULE !== 'mempool' || !this.stateService.env.HISTORICAL_PRICE) {
      return of(undefined);
    }

    const now = new Date().getTime() / 1000;

    /**
     * Query nearest price for a specific blockTimestamp. The observable is invalidated if we
     * query a different timestamp than the last one
     */
    if (singlePrice) {
      if (!this.singlePriceObservable$ || (this.singlePriceObservable$ && blockTimestamp !== this.lastQueriedTimestamp)) {
        this.singlePriceObservable$ = this.apiService.getHistoricalPrice$(blockTimestamp).pipe(shareReplay());
        this.lastQueriedTimestamp = blockTimestamp;
      }

      return this.singlePriceObservable$.pipe(
        map((conversion) => {
          if (conversion.prices.length <= 0) {
            return undefined;
          }
          return {
            price: {
              USD: conversion.prices[0].USD, EUR: conversion.prices[0].EUR, GBP: conversion.prices[0].GBP, CAD: conversion.prices[0].CAD,
              CHF: conversion.prices[0].CHF, AUD: conversion.prices[0].AUD, JPY: conversion.prices[0].JPY
            },
            exchangeRates: conversion.exchangeRates,
          };
        })
      );
    }

    /**
     * Query all price history only once. The observable is invalidated after 1 hour
     */
    else {
      if (!this.priceObservable$ || (this.priceObservable$ && (now - this.lastPriceHistoryUpdate > 3600))) {
        this.priceObservable$ = this.apiService.getHistoricalPrice$(undefined).pipe(shareReplay());
        this.lastPriceHistoryUpdate = new Date().getTime() / 1000;
      }

      return this.priceObservable$.pipe(
        map((conversion) => {
          if (!blockTimestamp || !conversion) {
            return undefined;
          }

          const historicalPrice = {
            prices: {},
            exchangeRates: conversion.exchangeRates,
          };
          for (const price of conversion.prices) {
            historicalPrice.prices[price.time] = {
              USD: price.USD, EUR: price.EUR, GBP: price.GBP, CAD: price.CAD,
              CHF: price.CHF, AUD: price.AUD, JPY: price.JPY
            };
          }

          const priceTimestamps = Object.keys(historicalPrice.prices);
          priceTimestamps.push(Number.MAX_SAFE_INTEGER.toString());
          priceTimestamps.sort().reverse();

          // Small trick here. Because latest blocks have higher timestamps than our
          // latest price timestamp (we only insert once every hour), we have no price for them.
          // Therefore we want to fallback to the websocket price by returning an undefined `price` field.
          // Since historicalPrice.prices[Number.MAX_SAFE_INTEGER] does not exists
          // it will return `undefined` and automatically use the websocket price.
          // This way we can differenciate blocks without prices like the genesis block
          // vs ones without a price (yet) like the latest blocks

          for (const t of priceTimestamps) {
            const priceTimestamp = parseInt(t, 10);
            if (blockTimestamp > priceTimestamp) {
              return {
                price: historicalPrice.prices[priceTimestamp],
                exchangeRates: historicalPrice.exchangeRates,
              };
            }
          }

          return this.getEmptyPrice();
        })
      );
    }
  }
}
