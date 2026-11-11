import { describe, expect, it } from 'vitest';
import type { NucleoDaEstrutura, PessoaDaEquipe } from '../../types/database';
import {
  descreverCargoDaPessoa, filtrarEquipe, iniciais, nucleosDaArea, ordenarAreasParaCadastro, pessoasDoTime, precisaDeNucleo, validarCadastro,
} from './regras';

describe('pessoasDoTime', () => {
  it('lista as pessoas ativas cujos dados quem consulta pode ver, sem a própria, por nome', () => {
    const lista = [
      pessoa({ id: 'eu', nome: 'Eu', pode_ver_dados: true }),
      pessoa({ id: 'b', nome: 'Bruno', pode_ver_dados: true, dados_preenchidos: false }),
      pessoa({ id: 'a', nome: 'Ana', pode_ver_dados: true, dados_preenchidos: true }),
      pessoa({ id: 'c', nome: 'Carla', pode_ver_dados: false }),
      pessoa({ id: 'd', nome: 'Davi', pode_ver_dados: true, ativo: false }),
    ];
    expect(pessoasDoTime(lista, 'eu').map((p) => p.nome)).toEqual(['Ana', 'Bruno']);
  });
});

function pessoa(campos: Partial<PessoaDaEquipe>): PessoaDaEquipe {
  return { id: 'p1', nome: 'Ana Ferraz', papel: 'membro', area_id: 'proj', nucleo_id: 'proj-cli', curso: null, ativo: true, email: null, pode_editar: false, pode_ver_dados: false, dados_preenchidos: null, ...campos };
}
function nucleo(campos: Partial<NucleoDaEstrutura>): NucleoDaEstrutura {
  return { id: 'proj-cli', area_id: 'proj', nome: 'Entregas aos clientes', vaga: false, nota: null, ...campos };
}

describe('iniciais', () => {
  it('usa a primeira e a última palavra do nome', () => {
    expect(iniciais('Ana Ferraz')).toBe('AF');
    expect(iniciais('  maria da  Silva ')).toBe('MS');
    expect(iniciais('Mel')).toBe('M');
    expect(iniciais('   ')).toBe('?');
  });
});

describe('cadastro', () => {
  const nucleos = [nucleo({ id: 'proj-cli', area_id: 'proj' }), nucleo({ id: 'com-mkt', area_id: 'com', nome: 'Marketing' }), nucleo({ id: 'com-cap', area_id: 'com', nome: 'Captação' })];
  const base = { email: 'ana@exemplo.com', nome: 'Ana', papel: 'membro' as const, area: 'com', nucleo: 'com-mkt' };

  it('só diretoria, Presidente e Vice ficam sem núcleo', () => {
    expect([precisaDeNucleo('membro'), precisaDeNucleo('gerente'), precisaDeNucleo('assessor')]).toEqual([true, true, true]);
    expect([precisaDeNucleo('diretor'), precisaDeNucleo('vice'), precisaDeNucleo('presidente')]).toEqual([false, false, false]);
  });

  it('lista os núcleos da área por nome', () => {
    expect(nucleosDaArea(nucleos, 'com').map((n) => n.nome)).toEqual(['Captação', 'Marketing']);
    expect(nucleosDaArea(nucleos, 'adm')).toEqual([]);
  });

  it('aceita um cadastro completo e um de diretoria sem núcleo', () => {
    expect(validarCadastro(base, nucleos, true)).toBe(null);
    expect(validarCadastro({ ...base, papel: 'diretor', nucleo: '' }, nucleos, true)).toBe(null);
  });

  it('confere cada campo na ordem do banco', () => {
    expect(validarCadastro({ ...base, email: 'sem-arroba' }, nucleos, true)).toBe('Informe um e-mail válido.');
    expect(validarCadastro({ ...base, nome: '  ' }, nucleos, true)).toBe('Informe o nome.');
    expect(validarCadastro({ ...base, area: '' }, nucleos, true)).toBe('Escolha a área.');
    expect(validarCadastro({ ...base, nucleo: '' }, nucleos, true)).toBe('Escolha o núcleo.');
    expect(validarCadastro({ ...base, nucleo: 'proj-cli' }, nucleos, true)).toBe('O núcleo escolhido não pertence a essa área.');
  });

  it('não confere o e-mail ao alterar um cadastro (ele não muda)', () => {
    expect(validarCadastro({ ...base, email: '' }, nucleos, false)).toBe(null);
  });

  it('põe a Presidência primeiro nas áreas do cadastro', () => {
    const lista = [{ id: 'proj', titulo: 'Projetos' }, { id: 'pres', titulo: 'Presidência' }, { id: 'adm', titulo: 'Administrativa' }];
    expect(ordenarAreasParaCadastro(lista, 'pres').map((a) => a.id)).toEqual(['pres', 'adm', 'proj']);
    expect(ordenarAreasParaCadastro(lista, null).map((a) => a.id)).toEqual(['adm', 'pres', 'proj']);
  });
});

describe('lista do cadastro', () => {
  const pessoas = [
    pessoa({ id: 'a', nome: 'Érica Lima', email: 'erica@exemplo.com' }),
    pessoa({ id: 'b', nome: 'Bruno', email: 'bruno@outra.com', ativo: false }),
    pessoa({ id: 'c', nome: 'Ana', email: 'ana@exemplo.com' }),
  ];

  it('mostra só as ativas, por nome, até pedirem as desativadas', () => {
    expect(filtrarEquipe(pessoas, '', false).map((p) => p.nome)).toEqual(['Ana', 'Érica Lima']);
    expect(filtrarEquipe(pessoas, '', true).map((p) => p.nome)).toEqual(['Ana', 'Bruno', 'Érica Lima']);
  });

  it('busca por nome ou e-mail, sem diferenciar maiúsculas nem acentos', () => {
    expect(filtrarEquipe(pessoas, 'erica', false).map((p) => p.nome)).toEqual(['Érica Lima']);
    expect(filtrarEquipe(pessoas, 'OUTRA', true).map((p) => p.nome)).toEqual(['Bruno']);
    expect(filtrarEquipe(pessoas, 'outra', false)).toEqual([]);
  });

  it('descreve o cargo com o núcleo ou, sem núcleo, com a área', () => {
    const areas = [{ id: 'proj', titulo: 'Diretoria de Projetos' }];
    const nucleos = [{ id: 'proj-cli', nome: 'Entregas aos clientes' }];
    expect(descreverCargoDaPessoa(pessoa({}), areas, nucleos)).toBe('Membro · Entregas aos clientes');
    expect(descreverCargoDaPessoa(pessoa({ papel: 'diretor', nucleo_id: null }), areas, nucleos)).toBe('Diretoria · Diretoria de Projetos');
  });
});
