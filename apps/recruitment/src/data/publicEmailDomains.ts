// Mirror of supabase/functions/_shared/public-email-domains.ts — keep in
// sync. Frontend uses this for instant feedback on the references form;
// the server is still the authoritative validator.

export const PUBLIC_EMAIL_DOMAINS = new Set<string>([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "yahoo.ca",
  "yahoo.fr",
  "yahoo.de",
  "yahoo.es",
  "yahoo.it",
  "ymail.com",
  "rocketmail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "web.de",
  "t-online.de",
  "freenet.de",
  "mail.com",
  "fastmail.com",
  "fastmail.fm",
  "hey.com",
  "hushmail.com",
  "tutanota.com",
  "tutanota.de",
  "tuta.io",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "mail.ru",
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
  "sina.cn",
  "sohu.com",
  "yeah.net",
  "naver.com",
  "daum.net",
  "rediffmail.com",
]);

export function isPublicEmailDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const host = email.slice(at + 1).trim().toLowerCase();
  return PUBLIC_EMAIL_DOMAINS.has(host);
}
