import { Injectable } from '@angular/core';
import { map, Observable, of, share, shareReplay, tap } from 'rxjs';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';

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
  BGN?: number,
  BRL?: number,
  CNY?: number,
  CZK?: number,
  DKK?: number,
  HKD?: number,
  HRK?: number,
  HUF?: number,
  IDR?: number,
  ILS?: number,
  INR?: number,
  ISK?: number,
  KRW?: number,
  MXN?: number,
  MYR?: number,
  NOK?: number,
  NZD?: number,
  PHP?: number,
  PLN?: number,
  RON?: number,
  RUB?: number,
  SEK?: number,
  SGD?: number,
  THB?: number,
  TRY?: number,
  ZAR?: number,
}
export interface ExchangeRates {
  USDEUR: number,
  USDGBP: number,
  USDCAD: number,
  USDCHF: number,
  USDAUD: number,
  USDJPY: number,
  USDBGN?: number,
  USDBRL?: number,
  USDCNY?: number,
  USDCZK?: number,
  USDDKK?: number,
  USDHKD?: number,
  USDHRK?: number,
  USDHUF?: number,
  USDIDR?: number,
  USDILS?: number,
  USDINR?: number,
  USDISK?: number,
  USDKRW?: number,
  USDMXN?: number,
  USDMYR?: number,
  USDNOK?: number,
  USDNZD?: number,
  USDPHP?: number,
  USDPLN?: number,
  USDRON?: number,
  USDRUB?: number,
  USDSEK?: number,
  USDSGD?: number,
  USDTHB?: number,
  USDTRY?: number,
  USDZAR?: number,
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
  lastQueriedCurrency: string;
  lastQueriedHistoricalCurrency: string;

  network: string;
  networkChangedSinceLastQuery = false;
  networkChangedSinceLastSingleQuery = false;

  historicalPrice: ConversionDict = {
    prices: null,
    exchangeRates: null,
  };

  constructor(
    private apiService: ApiService,
    private stateService: StateService
  ) {
    this.stateService.networkChanged$.subscribe((network: string) => {
      if (this.network !== network) {
        this.network = network;
        this.networkChangedSinceLastQuery = true;
        this.networkChangedSinceLastSingleQuery = true;
      }
    });
  }

  getEmptyPrice(): Price {
    return {
      price: this.stateService.env.ADDITIONAL_CURRENCIES ? {
        USD: 0, EUR: 0, GBP: 0, CAD: 0, CHF: 0, AUD: 0, JPY: 0, BGN: 0, BRL: 0, CNY: 0, CZK: 0, DKK: 0, HKD: 0, HRK: 0, HUF: 0, IDR: 0,
        ILS: 0, INR: 0, ISK: 0, KRW: 0, MXN: 0, MYR: 0, NOK: 0, NZD: 0, PHP: 0, PLN: 0, RON: 0, RUB: 0, SEK: 0, SGD: 0, THB: 0, TRY: 0,
        ZAR: 0
      } :
      {
        USD: 0, EUR: 0, GBP: 0, CAD: 0, CHF: 0, AUD: 0, JPY: 0,
      },
      exchangeRates: this.stateService.env.ADDITIONAL_CURRENCIES ? {
        USDEUR: 0, USDGBP: 0, USDCAD: 0, USDCHF: 0, USDAUD: 0, USDJPY: 0, USDBGN: 0, USDBRL: 0, USDCNY: 0, USDCZK: 0, USDDKK: 0, USDHKD: 0,
        USDHRK: 0, USDHUF: 0, USDIDR: 0, USDILS: 0, USDINR: 0, USDISK: 0, USDKRW: 0, USDMXN: 0, USDMYR: 0, USDNOK: 0, USDNZD: 0, USDPHP: 0,
        USDPLN: 0, USDRON: 0, USDRUB: 0, USDSEK: 0, USDSGD: 0, USDTHB: 0, USDTRY: 0, USDZAR: 0
      } : {
        USDEUR: 0, USDGBP: 0, USDCAD: 0, USDCHF: 0, USDAUD: 0, USDJPY: 0,
      },
    };
  }

