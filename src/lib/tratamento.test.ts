import { describe, expect, it } from 'vitest';
import { cargo, comInicialMaiuscula, definirTratamentos, presidenteOuVice, tratamentoValido } from './tratamento';

// cada teste define o tratamento de que precisa (o estado é do módulo)

describe('sem tratamento informado', () => {
  it('usa o nome do cargo, sem presumir gênero', () => {
    definirTratamentos([]);
    expect(cargo('presidente')).toBe('a Presidência');
    expect(cargo('vice')).toBe('a Vice-Presidência');
    expect(cargo('presidente', 'de')).toBe('da Presidência');
    expect(presidenteOuVice('de')).toBe('da Presidência ou da Vice-Presidência');
  });

  it('trata valor desconhecido ou ausente como neutro', () => {
    definirTratamentos([{ papel: 'presidente', tratamento: 'x' }, { papel: 'vice' }]);
    expect(presidenteOuVice()).toBe('a Presidência ou a Vice-Presidência');
    expect(tratamentoValido(undefined)).toBe('neutro');
    expect(tratamentoValido('outro')).toBe('neutro');
  });
});

describe('com tratamento informado', () => {
  it('concorda com quem ocupa cada cargo', () => {
    definirTratamentos([{ papel: 'presidente', tratamento: 'feminino' }, { papel: 'vice', tratamento: 'masculino' }]);
    expect(cargo('presidente')).toBe('a Presidente');
    expect(cargo('vice')).toBe('o Vice-Presidente');
    expect(cargo('presidente', 'de')).toBe('da Presidente');
    expect(cargo('vice', 'de')).toBe('do Vice-Presidente');
    expect(cargo('presidente', 'a')).toBe('à Presidente');
    expect(cargo('vice', 'a')).toBe('ao Vice-Presidente');
    expect(presidenteOuVice('de')).toBe('da Presidente ou do Vice-Presidente');
    expect(presidenteOuVice()).toBe('a Presidente ou o Vice-Presidente');
  });

  it('cada cargo segue o próprio tratamento, e só pessoas ativas contam', () => {
    definirTratamentos([
      { papel: 'presidente', tratamento: 'masculino', ativo: false },
      { papel: 'presidente', tratamento: 'feminino', ativo: true },
      { papel: 'vice', tratamento: 'neutro', ativo: true },
    ]);
    expect(presidenteOuVice('de')).toBe('da Presidente ou da Vice-Presidência');
  });

  it('o tratamento neutro mantém o nome do cargo', () => {
    definirTratamentos([{ papel: 'presidente', tratamento: 'neutro' }]);
    expect(cargo('presidente')).toBe('a Presidência');
  });
});

describe('comInicialMaiuscula', () => {
  it('põe a inicial em maiúscula para começar frase', () => {
    expect(comInicialMaiuscula('a Presidente ou o Vice-Presidente')).toBe('A Presidente ou o Vice-Presidente');
    expect(comInicialMaiuscula('')).toBe('');
  });
});
