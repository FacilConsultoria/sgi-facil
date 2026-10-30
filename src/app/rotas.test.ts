import { describe, expect, it } from 'vitest';
import { ROTAS, rotaDoHash } from './rotas';

describe('rotaDoHash', () => {
  it('aceita hash com e sem barra', () => {
    expect(rotaDoHash('#demandas').id).toBe('demandas');
    expect(rotaDoHash('#/reunioes').id).toBe('reunioes');
  });

  it('leva hash vazio ou desconhecido ao Dashboard', () => {
    expect(rotaDoHash('').id).toBe('dashboard');
    expect(rotaDoHash('#nao-existe').id).toBe('dashboard');
  });

  it('não tem rotas repetidas', () => {
    const ids = ROTAS.map((rota) => rota.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
