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

export const feeLevels = [
  1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 250, 300, 350, 400, 500,
  600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000,
];

export interface Language {
  code: string;
  name: string;
}

export const languages: Language[] = [
  { code: 'ar', name: 'العربية' }, // Arabic
  // { code: 'bg', name: 'Български' },       // Bulgarian
  // { code: 'bs', name: 'Bosanski' },        // Bosnian
  // { code: 'ca', name: 'Català' },          // Catalan
  { code: 'cs', name: 'Čeština' }, // Czech
  // { code: 'da', name: 'Dansk' },           // Danish
  { code: 'de', name: 'Deutsch' }, // German
  // { code: 'et', name: 'Eesti' },           // Estonian
  // { code: 'el', name: 'Ελληνικά' },        // Greek
  { code: 'en', name: 'English' }, // English
  { code: 'es', name: 'Español' }, // Spanish
  // { code: 'eo', name: 'Esperanto' },       // Esperanto
  // { code: 'eu', name: 'Euskara' },         // Basque
  { code: 'fa', name: 'فارسی' }, // Persian
  { code: 'fr', name: 'Français' }, // French
  // { code: 'gl', name: 'Galego' },          // Galician
  { code: 'ko', name: '한국어' }, // Korean
  // { code: 'hr', name: 'Hrvatski' },        // Croatian
  // { code: 'id', name: 'Bahasa Indonesia' },// Indonesian
  { code: 'it', name: 'Italiano' }, // Italian
  { code: 'he', name: 'עברית' }, // Hebrew
  { code: 'ka', name: 'ქართული' }, // Georgian
  // { code: 'lv', name: 'Latviešu' },        // Latvian
  // { code: 'lt', name: 'Lietuvių' },        // Lithuanian
  { code: 'hu', name: 'Magyar' }, // Hungarian
  // { code: 'mk', name: 'Македонски' },      // Macedonian
  // { code: 'ms', name: 'Bahasa Melayu' },   // Malay
  { code: 'nl', name: 'Nederlands' }, // Dutch
  { code: 'ja', name: '日本語' }, // Japanese
  { code: 'nb', name: 'Norsk' }, // Norwegian Bokmål
  // { code: 'nn', name: 'Norsk Nynorsk' },   // Norwegian Nynorsk
  { code: 'pl', name: 'Polski' }, // Polish
  { code: 'pt', name: 'Português' }, // Portuguese
  // { code: 'pt-BR', name: 'Português (Brazil)' }, // Portuguese (Brazil)
  // { code: 'ro', name: 'Română' },          // Romanian
  { code: 'ru', name: 'Русский' }, // Russian
  // { code: 'sk', name: 'Slovenčina' },      // Slovak
  { code: 'sl', name: 'Slovenščina' }, // Slovenian
  // { code: 'sr', name: 'Српски / srpski' }, // Serbian
  // { code: 'sh', name: 'Srpskohrvatski / српскохрватски' },// Serbo-Croatian
  { code: 'fi', name: 'Suomi' }, // Finnish
  { code: 'sv', name: 'Svenska' }, // Swedish
  // { code: 'th', name: 'ไทย' },             // Thai
  { code: 'tr', name: 'Türkçe' }, // Turkish
  { code: 'uk', name: 'Українська' }, // Ukrainian
  { code: 'vi', name: 'Tiếng Việt' }, // Vietnamese
  { code: 'zh', name: '中文' }, // Chinese
];
