import { describe, expect, it } from 'vitest';
import { acharPessoaPeloNome, lerRespostaDaIa } from './ia';

describe('lerRespostaDaIa', () => {
  it('separa a ata dos encaminhamentos e lê responsável e prazo', () => {
    const resposta = lerRespostaDaIa([
      '**ATA**',
      '- Fechamos a proposta da padaria.',
      '',
      '## ENCAMINHAMENTOS',
      '- Enviar proposta | Ana Ferraz | 2026-12-05',
      '* Revisar contrato | a definir | sem prazo',
      '1. Marcar reunião com cliente | João | dia 10',
    ].join('\n'));
    expect(resposta.ata).toBe('- Fechamos a proposta da padaria.');
    expect(resposta.encaminhamentos).toEqual([
      { tarefa: 'Enviar proposta', responsavel: 'Ana Ferraz', prazo: '2026-12-05' },
      { tarefa: 'Revisar contrato', responsavel: null, prazo: null },
      { tarefa: 'Marcar reunião com cliente', responsavel: 'João', prazo: null },
    ]);
  });

  it('sem as seções (ex.: resumo do Fathom), tudo vira ata', () => {
    expect(lerRespostaDaIa(' Resumo da reunião\n- ponto 1 ')).toEqual({ ata: 'Resumo da reunião\n- ponto 1', encaminhamentos: [] });
  });
});

describe('acharPessoaPeloNome', () => {
  const pessoas = [{ id: '1', nome: 'Ana Ferraz' }, { id: '2', nome: 'João Rafael Jorte da Costa' }, { id: '3', nome: 'Ana Lima' }];

  it('acha por nome igual ou por primeiro nome único; ambíguo fica sem ninguém', () => {
    expect(acharPessoaPeloNome(pessoas, 'ana ferraz')?.id).toBe('1');
    expect(acharPessoaPeloNome(pessoas, 'Joao')?.id).toBe('2');
    expect(acharPessoaPeloNome(pessoas, 'Ana')).toBe(null);
    expect(acharPessoaPeloNome(pessoas, null)).toBe(null);
  });
});
