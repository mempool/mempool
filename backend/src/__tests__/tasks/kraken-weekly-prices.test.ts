import KrakenApi from '../../tasks/price-feeds/kraken-api';
import PricesRepository from '../../repositories/PricesRepository';
import { query } from '../../utils/axios-query';

jest.mock('../../utils/axios-query', () => ({ query: jest.fn() }));
jest.mock('../../repositories/PricesRepository', () => ({
  __esModule: true,
  default: {
    $getMainCurrencyPrices: jest.fn(),
    $savePrices: jest.fn(),
    $updateMainCurrencyPrices: jest.fn(),
  },
}));
jest.mock('../../tasks/price-updater', () => ({
  __esModule: true,
  default: {
    getEmptyPricesObj: () => ({ USD: -1, EUR: -1, GBP: -1, CAD: -1, CHF: -1, AUD: -1, JPY: -1 }),
  },
}));

const HOUR = 3600;
const WEEK = 604800;
const T0 = 1739404800; // Thursday 2025-02-13 00:00 UTC

// Rows an hour either side, as the hourly price updater leaves around a live row
function hourlyNeighbours(time: number): { [time: number]: { [currency: string]: number } } {
  return { [time - HOUR]: { USD: 1 }, [time + HOUR]: { USD: 1 } };
}

// Kraken OHLC row: [time, open, high, low, close, vwap, volume, count]
function candle(time: number, open: string, close: string): any[] {
  return [time, open, '0', '0', close, '0', '0', 0];
}

const CURRENT_WEEK = T0 + 52 * WEEK;
const OTHER_CURRENCIES = (...withCandles: string[]) => ['USD', 'EUR', 'GBP', 'CAD', 'CHF', 'AUD', 'JPY'].filter(c => !withCandles.includes(c));

// Kraken's last candle is always the week in progress, so every mocked response ends with one
function mockKraken(candles: { [currency: string]: any[][] }): void {
  (query as jest.Mock).mockImplementation(async (url: string) => {
    const currency = url.slice(-3);
    const ticker = ['CHF', 'AUD'].includes(currency) ? `XBT${currency}` : `XXBTZ${currency}`;
    const rows = candles[currency] ? [...candles[currency], candle(CURRENT_WEEK, '60000.0', '61000.0')] : [];
    return { error: [], result: { [ticker]: rows, last: 0 } };
  });
}

function stored(rows: { [time: number]: { [currency: string]: number } }): void {
  (PricesRepository.$getMainCurrencyPrices as jest.Mock).mockResolvedValue(new Map(
    Object.entries(rows).map(([time, prices]) => [parseInt(time, 10), prices])
  ));
}

