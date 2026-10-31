import { describe, expect, it } from 'vitest';
import type { ProjetoDoPainel } from '../../types/database';
import {
  descreverAndamento, descreverAtrasadas, descreverOrigem, introducaoDosProjetos, ordenarProjetos, percentualConcluido, seloDoAcesso,
} from './regras';

const projeto = (alteracao: Partial<ProjetoDoPainel> = {}): ProjetoDoPainel => ({
  id: 'p', nome: 'Projeto', cliente: 'Cliente', nucleo_id: 'n', nucleo_nome: 'Núcleo', area_id: 'a', area_titulo: 'Área',
  restrito: false, ativo: true, acesso: 'integral', total_demandas: 0, concluidas: 0, atrasadas: 0, ...alteracao,
});

describe('percentualConcluido', () => {
  it('arredonda e devolve 0 sem demandas', () => {
    expect(percentualConcluido({ total_demandas: 0, concluidas: 0 })).toBe(0);
    expect(percentualConcluido({ total_demandas: 3, concluidas: 1 })).toBe(33);
    expect(percentualConcluido({ total_demandas: 3, concluidas: 2 })).toBe(67);
    expect(percentualConcluido({ total_demandas: 4, concluidas: 4 })).toBe(100);
  });
});

describe('descreverAndamento', () => {
  it('conta as demandas concluídas, no singular e no plural', () => {
    expect(descreverAndamento(projeto({ total_demandas: 5, concluidas: 2 }))).toBe('2 de 5 demandas concluídas');
    expect(descreverAndamento(projeto({ total_demandas: 1, concluidas: 1 }))).toBe('1 de 1 demanda concluída');
  });

  it('avisa que o número é parcial quando a pessoa não vê o projeto todo', () => {
    expect(descreverAndamento(projeto({ acesso: 'parcial', total_demandas: 2, concluidas: 0 }))).toBe('0 de 2 demandas visíveis concluídas');
    expect(descreverAndamento(projeto({ acesso: 'excecao', total_demandas: 1, concluidas: 0 }))).toBe('0 de 1 demanda visível concluída');
  });

  it('diz quando não há demanda', () => {
    expect(descreverAndamento(projeto())).toBe('Nenhuma demanda ainda');
    expect(descreverAndamento(projeto({ acesso: 'excecao' }))).toBe('Nenhuma demanda visível para você');
  });
});

describe('descreverAtrasadas e seloDoAcesso', () => {
  it('mostra atrasadas só quando há', () => {
    expect(descreverAtrasadas(0)).toBe(null);
    expect(descreverAtrasadas(1)).toBe('1 atrasada');
    expect(descreverAtrasadas(3)).toBe('3 atrasadas');
  });

  it('não põe selo no acesso integral', () => {
    expect(seloDoAcesso('integral')).toBe(null);
    expect(seloDoAcesso('excecao')?.texto).toBe('Exceção');
    expect(seloDoAcesso('parcial')?.texto).toBe('Parcial');
  });
});

describe('ordenarProjetos e textos', () => {
  it('ordena por área, núcleo e nome, com os encerrados no fim', () => {
    const lista = ordenarProjetos([
      projeto({ id: '1', nome: 'Zeta', area_titulo: 'Diretoria Comercial', nucleo_nome: 'Marketing' }),
      projeto({ id: '2', nome: 'Alfa', area_titulo: 'Diretoria Comercial', nucleo_nome: 'Marketing' }),
      projeto({ id: '3', nome: 'Beta', area_titulo: 'Diretoria Administrativa', nucleo_nome: 'Processos' }),
      projeto({ id: '4', nome: 'Antigo', area_titulo: 'Diretoria Administrativa', nucleo_nome: 'Processos', ativo: false }),
      projeto({ id: '5', nome: 'Gama', area_titulo: 'Diretoria Comercial', nucleo_nome: 'Captação e clientes' }),
    ]);
    expect(lista.map((p) => p.id)).toEqual(['3', '5', '2', '1', '4']);
  });

  it('não altera a lista original', () => {
    const original = [projeto({ id: 'b', nome: 'B' }), projeto({ id: 'a', nome: 'A' })];
    ordenarProjetos(original);
    expect(original.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('descreve a origem e a introdução', () => {
    expect(descreverOrigem({ area_titulo: 'Diretoria Comercial', nucleo_nome: 'Marketing' })).toBe('Diretoria Comercial · Marketing');
    expect(introducaoDosProjetos([])).toBe('Nenhum projeto visível para o seu perfil.');
    expect(introducaoDosProjetos([{ acesso: 'integral' }])).toBe('1 projeto no seu escopo.');
    expect(introducaoDosProjetos([{ acesso: 'integral' }, { acesso: 'parcial' }])).toBe('2 projetos no seu escopo. “Parcial” indica que você vê só as demandas em que atua.');
  });
});
