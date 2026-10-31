import { describe, expect, it } from 'vitest';
import type { FrequenciaDaPessoa } from '../../types/database';
import { descreverTaxa, introducaoDaFrequencia, ordenarPorFrequencia, taxaDeFrequencia } from './regras';

function linha(campos: Partial<FrequenciaDaPessoa>): FrequenciaDaPessoa {
  return { pessoa_id: 'u1', nome: 'Ana', setor: 'Clientes', convocacoes: 4, presencas: 3, justificadas: 0, faltas: 1, ...campos };
}

describe('taxaDeFrequencia', () => {
  it('é o percentual de presenças entre as convocações, arredondado', () => {
    expect(taxaDeFrequencia(linha({}))).toBe(75);
    expect(taxaDeFrequencia(linha({ convocacoes: 3, presencas: 2 }))).toBe(67);
    expect(taxaDeFrequencia(linha({ convocacoes: 5, presencas: 0 }))).toBe(0);
  });

  it('é nula sem convocação', () => {
    expect(taxaDeFrequencia(linha({ convocacoes: 0, presencas: 0 }))).toBe(null);
  });

  it('descreve a taxa', () => {
    expect(descreverTaxa(75)).toBe('75%');
    expect(descreverTaxa(0)).toBe('0%');
    expect(descreverTaxa(null)).toBe('–');
  });
});

describe('ordenarPorFrequencia', () => {
  it('põe as menores taxas primeiro, sem convocação por último, e desempata por nome', () => {
    const lista = [
      linha({ pessoa_id: 'a', nome: 'Bia', convocacoes: 4, presencas: 4 }),
      linha({ pessoa_id: 'b', nome: 'Caio', convocacoes: 0, presencas: 0 }),
      linha({ pessoa_id: 'c', nome: 'Ana', convocacoes: 4, presencas: 2 }),
      linha({ pessoa_id: 'd', nome: 'Davi', convocacoes: 2, presencas: 1 }),
      linha({ pessoa_id: 'e', nome: 'Alice', convocacoes: 0, presencas: 0 }),
    ];
    expect(ordenarPorFrequencia(lista).map((l) => l.nome)).toEqual(['Ana', 'Davi', 'Bia', 'Alice', 'Caio']);
  });

  it('não altera a lista recebida', () => {
    const lista = [linha({ nome: 'Bia' }), linha({ nome: 'Ana', presencas: 1 })];
    ordenarPorFrequencia(lista);
    expect(lista.map((l) => l.nome)).toEqual(['Bia', 'Ana']);
  });
});

describe('introducaoDaFrequencia', () => {
  it('fala em "sua" frequência quando só a própria pessoa aparece', () => {
    expect(introducaoDaFrequencia([linha({ pessoa_id: 'u1' })], 'u1')).toBe('Sua frequência nas reuniões encerradas.');
  });

  it('fala das pessoas acompanhadas nos demais casos', () => {
    expect(introducaoDaFrequencia([linha({ pessoa_id: 'u1' }), linha({ pessoa_id: 'u2' })], 'u1').startsWith('Frequência das pessoas')).toBe(true);
    expect(introducaoDaFrequencia([linha({ pessoa_id: 'u2' })], 'u1').startsWith('Frequência das pessoas')).toBe(true);
  });
});
