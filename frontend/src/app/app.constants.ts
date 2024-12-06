export const defaultMempoolFeeColors = [
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
  'b8214d',
  'b71d4f',
  'b61951',
  'b41453',
  'b30e55',
  'b10857',
  'b00259',
  'ae005b',
];

export const contrastMempoolFeeColors = [
  '0082e6',
  '0984df',
  '1285d9',
  '1a87d2',
  '2388cb',
  '2c8ac5',
  '358bbe',
  '3e8db7',
  '468eb0',
  '4f90aa',
  '5892a3',
  '61939c',
  '6a9596',
  '72968f',
  '7b9888',
  '849982',
  '8d9b7b',
  '959c74',
  '9e9e6e',
  'a79f67',
  'b0a160',
  'b9a35a',
  'c1a453',
  'caa64c',
  'd3a745',
  'dca93f',
  'e5aa38',
  'edac31',
  'f6ad2b',
  'ffaf24',
  'ffb01e',
  'ffb118',
  'ffb212',
  'ffb30c',
  'ffb406',
  'ffb500',
  'ffb600',
  'ffb700',
 ];

export const chartColors = [
  "#D81B60",
  "#8E24AA",
  "#5E35B1",
  "#3949AB",
  "#1E88E5",
  "#039BE5",
  "#00ACC1",
  "#00897B",
  "#43A047",
  "#7CB342",
  "#C0CA33",
  "#FDD835",
  "#FFB300",
  "#FB8C00",
  "#F4511E",
  "#6D4C41",
  "#757575",
  "#546E7A",
  "#b71c1c",
  "#880E4F",
  "#4A148C",
  "#311B92",
  "#1A237E",
  "#0D47A1",
  "#01579B",
  "#006064",
  "#004D40",
  "#1B5E20",
  "#33691E",
  "#827717",
  "#F57F17",
  "#FF6F00",
  "#E65100",
  "#BF360C",
  "#3E2723",
  "#212121",
  "#263238",
  "#801313",
];

export const poolsColor = {
  'unknown': '#FDD835',
};

export const feeLevels = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
  250, 300, 350, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000];

export interface Language {
  code: string;
  name: string;
}

export const languages: Language[] = [
   { code: 'ar', name: 'العربية' },         // Arabic
// { code: 'bg', name: 'Български' },       // Bulgarian
// { code: 'bs', name: 'Bosanski' },        // Bosnian
// { code: 'ca', name: 'Català' },          // Catalan
   { code: 'cs', name: 'Čeština' },         // Czech
   { code: 'da', name: 'Dansk' },           // Danish
   { code: 'de', name: 'Deutsch' },         // German
// { code: 'et', name: 'Eesti' },           // Estonian
// { code: 'el', name: 'Ελληνικά' },        // Greek
   { code: 'en', name: 'English' },         // English
   { code: 'es', name: 'Español' },         // Spanish
// { code: 'eo', name: 'Esperanto' },       // Esperanto
// { code: 'eu', name: 'Euskara' },         // Basque
   { code: 'fa', name: 'فارسی' },           // Persian
   { code: 'fr', name: 'Français' },        // French
// { code: 'gl', name: 'Galego' },          // Galician
   { code: 'ko', name: '한국어' },          // Korean
   { code: 'hr', name: 'Hrvatski' },        // Croatian
// { code: 'id', name: 'Bahasa Indonesia' },// Indonesian
   { code: 'hi', name: 'हिन्दी' },             // Hindi
   { code: 'ne', name: 'नेपाली' },            // Nepalese
   { code: 'it', name: 'Italiano' },        // Italian
   { code: 'he', name: 'עברית' },           // Hebrew
   { code: 'ka', name: 'ქართული' },         // Georgian
// { code: 'lv', name: 'Latviešu' },        // Latvian
   { code: 'lt', name: 'Lietuvių' },        // Lithuanian
   { code: 'hu', name: 'Magyar' },          // Hungarian
   { code: 'mk', name: 'Македонски' },      // Macedonian
// { code: 'ms', name: 'Bahasa Melayu' },   // Malay
   { code: 'nl', name: 'Nederlands' },      // Dutch
   { code: 'ja', name: '日本語' },          // Japanese
   { code: 'nb', name: 'Norsk' },           // Norwegian Bokmål
// { code: 'nn', name: 'Norsk Nynorsk' },   // Norwegian Nynorsk
   { code: 'pl', name: 'Polski' },          // Polish
   { code: 'pt', name: 'Português' },       // Portuguese
// { code: 'pt-BR', name: 'Português (Brazil)' }, // Portuguese (Brazil)
   { code: 'ro', name: 'Română' },          // Romanian
   { code: 'ru', name: 'Русский' },         // Russian
// { code: 'sk', name: 'Slovenčina' },      // Slovak
   { code: 'sl', name: 'Slovenščina' },     // Slovenian
// { code: 'sr', name: 'Српски / srpski' }, // Serbian
// { code: 'sh', name: 'Srpskohrvatski / српскохрватски' },// Serbo-Croatian
   { code: 'fi', name: 'Suomi' },           // Finnish
   { code: 'sv', name: 'Svenska' },         // Swedish
   { code: 'th', name: 'ไทย' },             // Thai
   { code: 'tr', name: 'Türkçe' },          // Turkish
   { code: 'uk', name: 'Українська' },      // Ukrainian
   { code: 'vi', name: 'Tiếng Việt' },      // Vietnamese
   { code: 'zh', name: '中文' },            // Chinese
];

