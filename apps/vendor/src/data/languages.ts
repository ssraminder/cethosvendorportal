/** Comprehensive language list based on ISO 639-1 + IETF BCP 47.
 *  Includes base languages and regional/locale variants.
 *  Codes match what vendor_language_pairs stores (e.g., EN, EN-US, FR-CA).
 */
export interface LanguageEntry {
  code: string;
  name: string;
  group: string;
}

export const LANGUAGES: LanguageEntry[] = [
  // Afrikaans
  { code: "AF", name: "Afrikaans", group: "Afrikaans" },

  // Albanian
  { code: "SQ", name: "Albanian", group: "Albanian" },

  // Amharic
  { code: "AM", name: "Amharic", group: "Amharic" },

  // Arabic
  { code: "AR", name: "Arabic", group: "Arabic" },
  { code: "AR-AE", name: "Arabic (UAE)", group: "Arabic" },
  { code: "AR-DZ", name: "Arabic (Algeria)", group: "Arabic" },
  { code: "AR-EG", name: "Arabic (Egypt)", group: "Arabic" },
  { code: "AR-IQ", name: "Arabic (Iraq)", group: "Arabic" },
  { code: "AR-JO", name: "Arabic (Jordan)", group: "Arabic" },
  { code: "AR-KW", name: "Arabic (Kuwait)", group: "Arabic" },
  { code: "AR-LB", name: "Arabic (Lebanon)", group: "Arabic" },
  { code: "AR-MA", name: "Arabic (Morocco)", group: "Arabic" },
  { code: "AR-QA", name: "Arabic (Qatar)", group: "Arabic" },
  { code: "AR-SA", name: "Arabic (Saudi Arabia)", group: "Arabic" },
  { code: "AR-TN", name: "Arabic (Tunisia)", group: "Arabic" },

  // Armenian
  { code: "HY", name: "Armenian", group: "Armenian" },

  // Azerbaijani
  { code: "AZ", name: "Azerbaijani", group: "Azerbaijani" },

  // Basque
  { code: "EU", name: "Basque", group: "Basque" },

  // Belarusian
  { code: "BE", name: "Belarusian", group: "Belarusian" },

  // Bengali
  { code: "BN", name: "Bengali", group: "Bengali" },
  { code: "BN-BD", name: "Bengali (Bangladesh)", group: "Bengali" },
  { code: "BN-IN", name: "Bengali (India)", group: "Bengali" },

  // Bosnian
  { code: "BS", name: "Bosnian", group: "Bosnian" },

  // Bulgarian
  { code: "BG", name: "Bulgarian", group: "Bulgarian" },

  // Burmese
  { code: "MY", name: "Burmese", group: "Burmese" },

  // Catalan
  { code: "CA", name: "Catalan", group: "Catalan" },

  // Chinese
  { code: "ZH", name: "Chinese", group: "Chinese" },
  { code: "ZH-CN", name: "Chinese (Simplified)", group: "Chinese" },
  { code: "ZH-TW", name: "Chinese (Traditional)", group: "Chinese" },
  { code: "ZH-HK", name: "Chinese (Hong Kong)", group: "Chinese" },
  { code: "ZH-SG", name: "Chinese (Singapore)", group: "Chinese" },

  // Croatian
  { code: "HR", name: "Croatian", group: "Croatian" },

  // Czech
  { code: "CS", name: "Czech", group: "Czech" },

  // Danish
  { code: "DA", name: "Danish", group: "Danish" },

  // Dutch
  { code: "NL", name: "Dutch", group: "Dutch" },
  { code: "NL-BE", name: "Dutch (Belgium)", group: "Dutch" },
  { code: "NL-NL", name: "Dutch (Netherlands)", group: "Dutch" },

  // English
  { code: "EN", name: "English", group: "English" },
  { code: "EN-AU", name: "English (Australia)", group: "English" },
  { code: "EN-CA", name: "English (Canada)", group: "English" },
  { code: "EN-GB", name: "English (UK)", group: "English" },
  { code: "EN-IE", name: "English (Ireland)", group: "English" },
  { code: "EN-IN", name: "English (India)", group: "English" },
  { code: "EN-NZ", name: "English (New Zealand)", group: "English" },
  { code: "EN-PH", name: "English (Philippines)", group: "English" },
  { code: "EN-SG", name: "English (Singapore)", group: "English" },
  { code: "EN-US", name: "English (US)", group: "English" },
  { code: "EN-ZA", name: "English (South Africa)", group: "English" },

  // Estonian
  { code: "ET", name: "Estonian", group: "Estonian" },

  // Farsi / Persian
  { code: "FA", name: "Farsi (Persian)", group: "Farsi" },
  { code: "FA-AF", name: "Dari (Afghanistan)", group: "Farsi" },
  { code: "FA-IR", name: "Farsi (Iran)", group: "Farsi" },

  // Filipino / Tagalog
  { code: "FIL", name: "Filipino", group: "Filipino" },
  { code: "TL", name: "Tagalog", group: "Filipino" },

  // Finnish
  { code: "FI", name: "Finnish", group: "Finnish" },

  // French
  { code: "FR", name: "French", group: "French" },
  { code: "FR-BE", name: "French (Belgium)", group: "French" },
  { code: "FR-CA", name: "French (Canada)", group: "French" },
  { code: "FR-CH", name: "French (Switzerland)", group: "French" },
  { code: "FR-FR", name: "French (France)", group: "French" },
  { code: "FR-LU", name: "French (Luxembourg)", group: "French" },

  // Galician
  { code: "GL", name: "Galician", group: "Galician" },

  // Georgian
  { code: "KA", name: "Georgian", group: "Georgian" },

  // German
  { code: "DE", name: "German", group: "German" },
  { code: "DE-AT", name: "German (Austria)", group: "German" },
  { code: "DE-CH", name: "German (Switzerland)", group: "German" },
  { code: "DE-DE", name: "German (Germany)", group: "German" },
  { code: "DE-LU", name: "German (Luxembourg)", group: "German" },

  // Greek
  { code: "EL", name: "Greek", group: "Greek" },

  // Gujarati
  { code: "GU", name: "Gujarati", group: "Gujarati" },

  // Hausa
  { code: "HA", name: "Hausa", group: "Hausa" },

  // Hebrew
  { code: "HE", name: "Hebrew", group: "Hebrew" },

  // Hindi
  { code: "HI", name: "Hindi", group: "Hindi" },

  // Hungarian
  { code: "HU", name: "Hungarian", group: "Hungarian" },

  // Icelandic
  { code: "IS", name: "Icelandic", group: "Icelandic" },

  // Igbo
  { code: "IG", name: "Igbo", group: "Igbo" },

  // Indonesian
  { code: "ID", name: "Indonesian", group: "Indonesian" },

  // Irish
  { code: "GA", name: "Irish", group: "Irish" },

  // Italian
  { code: "IT", name: "Italian", group: "Italian" },
  { code: "IT-CH", name: "Italian (Switzerland)", group: "Italian" },
  { code: "IT-IT", name: "Italian (Italy)", group: "Italian" },

  // Japanese
  { code: "JA", name: "Japanese", group: "Japanese" },

  // Javanese
  { code: "JV", name: "Javanese", group: "Javanese" },

  // Kannada
  { code: "KN", name: "Kannada", group: "Kannada" },

  // Kazakh
  { code: "KK", name: "Kazakh", group: "Kazakh" },

  // Khmer
  { code: "KM", name: "Khmer", group: "Khmer" },

  // Korean
  { code: "KO", name: "Korean", group: "Korean" },
  { code: "KO-KR", name: "Korean (South Korea)", group: "Korean" },
  { code: "KO-KP", name: "Korean (North Korea)", group: "Korean" },

  // Kurdish
  { code: "KU", name: "Kurdish", group: "Kurdish" },

  // Kyrgyz
  { code: "KY", name: "Kyrgyz", group: "Kyrgyz" },

  // Lao
  { code: "LO", name: "Lao", group: "Lao" },

  // Latvian
  { code: "LV", name: "Latvian", group: "Latvian" },

  // Lithuanian
  { code: "LT", name: "Lithuanian", group: "Lithuanian" },

  // Macedonian
  { code: "MK", name: "Macedonian", group: "Macedonian" },

  // Malay
  { code: "MS", name: "Malay", group: "Malay" },
  { code: "MS-MY", name: "Malay (Malaysia)", group: "Malay" },
  { code: "MS-SG", name: "Malay (Singapore)", group: "Malay" },

  // Malayalam
  { code: "ML", name: "Malayalam", group: "Malayalam" },

  // Maltese
  { code: "MT", name: "Maltese", group: "Maltese" },

  // Marathi
  { code: "MR", name: "Marathi", group: "Marathi" },

  // Mongolian
  { code: "MN", name: "Mongolian", group: "Mongolian" },

  // Nepali
  { code: "NE", name: "Nepali", group: "Nepali" },

  // Norwegian
  { code: "NO", name: "Norwegian", group: "Norwegian" },
  { code: "NB", name: "Norwegian Bokmål", group: "Norwegian" },
  { code: "NN", name: "Norwegian Nynorsk", group: "Norwegian" },

  // Pashto
  { code: "PS", name: "Pashto", group: "Pashto" },

  // Polish
  { code: "PL", name: "Polish", group: "Polish" },

  // Portuguese
  { code: "PT", name: "Portuguese", group: "Portuguese" },
  { code: "PT-BR", name: "Portuguese (Brazil)", group: "Portuguese" },
  { code: "PT-PT", name: "Portuguese (Portugal)", group: "Portuguese" },

  // Punjabi
  { code: "PA", name: "Punjabi", group: "Punjabi" },

  // Romanian
  { code: "RO", name: "Romanian", group: "Romanian" },

  // Russian
  { code: "RU", name: "Russian", group: "Russian" },

  // Serbian
  { code: "SR", name: "Serbian", group: "Serbian" },
  { code: "SR-CYRL", name: "Serbian (Cyrillic)", group: "Serbian" },
  { code: "SR-LATN", name: "Serbian (Latin)", group: "Serbian" },

  // Sinhala
  { code: "SI", name: "Sinhala", group: "Sinhala" },

  // Slovak
  { code: "SK", name: "Slovak", group: "Slovak" },

  // Slovenian
  { code: "SL", name: "Slovenian", group: "Slovenian" },

  // Somali
  { code: "SO", name: "Somali", group: "Somali" },

  // Spanish
  { code: "ES", name: "Spanish", group: "Spanish" },
  { code: "ES-AR", name: "Spanish (Argentina)", group: "Spanish" },
  { code: "ES-CL", name: "Spanish (Chile)", group: "Spanish" },
  { code: "ES-CO", name: "Spanish (Colombia)", group: "Spanish" },
  { code: "ES-ES", name: "Spanish (Spain)", group: "Spanish" },
  { code: "ES-MX", name: "Spanish (Mexico)", group: "Spanish" },
  { code: "ES-PE", name: "Spanish (Peru)", group: "Spanish" },
  { code: "ES-US", name: "Spanish (US)", group: "Spanish" },
  { code: "ES-VE", name: "Spanish (Venezuela)", group: "Spanish" },

  // Swahili
  { code: "SW", name: "Swahili", group: "Swahili" },

  // Swedish
  { code: "SV", name: "Swedish", group: "Swedish" },
  { code: "SV-FI", name: "Swedish (Finland)", group: "Swedish" },
  { code: "SV-SE", name: "Swedish (Sweden)", group: "Swedish" },

  // Tamil
  { code: "TA", name: "Tamil", group: "Tamil" },
  { code: "TA-IN", name: "Tamil (India)", group: "Tamil" },
  { code: "TA-LK", name: "Tamil (Sri Lanka)", group: "Tamil" },

  // Telugu
  { code: "TE", name: "Telugu", group: "Telugu" },

  // Thai
  { code: "TH", name: "Thai", group: "Thai" },

  // Turkish
  { code: "TR", name: "Turkish", group: "Turkish" },

  // Ukrainian
  { code: "UK", name: "Ukrainian", group: "Ukrainian" },

  // Urdu
  { code: "UR", name: "Urdu", group: "Urdu" },
  { code: "UR-IN", name: "Urdu (India)", group: "Urdu" },
  { code: "UR-PK", name: "Urdu (Pakistan)", group: "Urdu" },

  // Uzbek
  { code: "UZ", name: "Uzbek", group: "Uzbek" },

  // Vietnamese
  { code: "VI", name: "Vietnamese", group: "Vietnamese" },

  // Welsh
  { code: "CY", name: "Welsh", group: "Welsh" },

  // Wolof
  { code: "WO", name: "Wolof", group: "Wolof" },

  // Xhosa
  { code: "XH", name: "Xhosa", group: "Xhosa" },

  // Yoruba
  { code: "YO", name: "Yoruba", group: "Yoruba" },

  // Zulu
  { code: "ZU", name: "Zulu", group: "Zulu" },
];
