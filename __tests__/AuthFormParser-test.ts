import {ParseBARSRequestVerificationToken} from '../src/API/Parsers/AuthFormParser';

describe('BARS authentication form token parser', () => {
  it('extracts the token for the requested form mode', () => {
    const page = `
      <form action="/bars_web/" method="post">
        <input name="__RequestVerificationToken" type="hidden" value="login-token">
        <input name="Account" type="text">
        <input name="Password" type="password">
      </form>
      <form action="/bars_web/Auth/LoginCode" method="post">
        <input name="__RequestVerificationToken" type="hidden" value="two-factor-token">
        <input name="Account" type="hidden" value="student">
        <input id="AF2_Code" name="AF2_Code" type="text">
      </form>
    `;

    expect(ParseBARSRequestVerificationToken(page, 'login')).toBe('login-token');
    expect(ParseBARSRequestVerificationToken(page, '2FA')).toBe('two-factor-token');
  });

  it('returns undefined when the requested form has no usable token', () => {
    expect(ParseBARSRequestVerificationToken(`
      <form>
        <input name="Password" type="password">
        <input name="__RequestVerificationToken" type="hidden" value="   ">
      </form>
    `, 'login')).toBeUndefined();
  });
});
