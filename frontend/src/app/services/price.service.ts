import { Injectable } from '@angular/core';
import { map, Observable, of, shareReplay } from 'rxjs';
import { ApiService } from './api.service';

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
  historicalPrice: ConversionDict = {
    prices: null,
    exchangeRates: null,
  };

  constructor(
    private apiService: ApiService
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

  /**
   * Fetch prices from the nodejs backend only once
   */
  getPrices(): Observable<void> {
    if (this.historicalPrice.prices) {
      return of(null);
    }

    return this.apiService.getHistoricalPrice$().pipe(
      map((conversion: Conversion) => {
        if (!this.historicalPrice.prices) {
          this.historicalPrice.prices = Object();
        }
        for (const price of conversion.prices) {
          this.historicalPrice.prices[price.time] = {
            USD: price.USD, EUR: price.EUR, GBP: price.GBP, CAD: price.CAD,
            CHF: price.CHF, AUD: price.AUD, JPY: price.JPY
          };
        }
        this.historicalPrice.exchangeRates = conversion.exchangeRates;
        return;
      }),
      shareReplay(),
    );
  }

  /**
   * Note: The first block with a price we have is block 68952 (using MtGox price history)
   * 
   * @param blockTimestamp 
   */
  getPriceForTimestamp(blockTimestamp: number): Price | null {
    const priceTimestamps = Object.keys(this.historicalPrice.prices);
    priceTimestamps.push(Number.MAX_SAFE_INTEGER.toString());
    priceTimestamps.sort().reverse();
    
    // Small trick here. Because latest blocks have higher timestamps than our
    // latest price timestamp (we only insert once every hour), we have no price for them.
    // Therefore we want to fallback to the websocket price by returning an undefined `price` field.
    // Since this.historicalPrice.prices[Number.MAX_SAFE_INTEGER] does not exists
    // it will return `undefined` and automatically use the websocket price.
    // This way we can differenciate blocks without prices like the genesis block
    // vs ones without a price (yet) like the latest blocks

    for (const t of priceTimestamps) {
      const priceTimestamp = parseInt(t, 10);
      if (blockTimestamp > priceTimestamp) {
        return {
          price: this.historicalPrice.prices[priceTimestamp],
          exchangeRates: this.historicalPrice.exchangeRates,
        };
      }
    }

    return this.getEmptyPrice();
  }
}

