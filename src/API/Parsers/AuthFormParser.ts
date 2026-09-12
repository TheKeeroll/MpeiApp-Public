import {parse} from 'node-html-parser'

export type BARSAuthFormMode = 'login' | '2FA'

const FORM_MARKER_FIELD: Record<BARSAuthFormMode, string> = {
  login: 'Password',
  '2FA': 'AF2_Code',
}

/**
 * Extracts the anti-forgery token from the requested BARS authentication form.
 * The token is optional because older BARS pages may omit it.
 */
export const ParseBARSRequestVerificationToken = (
  raw: string,
  mode: BARSAuthFormMode,
): string | undefined => {
  try {
    const markerField = FORM_MARKER_FIELD[mode]
    const authForm = parse(raw)
      .querySelectorAll('form')
      .find(form => form.querySelector(`input[name="${markerField}"]`) !== null)
    const token = authForm
      ?.querySelector('input[name="__RequestVerificationToken"]')
      ?.getAttribute('value')
      ?.trim()

    return token || undefined
  } catch {
    return undefined
  }
}
