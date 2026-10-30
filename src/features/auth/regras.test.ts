import { describe, expect, it } from 'vitest';
import { emailValido, normalizarEmail } from './regras';

describe('normalizarEmail', () => {
  it('remove espaços e usa minúsculas', () => {
    expect(normalizarEmail('  Victor@Gmail.COM ')).toBe('victor@gmail.com');
  });
});

describe('emailValido', () => {
  it('aceita e-mails comuns', () => {
    expect(emailValido('emilli@facil.com.br')).toBe(true);
  });

  it('recusa textos que não são e-mail', () => {
    expect(emailValido('emilli')).toBe(false);
    expect(emailValido('emilli@facil')).toBe(false);
    expect(emailValido('emi lli@facil.com')).toBe(false);
  });
});
