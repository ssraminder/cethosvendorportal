// Vendor-facing wording for a failed Twilio request.
//
// Twilio's own error bodies must never reach a vendor: they expose our account
// posture (error 20003 "Authenticate" tells the reader our credentials are
// broken, 21215 which countries we have enabled) and they are unactionable
// noise for the person reading them. Log the raw body, return one of these.
//
// `verb` names the thing that failed, capitalised for the start of a sentence
// — e.g. "The verification code", "The call".
//
// Adapted from the copy in vendor-interviews/index.ts, which predates this
// module and should adopt it the next time that function is deployed.
export function twilioErrorMessage(status: number, verb: string): string {
  if (status === 401 || status === 403) {
    return `${verb} couldn't be sent — text messaging isn't set up correctly on the Cethos side. Please contact Cethos.`;
  }
  if (status === 400) {
    return `${verb} couldn't be sent — that number doesn't look valid. Please check it and try again.`;
  }
  if (status === 429) {
    return `${verb} couldn't be sent right now — too many attempts. Please wait a moment and try again.`;
  }
  return `${verb} couldn't be sent. Please try again shortly.`;
}
