import { describe, expect, it } from 'vitest';
import { dataCompleta, dataCurta, dataEHora, diaEMes, diasAte, hojeEmSaoPaulo, horaCurta, somarDias } from './datas';

describe('diasAte', () => {
  it('conta os dias entre duas datas, atravessando mês e ano, e dá negativo para o passado', () => {
    expect(diasAte('2026-10-30', '2026-10-30')).toBe(0);
    expect(diasAte('2026-10-30', '2026-11-01')).toBe(2);
    expect(diasAte('2026-12-30', '2027-01-02')).toBe(3);
    expect(diasAte('2026-11-05', '2026-11-01')).toBe(-4);
    expect(diasAte('2026-03-01', '2026-02-28')).toBe(-1);
  });
});

describe('datas', () => {
  it('usa o dia de São Paulo, não o UTC', () => {
    // 01:30 UTC de 31/10 ainda é 30/10 em São Paulo
    expect(hojeEmSaoPaulo(new Date('2026-10-31T01:30:00Z'))).toBe('2026-10-30');
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-10-30', 7)).toBe('2026-11-06');
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('formata datas e horários', () => {
    expect(dataCurta('2026-11-05')).toBe('05/11');
    expect(dataCompleta('2026-11-05')).toBe('05/11/2026');
    expect(dataEHora('2026-11-05T17:30:00Z')).toBe('05/11 14:30');
  });

  it('separa dia e mês para o bloco de data', () => {
    expect(diaEMes('2026-11-05')).toEqual({ dia: '05', mes: 'NOV' });
    expect(diaEMes('2027-01-31')).toEqual({ dia: '31', mes: 'JAN' });
  });

  it('corta os segundos da hora do banco', () => {
    expect(horaCurta('19:00:00')).toBe('19:00');
    expect(horaCurta('08:30')).toBe('08:30');
  });
});
