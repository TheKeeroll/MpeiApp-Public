import {ParseTwoFactorRequestVerificationToken} from '../src/API/Parsers/TwoFactorParser';

describe('two-factor verification token parser', () => {
  it('extracts the token from the form containing the confirmation-code input', () => {
    const page = `
      <form action="/bars_web/Auth/LoginCode" method="post">
        <input name="__RequestVerificationToken" type="hidden" value="verification-token">
        <input name="Account" type="hidden" value="student">
        <input id="AF2_Code" name="AF2_Code" type="text">
      </form>
      <form action="/other" method="post">
        <input name="__RequestVerificationToken" type="hidden" value="other-token">
      </form>
    `;

    expect(ParseTwoFactorRequestVerificationToken(page)).toBe('verification-token');
  });

  it('returns undefined when the two-factor form has no usable token', () => {
    expect(ParseTwoFactorRequestVerificationToken(`
      <form>
        <input id="AF2_Code" name="AF2_Code" type="text">
        <input name="__RequestVerificationToken" type="hidden" value="   ">
      </form>
    `)).toBeUndefined();
  });
});
