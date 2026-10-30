import { describe, expect, it } from 'vitest';
import type { AvalVisivel } from '../../types/database';
import { descreverAcaoDoAval, separarAvais } from './regras';

function aval(campos: Partial<AvalVisivel>): AvalVisivel {
  return {
    id: 'a1', tipo: 'ajuste_proprio', solicitante: 'u1', resumo: 'Horas extras do evento regional', payload: {},
    status: 'pendente', decidido_por: null, decidido_em: null, nota: null, criado_em: '2026-10-30T12:00:00Z', pode_decidir: true,
    ...campos,
  };
}

describe('separarAvais', () => {
  it('põe os pendentes do mais antigo e os decididos do mais recente', () => {
    const lista = [
      aval({ id: 'novo', criado_em: '2026-10-30T15:00:00Z' }),
      aval({ id: 'velho', criado_em: '2026-10-29T10:00:00Z' }),
      aval({ id: 'a', status: 'aprovado', decidido_em: '2026-10-28T10:00:00Z' }),
      aval({ id: 'b', status: 'negado', decidido_em: '2026-10-30T09:00:00Z' }),
    ];
    const { pendentes, decididos } = separarAvais(lista);
    expect(pendentes.map((x) => x.id)).toEqual(['velho', 'novo']);
    expect(decididos.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('descreverAcaoDoAval', () => {
  it('descreve cada tipo de aval', () => {
    expect(descreverAcaoDoAval({ tipo: 'ajuste_proprio', payload: { tipo: 'ajuste', valor: 2 } })).toBe('Lançar +2 pontos (ajuste) para quem pediu');
    expect(descreverAcaoDoAval({ tipo: 'ajuste_proprio', payload: { tipo: 'evento', valor: -1 } })).toBe('Lançar -1 ponto (evento) para quem pediu');
    expect(descreverAcaoDoAval({ tipo: 'decidir_solicitacao', payload: { aprovar: true } })).toBe('Aprovar o pedido de acesso por exceção');
    expect(descreverAcaoDoAval({ tipo: 'decidir_solicitacao', payload: { aprovar: false } })).toBe('Negar o pedido de acesso por exceção');
    expect(descreverAcaoDoAval({ tipo: 'justificar_falta', payload: {} })).toBe('Marcar a falta como justificada na lista de presença');
  });
});
