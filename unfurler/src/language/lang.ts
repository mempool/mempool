export interface Language {
  code: string;
  name: string;
}

const languageList: Language[] = [
  { code: 'ar', name: 'العربية' },         // Arabic
  { code: 'bg', name: 'Български' },       // Bulgarian
  { code: 'bs', name: 'Bosanski' },        // Bosnian
  { code: 'ca', name: 'Català' },          // Catalan
  { code: 'cs', name: 'Čeština' },         // Czech
  { code: 'da', name: 'Dansk' },           // Danish
  { code: 'de', name: 'Deutsch' },         // German
  { code: 'et', name: 'Eesti' },           // Estonian
  { code: 'el', name: 'Ελληνικά' },        // Greek
  { code: 'en', name: 'English' },         // English
  { code: 'es', name: 'Español' },         // Spanish
  { code: 'eo', name: 'Esperanto' },       // Esperanto
  { code: 'eu', name: 'Euskara' },         // Basque
  { code: 'fa', name: 'فارسی' },           // Persian
  { code: 'fr', name: 'Français' },        // French
  { code: 'gl', name: 'Galego' },          // Galician
  { code: 'ko', name: '한국어' },          // Korean
  { code: 'hr', name: 'Hrvatski' },        // Croatian
  { code: 'id', name: 'Bahasa Indonesia' },// Indonesian
  { code: 'hi', name: 'हिन्दी' },             // Hindi
  { code: 'it', name: 'Italiano' },        // Italian
  { code: 'he', name: 'עברית' },           // Hebrew
  { code: 'ka', name: 'ქართული' },         // Georgian
  { code: 'lv', name: 'Latviešu' },        // Latvian
  { code: 'lt', name: 'Lietuvių' },        // Lithuanian
  { code: 'hu', name: 'Magyar' },          // Hungarian
  { code: 'mk', name: 'Македонски' },      // Macedonian
  { code: 'ms', name: 'Bahasa Melayu' },   // Malay
  { code: 'nl', name: 'Nederlands' },      // Dutch
  { code: 'ja', name: '日本語' },          // Japanese
  { code: 'nb', name: 'Norsk' },           // Norwegian Bokmål
  { code: 'nn', name: 'Norsk Nynorsk' },   // Norwegian Nynorsk
  { code: 'pl', name: 'Polski' },          // Polish
  { code: 'pt', name: 'Português' },       // Portuguese
  { code: 'pt-BR', name: 'Português (Brazil)' }, // Portuguese (Brazil)
  { code: 'ro', name: 'Română' },          // Romanian
  { code: 'ru', name: 'Русский' },         // Russian
  { code: 'sk', name: 'Slovenčina' },      // Slovak
  { code: 'sl', name: 'Slovenščina' },     // Slovenian
  { code: 'sr', name: 'Српски / srpski' }, // Serbian
  { code: 'sh', name: 'Srpskohrvatski / српскохрватски' },// Serbo-Croatian
  { code: 'fi', name: 'Suomi' },           // Finnish
  { code: 'sv', name: 'Svenska' },         // Swedish
  { code: 'th', name: 'ไทย' },             // Thai
  { code: 'tr', name: 'Türkçe' },          // Turkish
  { code: 'uk', name: 'Українська' },      // Ukrainian
  { code: 'vi', name: 'Tiếng Việt' },      // Vietnamese
  { code: 'zh', name: '中文' },            // Chinese
];

const languageDict = {};
languageList.forEach(lang => {
  languageDict[lang.code] = lang
});
export const languages = languageDict;

// expects path to start with a leading '/'
export function parseLanguageUrl(path) {
  const parts = path.split('/').filter(part => part.length);
  let lang;
  let rest;
  if (languages[parts[0]]) {
    lang = parts[0];
    rest = '/' + parts.slice(1).join('/');
  } else {
    lang = null;
    rest = '/' + parts.join('/');
  }
  if (lang === 'en') {
    lang = null;
  }
  return { lang, path: rest };
}
