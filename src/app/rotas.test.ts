import { describe, expect, it } from 'vitest';
import { ROTAS, rotaDoHash } from './rotas';

describe('rotaDoHash', () => {
  it('aceita hash com e sem barra', () => {
    expect(rotaDoHash('#demandas').id).toBe('demandas');
    expect(rotaDoHash('#/reunioes').id).toBe('reunioes');
  });

  it('leva hash vazio ou desconhecido à Tela Inicial', () => {
    expect(rotaDoHash('').id).toBe('dashboard');
    expect(rotaDoHash('#nao-existe').id).toBe('dashboard');
  });

  it('leva os endereços antigos de Acessos e Avais para Autorizações', () => {
    expect(rotaDoHash('#acessos').id).toBe('autorizacoes');
    expect(rotaDoHash('#/avais').id).toBe('autorizacoes');
    expect(rotaDoHash('#autorizacoes').titulo).toBe('Autorizações');
  });

  it('leva os endereços antigos de Pontuações e Ranking para Pontuação e ranking', () => {
    expect(rotaDoHash('#pontuacoes').id).toBe('pontuacao');
    expect(rotaDoHash('#/ranking').id).toBe('pontuacao');
    expect(rotaDoHash('#pontuacao').titulo).toBe('Pontuação e ranking');
  });

  it('chama a primeira tela de Tela Inicial', () => {
    expect(rotaDoHash('').titulo).toBe('Tela Inicial');
  });

  it('não tem rotas repetidas', () => {
    const ids = ROTAS.map((rota) => rota.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
