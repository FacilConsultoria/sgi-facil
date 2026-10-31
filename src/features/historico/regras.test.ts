import { describe, expect, it } from 'vitest';
import type { RegistroDoHistorico } from '../../types/database';
import { cursorDaProximaPagina, descreverAtor, filtroDeBusca, haMaisRegistros, TAMANHO_DA_PAGINA, termoDeBusca } from './regras';

function registro(campos: Partial<RegistroDoHistorico>): RegistroDoHistorico {
  return { id: 10, em: '2026-10-30T12:00:00Z', ator: 'u1', ator_nome: 'Ana', acao: 'Criou demanda', detalhe: 'PRJ-001 · Fluxo', ...campos };
}

describe('termoDeBusca', () => {
  it('apara e junta espaços', () => {
    expect(termoDeBusca('  fluxo   AS-IS ')).toBe('fluxo AS-IS');
  });

  it('tira o que tem sentido nos filtros do banco', () => {
    expect(termoDeBusca('a,b(c)*d%e"f\'g_h\\i')).toBe('a b c d e f g h i');
    expect(termoDeBusca('  ,()  ')).toBe('');
  });
});

describe('filtroDeBusca', () => {
  it('procura na ação, no detalhe e no nome de quem fez', () => {
    expect(filtroDeBusca(' PRJ-001 ')).toBe('acao.ilike.*PRJ-001*,detalhe.ilike.*PRJ-001*,ator_nome.ilike.*PRJ-001*');
  });

  it('não filtra quando não há termo', () => {
    expect(filtroDeBusca('')).toBe(null);
    expect(filtroDeBusca(' (,) ')).toBe(null);
  });
});

describe('registros', () => {
  it('mostra "Integração automática" quando não há pessoa', () => {
    expect(descreverAtor(registro({}))).toBe('Ana');
    expect(descreverAtor(registro({ ator: null, ator_nome: null }))).toBe('Integração automática');
  });

  it('o cursor é o id do último registro', () => {
    expect(cursorDaProximaPagina([registro({ id: 30 }), registro({ id: 20 })])).toBe(20);
    expect(cursorDaProximaPagina([])).toBe(null);
  });

  it('só uma página cheia indica que há mais', () => {
    expect(haMaisRegistros(TAMANHO_DA_PAGINA)).toBe(true);
    expect(haMaisRegistros(TAMANHO_DA_PAGINA - 1)).toBe(false);
    expect(haMaisRegistros(0)).toBe(false);
  });
});