  getBlockPrice$(blockTimestamp: number, singlePrice = false, currency: string): Observable<Price | undefined> {
    if (this.stateService.env.BASE_MODULE !== 'mempool' || !this.stateService.env.HISTORICAL_PRICE) {
      return of(undefined);
    }

    const now = new Date().getTime() / 1000;

    /**
     * Query nearest price for a specific blockTimestamp. The observable is invalidated if we
     * query a different timestamp than the last one
     */
    if (singlePrice) {
      if (!this.singlePriceObservable$ || (this.singlePriceObservable$ && (blockTimestamp !== this.lastQueriedTimestamp || currency !== this.lastQueriedCurrency || this.networkChangedSinceLastSingleQuery))) {
        this.singlePriceObservable$ = this.apiService.getHistoricalPrice$(blockTimestamp, currency).pipe(shareReplay());
        this.lastQueriedTimestamp = blockTimestamp;
        this.lastQueriedCurrency = currency;
        this.networkChangedSinceLastSingleQuery = false;
      }

      return this.singlePriceObservable$.pipe(
        map((conversion) => {
          if (conversion.prices.length <= 0) {
            return undefined;
          }
          return {
            price: this.stateService.env.ADDITIONAL_CURRENCIES ? {
              USD: conversion.prices[0].USD, EUR: conversion.prices[0].EUR, GBP: conversion.prices[0].GBP, CAD: conversion.prices[0].CAD,
              CHF: conversion.prices[0].CHF, AUD: conversion.prices[0].AUD, JPY: conversion.prices[0].JPY, BGN: conversion.prices[0].BGN,
              BRL: conversion.prices[0].BRL, CNY: conversion.prices[0].CNY, CZK: conversion.prices[0].CZK, DKK: conversion.prices[0].DKK,
              HKD: conversion.prices[0].HKD, HRK: conversion.prices[0].HRK, HUF: conversion.prices[0].HUF, IDR: conversion.prices[0].IDR,
              ILS: conversion.prices[0].ILS, INR: conversion.prices[0].INR, ISK: conversion.prices[0].ISK, KRW: conversion.prices[0].KRW,
              MXN: conversion.prices[0].MXN, MYR: conversion.prices[0].MYR, NOK: conversion.prices[0].NOK, NZD: conversion.prices[0].NZD,
              PHP: conversion.prices[0].PHP, PLN: conversion.prices[0].PLN, RON: conversion.prices[0].RON, RUB: conversion.prices[0].RUB,
              SEK: conversion.prices[0].SEK, SGD: conversion.prices[0].SGD, THB: conversion.prices[0].THB, TRY: conversion.prices[0].TRY,
              ZAR: conversion.prices[0].ZAR
            } : {
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
      if (!this.priceObservable$ || (this.priceObservable$ && (now - this.lastPriceHistoryUpdate > 3600 || currency !== this.lastQueriedHistoricalCurrency || this.networkChangedSinceLastQuery))) {
        this.priceObservable$ = this.apiService.getHistoricalPrice$(undefined, currency).pipe(shareReplay());
        this.lastPriceHistoryUpdate = new Date().getTime() / 1000;
        this.lastQueriedHistoricalCurrency = currency;
        this.networkChangedSinceLastQuery = false;
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
            historicalPrice.prices[price.time] = this.stateService.env.ADDITIONAL_CURRENCIES ? {
              USD: price.USD, EUR: price.EUR, GBP: price.GBP, CAD: price.CAD, CHF: price.CHF, AUD: price.AUD, 
              JPY: price.JPY, BGN: price.BGN, BRL: price.BRL, CNY: price.CNY, CZK: price.CZK, DKK: price.DKK,
              HKD: price.HKD, HRK: price.HRK, HUF: price.HUF, IDR: price.IDR, ILS: price.ILS, INR: price.INR,
              ISK: price.ISK, KRW: price.KRW, MXN: price.MXN, MYR: price.MYR, NOK: price.NOK, NZD: price.NZD,
              PHP: price.PHP, PLN: price.PLN, RON: price.RON, RUB: price.RUB, SEK: price.SEK, SGD: price.SGD,
              THB: price.THB, TRY: price.TRY, ZAR: price.ZAR
            } : {
              USD: price.USD, EUR: price.EUR, GBP: price.GBP, CAD: price.CAD, CHF: price.CHF, AUD: price.AUD, JPY: price.JPY
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

  getPriceByBulk$(timestamps: number[], currency: string): Observable<Price[]> {
    if (this.stateService.env.BASE_MODULE !== 'mempool' || !this.stateService.env.HISTORICAL_PRICE) {
      return of([]);
    }

    const now = new Date().getTime() / 1000;

    if (!this.priceObservable$ || (this.priceObservable$ && (now - this.lastPriceHistoryUpdate > 3600 || currency !== this.lastQueriedHistoricalCurrency || this.networkChangedSinceLastQuery))) {
      this.priceObservable$ = this.apiService.getHistoricalPrice$(undefined, currency).pipe(shareReplay());
      this.lastPriceHistoryUpdate = new Date().getTime() / 1000;
      this.lastQueriedHistoricalCurrency = currency;
      this.networkChangedSinceLastQuery = false;
    }

    return this.priceObservable$.pipe(
      map((conversion) => {
        if (!conversion) {
          return undefined;
        }

        const historicalPrice = {
          prices: {},
          exchangeRates: conversion.exchangeRates,
        };
        for (const price of conversion.prices) {
          historicalPrice.prices[price.time] = this.stateService.env.ADDITIONAL_CURRENCIES ? {
            USD: price.USD, EUR: price.EUR, GBP: price.GBP, CAD: price.CAD, CHF: price.CHF, AUD: price.AUD, 
            JPY: price.JPY, BGN: price.BGN, BRL: price.BRL, CNY: price.CNY, CZK: price.CZK, DKK: price.DKK,
            HKD: price.HKD, HRK: price.HRK, HUF: price.HUF, IDR: price.IDR, ILS: price.ILS, INR: price.INR,
            ISK: price.ISK, KRW: price.KRW, MXN: price.MXN, MYR: price.MYR, NOK: price.NOK, NZD: price.NZD,
            PHP: price.PHP, PLN: price.PLN, RON: price.RON, RUB: price.RUB, SEK: price.SEK, SGD: price.SGD,
            THB: price.THB, TRY: price.TRY, ZAR: price.ZAR
          } : {
            USD: price.USD, EUR: price.EUR, GBP: price.GBP, CAD: price.CAD, CHF: price.CHF, AUD: price.AUD, JPY: price.JPY
          };
        }
        
        const priceTimestamps = Object.keys(historicalPrice.prices).map(Number);
        priceTimestamps.push(Number.MAX_SAFE_INTEGER);
        priceTimestamps.sort((a, b) => b - a);

        const prices: Price[] = [];

        for (const timestamp of timestamps) {
          let left = 0;
          let right = priceTimestamps.length - 1;
          let match = -1;

          // Binary search to find the closest larger element
          while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (priceTimestamps[mid] > timestamp) {
              match = mid;
              left = mid + 1;
            } else {
              right = mid - 1;
            }
          }

          if (match !== -1) {
            const priceTimestamp = priceTimestamps[match];
            prices.push({
              price: historicalPrice.prices[priceTimestamp],
              exchangeRates: historicalPrice.exchangeRates,
            });
          }
        }
        return prices;
      }));
  }
}
