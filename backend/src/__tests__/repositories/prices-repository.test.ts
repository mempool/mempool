import PricesRepository from '../../repositories/PricesRepository';
import DB from '../../database';

jest.mock('../../database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../tasks/price-updater', () => ({ __esModule: true, default: {} }));

describe('PricesRepository.$updateMainCurrencyPrices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('updates USD and resets the currencies derived from it', async () => {
    await PricesRepository.$updateMainCurrencyPrices(1739404800, { USD: 97864, EUR: 93719.9 }, ['CHF', 'AUD', 'EUR', 'XYZ']);

    const [sql, params] = (DB.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/SET USD = \?, EUR = \?, CHF = -1, AUD = -1, BGN = -1, /);
    expect(sql).toContain('ZAR = -1');
    expect(sql).not.toContain('XYZ');
    expect(sql).not.toContain('EUR = -1');
    expect(sql).toContain('WHERE time = FROM_UNIXTIME(?)');
    expect(params).toEqual([97864, 93719.9, 1739404800]);
  });

  test('resets nothing when USD is not updated', async () => {
    await PricesRepository.$updateMainCurrencyPrices(1739404800, { EUR: 93719.9 }, ['CHF']);

    const [sql, params] = (DB.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/SET EUR = \?\s+WHERE/);
    expect(params).toEqual([93719.9, 1739404800]);
  });

  test('ignores columns that are not main currencies', async () => {
    await PricesRepository.$updateMainCurrencyPrices(1739404800, { 'USD; DROP TABLE prices': 1 });

    expect(DB.query).not.toHaveBeenCalled();
  });
});