describe('Kraken weekly price history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('inserts a missing week with its opening price', async () => {
    stored({});
    mockKraken({ USD: [candle(T0, '97864.0', '96625.7')] });

    await new KrakenApi().$insertHistoricalPrice();

    expect(PricesRepository.$savePrices).toHaveBeenCalledTimes(2);
    expect(PricesRepository.$savePrices).toHaveBeenCalledWith(T0, expect.objectContaining({ USD: '97864.0' }));
    expect(PricesRepository.$updateMainCurrencyPrices).not.toHaveBeenCalled();
  });

  test('replaces a stored closing price with the opening price', async () => {
    stored({ ...hourlyNeighbours(T0), [T0]: { USD: 96625.7, EUR: 92531.4 }, [CURRENT_WEEK]: { USD: 61000 } });
    mockKraken({
      USD: [candle(T0, '97864.0', '96625.7')],
      EUR: [candle(T0, '93719.9', '92531.4')],
    });

    await new KrakenApi().$insertHistoricalPrice();

    expect(PricesRepository.$savePrices).not.toHaveBeenCalled();
    expect(PricesRepository.$updateMainCurrencyPrices).toHaveBeenCalledTimes(1);
    expect(PricesRepository.$updateMainCurrencyPrices).toHaveBeenCalledWith(T0, { USD: 97864.0, EUR: 93719.9 }, OTHER_CURRENCIES('USD', 'EUR'));
  });

  test('matches a closing price that MySQL returned rounded to six significant digits', async () => {
    stored({ ...hourlyNeighbours(T0), [T0]: { USD: 100496 } });
    mockKraken({ USD: [candle(T0, '95060.1', '100496.4')] });

    await new KrakenApi().$insertHistoricalPrice();

    expect(PricesRepository.$updateMainCurrencyPrices).toHaveBeenCalledWith(T0, { USD: 95060.1 }, OTHER_CURRENCIES('USD'));
  });

  test('replaces any price in a weekly row that has no hourly rows around it', async () => {
    // Weekly rows written by older imports do not always match Kraken's candles exactly
    stored({ [T0]: { USD: 182.3 } });
    mockKraken({ USD: [candle(T0, '290.0', '175.0')] });

    await new KrakenApi().$insertHistoricalPrice();

    expect(PricesRepository.$updateMainCurrencyPrices).toHaveBeenCalledWith(T0, { USD: 290.0 }, OTHER_CURRENCIES('USD'));
  });

  test('corrects only the currencies that hold the closing price', async () => {
    // USD is a live price recorded by the price updater; EUR came from the weekly import
    stored({ ...hourlyNeighbours(T0), [T0]: { USD: 97870, EUR: 92531.4 } });
    mockKraken({
      USD: [candle(T0, '97864.0', '96625.7')],
      EUR: [candle(T0, '93719.9', '92531.4')],
    });

    await new KrakenApi().$insertHistoricalPrice();

    expect(PricesRepository.$updateMainCurrencyPrices).toHaveBeenCalledWith(T0, { EUR: 93719.9 }, OTHER_CURRENCIES('USD', 'EUR'));
  });

  test('leaves a row without hourly neighbours that is nearer the opening price', async () => {
    // A live price recorded while the neighbouring hours were missing
    stored({ [T0]: { USD: 97800 } });
    mockKraken({ USD: [candle(T0, '97864.0', '96625.7')] });

    await new KrakenApi().$insertHistoricalPrice();

    expect(PricesRepository.$updateMainCurrencyPrices).not.toHaveBeenCalled();
  });

  test('leaves the current week, whose closing price is still changing', async () => {
    stored({ ...hourlyNeighbours(CURRENT_WEEK), [CURRENT_WEEK]: { USD: 61000 } });
    mockKraken({ USD: [] });

    await new KrakenApi().$insertHistoricalPrice();

    expect(PricesRepository.$updateMainCurrencyPrices).not.toHaveBeenCalled();
  });

  test('leaves rows that hold the opening price, a live price, a flat week or no price', async () => {
    stored({
      [T0]: { USD: 97864 },                     // already the opening price
      ...hourlyNeighbours(T0 + WEEK),
      [T0 + WEEK]: { USD: 95100 },              // live price, neither open nor close
      [T0 + 2 * WEEK]: { USD: 84112.1 },        // open equals close
      [T0 + 3 * WEEK]: { USD: -1 },             // missing price
    });
    mockKraken({
      USD: [
        candle(T0, '97864.0', '96625.7'),
        candle(T0 + WEEK, '96625.7', '96632.0'),
        candle(T0 + 2 * WEEK, '84112.1', '84112.1'),
        candle(T0 + 3 * WEEK, '84112.1', '90610.0'),
      ],
    });

    await new KrakenApi().$insertHistoricalPrice();

    expect(PricesRepository.$updateMainCurrencyPrices).not.toHaveBeenCalled();
  });

  test('does nothing when Kraken does not answer', async () => {
    stored({ [T0]: { USD: 96625.7 } });
    (query as jest.Mock).mockResolvedValue(undefined);

    await new KrakenApi().$insertHistoricalPrice();

    expect(PricesRepository.$savePrices).not.toHaveBeenCalled();
    expect(PricesRepository.$updateMainCurrencyPrices).not.toHaveBeenCalled();
  });
});
