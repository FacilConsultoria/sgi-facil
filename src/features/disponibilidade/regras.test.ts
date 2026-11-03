import { describe, expect, it } from 'vitest';
import {
  alternarDia, alternarHora, alternarHorario, codigoDoHorario, contarDisponiveis, descreverHora, descreverJanela, faixasDoDia, HORAS,
  horarioDoCodigo, horarioValido, horariosValidos, melhoresJanelas, nivelDeCalor, resumirSemana, semGrade,
} from './regras';

const SEG = 0;
const SAB = 5;
const h = (dia: number, ...horas: number[]): number[] => horas.map((hora) => codigoDoHorario(dia, hora));

describe('horários', () => {
  it('guarda dia * 24 + hora e volta', () => {
    expect(codigoDoHorario(SAB, 9)).toBe(129);
    expect(horarioDoCodigo(129)).toEqual({ dia: SAB, hora: 9 });
    expect(HORAS[0]).toBe(7);
    expect(HORAS[HORAS.length - 1]).toBe(21);
    expect(descreverHora(7)).toBe('07:00');
  });

  it('só vale da segunda ao domingo, das 7h às 22h', () => {
    expect(horarioValido(codigoDoHorario(SEG, 7))).toBe(true);
    expect(horarioValido(codigoDoHorario(6, 21))).toBe(true);
    expect(horarioValido(codigoDoHorario(SEG, 6))).toBe(false);
    expect(horarioValido(codigoDoHorario(SEG, 22))).toBe(false);
    expect(horarioValido(168 + 9)).toBe(false);
    expect(horarioValido(-1)).toBe(false);
    expect(horarioValido(9.5)).toBe(false);
    expect([...horariosValidos([9, 9, 3, 200, codigoDoHorario(1, 10)])].sort((a, b) => a - b)).toEqual([9, 34]);
  });
});

describe('marcar horários', () => {
  it('alterna um horário sem mexer na seleção original', () => {
    const inicial = new Set(h(SEG, 19));
    const marcado = alternarHorario(inicial, SEG, 20);
    expect([...marcado].sort((a, b) => a - b)).toEqual(h(SEG, 19, 20));
    expect([...inicial]).toEqual(h(SEG, 19));
    expect([...alternarHorario(marcado, SEG, 19)]).toEqual(h(SEG, 20));
  });

  it('o dia inteiro marca tudo e, se já estava tudo marcado, desmarca', () => {
    const cheio = alternarDia(new Set(), 2);
    expect(cheio.size).toBe(HORAS.length);
    expect(alternarDia(cheio, 2).size).toBe(0);
    const parcial = alternarDia(new Set(h(2, 9)), 2);
    expect(parcial.size).toBe(HORAS.length);
  });

  it('a mesma hora em todos os dias', () => {
    const coluna = alternarHora(new Set(), 19);
    expect(coluna.size).toBe(7);
    expect(coluna.has(codigoDoHorario(6, 19))).toBe(true);
    expect(alternarHora(coluna, 19).size).toBe(0);
  });
});

describe('resumo', () => {
  it('junta horas seguidas em faixas', () => {
    expect(faixasDoDia(new Set(h(SAB, 9, 10, 11, 14)), SAB)).toEqual(['9h–12h', '14h–15h']);
    expect(faixasDoDia(new Set(h(SEG, 19, 20, 21)), SEG)).toEqual(['19h–22h']);
    expect(faixasDoDia(new Set(h(SEG, 19)), SAB)).toEqual([]);
  });

  it('resume a semana ou diz que não há horário', () => {
    expect(resumirSemana(new Set([...h(SEG, 19, 20, 21), ...h(SAB, 9, 10, 11)]))).toBe('Seg 19h–22h · Sáb 9h–12h');
    expect(resumirSemana(new Set())).toBe('Nenhum horário marcado');
  });
});

describe('contagem e calor', () => {
  const grades = new Map<string, Set<number>>([
    ['a', new Set(h(SAB, 9, 10, 11))],
    ['b', new Set(h(SAB, 10, 11))],
    ['c', new Set(h(SEG, 19))],
  ]);

  it('conta quantas pessoas escolhidas estão disponíveis em cada horário', () => {
    const contagens = contarDisponiveis(grades, ['a', 'b']);
    expect(contagens.get(codigoDoHorario(SAB, 9))).toBe(1);
    expect(contagens.get(codigoDoHorario(SAB, 10))).toBe(2);
    expect(contagens.has(codigoDoHorario(SEG, 19))).toBe(false);
    expect(contarDisponiveis(grades, ['sem-grade']).size).toBe(0);
  });

  it('dá o nível de calor de 0 a 4', () => {
    expect(nivelDeCalor(0, 4)).toBe(0);
    expect(nivelDeCalor(1, 8)).toBe(1);
    expect(nivelDeCalor(2, 4)).toBe(2);
    expect(nivelDeCalor(4, 4)).toBe(4);
    expect(nivelDeCalor(3, 0)).toBe(0);
  });
});

describe('melhoresJanelas', () => {
  const grades = new Map<string, Set<number>>([
    ['a', new Set(h(SAB, 9, 10, 11, 12))],
    ['b', new Set(h(SAB, 10, 11, 12, 13))],
    ['c', new Set([...h(SAB, 10, 11), ...h(SEG, 19, 20)])],
  ]);

  it('acha a faixa em que mais gente está livre durante a reunião inteira', () => {
    const janelas = melhoresJanelas(grades, ['a', 'b', 'c'], 2);
    expect(janelas).toEqual([{ dia: SAB, inicio: 10, fim: 12, disponiveis: 3, total: 3 }]);
    expect(descreverJanela(janelas[0]!)).toBe('Sábado, das 10:00 às 12:00 · 3 de 3 pessoas');
  });

  it('junta inícios seguidos com a mesma contagem numa faixa só', () => {
    const janelas = melhoresJanelas(grades, ['a', 'b'], 1);
    expect(janelas).toEqual([{ dia: SAB, inicio: 10, fim: 13, disponiveis: 2, total: 2 }]);
  });

  it('uma reunião maior que a folga comum cai para menos pessoas', () => {
    const janelas = melhoresJanelas(grades, ['a', 'b', 'c'], 4);
    expect(janelas.every((j) => j.disponiveis === 1)).toBe(true);
    expect(janelas.some((j) => j.dia === SAB)).toBe(true);
  });

  it('devolve vazio sem ninguém escolhido ou sem horário em comum', () => {
    expect(melhoresJanelas(grades, [], 1)).toEqual([]);
    expect(melhoresJanelas(new Map(), ['a'], 1)).toEqual([]);
    expect(melhoresJanelas(grades, ['a'], 0)).toEqual([]);
  });

  it('descreve no singular quando é uma pessoa só', () => {
    expect(descreverJanela({ dia: 6, inicio: 8, fim: 9, disponiveis: 1, total: 1 })).toBe('Domingo, das 08:00 às 09:00 · 1 de 1 pessoa');
  });
});

describe('semGrade', () => {
  it('lista quem ainda não preencheu, em ordem alfabética', () => {
    expect(semGrade([
      { nome: 'Zélia', preenchida: false }, { nome: 'Ana', preenchida: true }, { nome: 'Bruno', preenchida: false },
    ])).toEqual(['Bruno', 'Zélia']);
  });
});
