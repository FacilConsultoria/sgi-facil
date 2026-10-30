import { describe, expect, it } from 'vitest';
import { contarPalavras, plural } from './texto';

describe('plural', () => {
  it('usa o singular só para 1', () => {
    expect(plural(1, 'falta', 'faltas')).toBe('1 falta');
    expect(plural(0, 'falta', 'faltas')).toBe('0 faltas');
    expect(plural(3, 'falta', 'faltas')).toBe('3 faltas');
  });
});

describe('contarPalavras', () => {
  it('conta palavras ignorando espaços e quebras de linha', () => {
    expect(contarPalavras('  ata   de\nreunião  ')).toBe(3);
    expect(contarPalavras('   ')).toBe(0);
  });
});
