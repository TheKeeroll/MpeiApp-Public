import {parse} from 'node-html-parser'

/**
 * Extracts the anti-forgery token specifically from the BARS two-factor form.
 * The token is optional because older BARS pages may omit it.
 */
export const ParseTwoFactorRequestVerificationToken = (raw: string): string | undefined => {
  try {
    const twoFactorForm = parse(raw)
      .querySelectorAll('form')
      .find(form => form.querySelector('input[name="AF2_Code"]') !== null)
    const token = twoFactorForm
      ?.querySelector('input[name="__RequestVerificationToken"]')
      ?.getAttribute('value')
      ?.trim()

    return token || undefined
  } catch {
    return undefined
  }
}
