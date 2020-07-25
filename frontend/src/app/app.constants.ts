export const mempoolFeeColors = [
  '557d00',
  '5d7d01',
  '637d02',
  '6d7d04',
  '757d05',
  '7d7d06',
  '867d08',
  '8c7d09',
  '957d0b',
  '9b7d0c',
  'a67d0e',
  'aa7d0f',
  'b27d10',
  'bb7d11',
  'bf7d12',
  'bf7815',
  'bf7319',
  'be6c1e',
  'be6820',
  'bd6125',
  'bd5c28',
  'bc552d',
  'bc4f30',
  'bc4a34',
  'bb4339',
  'bb3d3c',
  'bb373f',
  'ba3243',
  'b92b48',
  'b9254b',
];

export const feeLevels = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
  250, 300, 350, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000];

interface Env {
  TESTNET_ENABLED: boolean;
  LIQUID_ENABLED: boolean;
  BISQ_ENABLED: boolean;
  BISQ_SEPARATE_BACKEND: boolean;
  ELCTRS_ITEMS_PER_PAGE: number;
  KEEP_BLOCKS_AMOUNT: number;
}

const defaultEnv: Env = {
  'TESTNET_ENABLED': false,
  'LIQUID_ENABLED': false,
  'BISQ_ENABLED': false,
  'BISQ_SEPARATE_BACKEND': false,
  'ELCTRS_ITEMS_PER_PAGE': 25,
  'KEEP_BLOCKS_AMOUNT': 8
};

const browserWindow = window || {};
// @ts-ignore
const browserWindowEnv = browserWindow.__env || {};
export const env: Env = Object.assign(defaultEnv, browserWindowEnv);