export const specialBlocks = {
  '0': {
    labelEvent: 'Genesis',
    labelEventCompleted: 'The Genesis of Bitcoin',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '210000': {
    labelEvent: 'Bitcoin\'s 1st Halving',
    labelEventCompleted: 'Block Subsidy has halved to 25 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '420000': {
    labelEvent: 'Bitcoin\'s 2nd Halving',
    labelEventCompleted: 'Block Subsidy has halved to 12.5 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '630000': {
    labelEvent: 'Bitcoin\'s 3rd Halving',
    labelEventCompleted: 'Block Subsidy has halved to 6.25 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '709632': {
    labelEvent: 'Taproot 🌱 activation',
    labelEventCompleted: 'Taproot 🌱 has been activated!',
    networks: ['mainnet'],
  },
  '840000': {
    labelEvent: 'Bitcoin\'s 4th Halving',
    labelEventCompleted: 'Block Subsidy has halved to 3.125 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '1050000': {
    labelEvent: 'Bitcoin\'s 5th Halving',
    labelEventCompleted: 'Block Subsidy has halved to 1.5625 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '1260000': {
    labelEvent: 'Bitcoin\'s 6th Halving',
    labelEventCompleted: 'Block Subsidy has halved to 0.78125 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '1470000': {
    labelEvent: 'Bitcoin\'s 7th Halving',
    labelEventCompleted: 'Block Subsidy has halved to 0.390625 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '1680000': {
    labelEvent: 'Bitcoin\'s 8th Halving',
    labelEventCompleted: 'Block Subsidy has halved to 0.1953125 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '1890000': {
    labelEvent: 'Bitcoin\'s 9th Halving',
    labelEventCompleted: 'Block Subsidy has halved to 0.09765625 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '2100000': {
    labelEvent: 'Bitcoin\'s 10th Halving',
    labelEventCompleted: 'Block Subsidy has halved to 0.04882812 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '2310000': {
    labelEvent: 'Bitcoin\'s 11th Halving',
    labelEventCompleted: 'Block Subsidy has halved to 0.02441406 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '2520000': {
    labelEvent: 'Bitcoin\'s 12th Halving',
    labelEventCompleted: 'Block Subsidy has halved to 0.01220703 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '2730000': {
    labelEvent: 'Bitcoin\'s 13th Halving',
    labelEventCompleted: 'Block Subsidy has halved to 0.00610351 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '2940000': {
    labelEvent: 'Bitcoin\'s 14th Halving',
    labelEventCompleted: 'Block Subsidy has halved to 0.00305175 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  },
  '3150000': {
    labelEvent: 'Bitcoin\'s 15th Halving',
    labelEventCompleted: 'Block Subsidy has halved to 0.00152587 BTC per block',
    networks: ['mainnet', 'testnet', 'testnet4'],
  }
};

export const fiatCurrencies = {
  AUD: {
    name: 'Australian Dollar',
    code: 'AUD',
    indexed: true,
  },
  CAD: {
    name: 'Canadian Dollar',
    code: 'CAD',
    indexed: true,
  },
  CHF: {
    name: 'Swiss Franc',
    code: 'CHF',
    indexed: true,
  },
  EUR: {
    name: 'Euro',
    code: 'EUR',
    indexed: true,
  },
  GBP: {
    name: 'Pound Sterling',
    code: 'GBP',
    indexed: true,
  },
  JPY: {
    name: 'Japanese Yen',
    code: 'JPY',
    indexed: true,
  },
  USD: {
    name: 'US Dollar',
    code: 'USD',
    indexed: true,
  },
  BGN: {
    name: 'Bulgarian Lev',
    code: 'BGN',
    indexed: true,
  },
  BRL: {
    name: 'Brazilian Real',
    code: 'BRL',
    indexed: true,
  },
  CNY: {
    name: 'Chinese Yuan',
    code: 'CNY',
    indexed: true,
  },
  CZK: {
    name: 'Czech Koruna',
    code: 'CZK',
    indexed: true,
  },
  DKK: {
    name: 'Danish Krone',
    code: 'DKK',
    indexed: true,
  },
  HKD: {
    name: 'Hong Kong Dollar',
    code: 'HKD',
    indexed: true,
  },
  HRK: {
    name: 'Croatian Kuna',
    code: 'HRK',
    indexed: true,
  },
  HUF: {
    name: 'Hungarian Forint',
    code: 'HUF',
    indexed: true,
  },
  IDR: {
    name: 'Indonesian Rupiah',
    code: 'IDR',
    indexed: true,
  },
  ILS: {
    name: 'Israeli Shekel',
    code: 'ILS',
    indexed: true,
  },
  INR: {
    name: 'Indian Rupee',
    code: 'INR',
    indexed: true,
  },
  ISK: {
    name: 'Icelandic Krona',
    code: 'ISK',
    indexed: true,
  },
  KRW: {
    name: 'South Korean Won',
    code: 'KRW',
    indexed: true,
  },
  MXN: {
    name: 'Mexican Peso',
    code: 'MXN',
    indexed: true,
  },
  MYR: {
    name: 'Malaysian Ringgit',
    code: 'MYR',
    indexed: true,
  },
  NOK: {
    name: 'Norwegian Krone',
    code: 'NOK',
    indexed: true,
  },
  NZD: {
    name: 'New Zealand Dollar',
    code: 'NZD',
    indexed: true,
  },
  PHP: {
    name: 'Philippine Peso',
    code: 'PHP',
    indexed: true,
  },
  PLN: {
    name: 'Polish Zloty',
    code: 'PLN',
    indexed: true,
  },
  RON: {
    name: 'Romanian Leu',
    code: 'RON',
    indexed: true,
  },
  RUB: {
    name: 'Russian Ruble',
    code: 'RUB',
    indexed: true,
  },
  SEK: {
    name: 'Swedish Krona',
    code: 'SEK',
    indexed: true,
  },
  SGD: {
    name: 'Singapore Dollar',
    code: 'SGD',
    indexed: true,
  },
  THB: {
    name: 'Thai Baht',
    code: 'THB',
    indexed: true,
  },
  TRY: {
    name: 'Turkish Lira',
    code: 'TRY',
    indexed: true,
  },
  ZAR: {
    name: 'South African Rand',
    code: 'ZAR',
    indexed: true,
  },
};

export interface Timezone {
  offset: string;
  name: string;
}

export const timezones: Timezone[] = [
  { offset: '-12', name: 'Anywhere on Earth (AoE)' },
  { offset: '-11', name: 'Samoa Standard Time (SST)' },
  { offset: '-10', name: 'Hawaii Standard Time (HST)' },
  { offset: '-9', name: 'Alaska Standard Time (AKST)' },
  { offset: '-8', name: 'Pacific Standard Time (PST)' },
  { offset: '-7', name: 'Mountain Standard Time (MST)' },
  { offset: '-6', name: 'Central Standard Time (CST)' },
  { offset: '-5', name: 'Eastern Standard Time (EST)' },
  { offset: '-4', name: 'Atlantic Standard Time (AST)' },
  { offset: '-3', name: 'Argentina Time (ART)' },
  { offset: '-2', name: 'Fernando de Noronha Time (FNT)' },
  { offset: '-1', name: 'Azores Time (AZOT)' },
  { offset: '+0', name: 'Greenwich Mean Time (GMT)' },
  { offset: '+1', name: 'Central European Time (CET)' },
  { offset: '+2', name: 'Eastern European Time (EET)' },
  { offset: '+3', name: 'Moscow Standard Time (MSK)' },
  { offset: '+4', name: 'Armenia Time (AMT)' },
  { offset: '+5', name: 'Pakistan Standard Time (PKT)' },
  { offset: '+6', name: 'Xinjiang Time (XJT)' },
  { offset: '+7', name: 'Indochina Time (ICT)' },
  { offset: '+8', name: 'Hong Kong Time (HKT)' },
  { offset: '+9', name: 'Japan Standard Time (JST)' },
  { offset: '+10', name: 'Australian Eastern Standard Time (AEST)' },
  { offset: '+11', name: 'Norfolk Time (NFT)' },
  { offset: '+12', name: 'New Zealand Standard Time (NZST)' },
  { offset: '+13', name: 'Tonga Time (TOT)' },
  { offset: '+14', name: 'Line Islands Time (LINT)' }
];