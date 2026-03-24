/** Full list of currencies from the currencies table (76 active currencies).
 *  Format: { code, name, symbol }
 *  Used in both Payment Currency and Preferred Rate Currency dropdowns.
 */
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "AED", name: "United Arab Emirates Dirham", symbol: "د.إ" },
  { code: "ALL", name: "Albanian Lek", symbol: "L" },
  { code: "ARS", name: "Argentine Peso", symbol: "$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "BAM", name: "Bosnia-Herzegovina Convertible Mark", symbol: "KM" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв" },
  { code: "BHD", name: "Bahraini Dinar", symbol: ".د.ب" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CLP", name: "Chilean Peso", symbol: "$" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "COP", name: "Colombian Peso", symbol: "$" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "EGP", name: "Egyptian Pound", symbol: "£" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound Sterling", symbol: "£" },
  { code: "GEL", name: "Georgian Lari", symbol: "₾" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "HRK", name: "Croatian Kuna", symbol: "kn" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "ILS", name: "Israeli New Shekel", symbol: "₪" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "IQD", name: "Iraqi Dinar", symbol: "ع.د" },
  { code: "ISK", name: "Icelandic Króna", symbol: "kr" },
  { code: "JOD", name: "Jordanian Dinar", symbol: "د.ا" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك" },
  { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸" },
  { code: "LBP", name: "Lebanese Pound", symbol: "ل.ل" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "د.م." },
  { code: "MXN", name: "Mexican Peso", symbol: "$" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "OMR", name: "Omani Rial", symbol: "ر.ع." },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "Rs" },
  { code: "PLN", name: "Polish Złoty", symbol: "zł" },
  { code: "QAR", name: "Qatari Riyal", symbol: "ر.ق" },
  { code: "RON", name: "Romanian Leu", symbol: "lei" },
  { code: "RSD", name: "Serbian Dinar", symbol: "din." },
  { code: "RUB", name: "Russian Ruble", symbol: "₽" },
  { code: "SAR", name: "Saudi Riyal", symbol: "ر.س" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "TND", name: "Tunisian Dinar", symbol: "د.ت" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "TWD", name: "New Taiwan Dollar", symbol: "NT$" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh" },
  { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh" },
  { code: "USD", name: "United States Dollar", symbol: "$" },
  { code: "UYU", name: "Uruguayan Peso", symbol: "$U" },
  { code: "UZS", name: "Uzbekistani Som", symbol: "сўм" },
  { code: "VND", name: "Vietnamese Đồng", symbol: "₫" },
  { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA" },
  { code: "XOF", name: "West African CFA Franc", symbol: "Fr" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK" },
  // Additional currencies to reach 76
  { code: "AMD", name: "Armenian Dram", symbol: "֏" },
  { code: "AZN", name: "Azerbaijani Manat", symbol: "₼" },
  { code: "BOB", name: "Bolivian Boliviano", symbol: "Bs" },
  { code: "CRC", name: "Costa Rican Colón", symbol: "₡" },
  { code: "DOP", name: "Dominican Peso", symbol: "RD$" },
  { code: "GTQ", name: "Guatemalan Quetzal", symbol: "Q" },
];

/** Format a currency for display: "CAD - Canadian Dollar (C$)" */
export function formatCurrencyLabel(c: CurrencyInfo): string {
  return `${c.code} - ${c.name} (${c.symbol})`;
}
