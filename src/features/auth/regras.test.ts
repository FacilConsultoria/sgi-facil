import { describe, expect, it } from 'vitest';
import { emailValido, normalizarEmail, senhaJaDefinida, validarNovaSenha } from './regras';

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

describe('senhaJaDefinida', () => {
  it('só considera definida quando a marca é verdadeira', () => {
    expect(senhaJaDefinida({ senha_definida: true })).toBe(true);
    expect(senhaJaDefinida({ senha_definida: 'true' })).toBe(false);
    expect(senhaJaDefinida({})).toBe(false);
    expect(senhaJaDefinida(undefined)).toBe(false);
    expect(senhaJaDefinida(null)).toBe(false);
  });
});

describe('validarNovaSenha', () => {
  it('aceita senha longa, com letras e números, igual à confirmação', () => {
    expect(validarNovaSenha('FacilSgi2027', 'FacilSgi2027')).toBe(null);
  });

  it('recusa senha curta', () => {
    expect(validarNovaSenha('Abc12345', 'Abc12345')).toBe('A senha precisa ter pelo menos 10 caracteres.');
  });

  it('recusa senha só de letras ou só de números', () => {
    expect(validarNovaSenha('SomenteLetrasAqui', 'SomenteLetrasAqui')).toBe('Misture letras e números na senha.');
    expect(validarNovaSenha('1234567890123', '1234567890123')).toBe('Misture letras e números na senha.');
  });

  it('recusa senha acima do limite do servidor', () => {
    const longa = 'a1'.repeat(37);
    expect(validarNovaSenha(longa, longa)).toBe('A senha pode ter no máximo 72 caracteres.');
  });

  it('recusa confirmação diferente', () => {
    expect(validarNovaSenha('FacilSgi2027', 'FacilSgi2028')).toBe('As duas senhas não são iguais.');
  });
});
