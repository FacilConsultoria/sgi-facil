import { describe, expect, it } from 'vitest';
import type { AreaDaEstrutura, NucleoDaEstrutura, PessoaDaEquipe } from '../../types/database';
import {
  descreverCargoDaPessoa, descreverResponsavel, filtrarEquipe, iniciais, montarOrganograma, nucleosDaArea, ordenarAreasParaCadastro,
  precisaDeNucleo, validarCadastro,
} from './regras';

function pessoa(campos: Partial<PessoaDaEquipe>): PessoaDaEquipe {
  return { id: 'p1', nome: 'Ana Ferraz', papel: 'membro', area_id: 'proj', nucleo_id: 'proj-cli', curso: null, ativo: true, email: null, pode_editar: false, ...campos };
}
function area(campos: Partial<AreaDaEstrutura>): AreaDaEstrutura {
  return { id: 'proj', titulo: 'Diretoria de Projetos', sigla: 'PRJ', titular: null, cobertura: null, nota: null, pode_definir_lideranca: false, area_da_presidencia: false, ...campos };
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

describe('montarOrganograma', () => {
  const areas = [
    area({ id: 'pres', titulo: 'Presidência', titular: 'mel', area_da_presidencia: true }),
    area({ id: 'proj', titulo: 'Diretoria de Projetos', cobertura: 'joao' }),
    area({ id: 'com', titulo: 'Diretoria Comercial', titular: 'joao' }),
  ];
  const nucleos = [
    nucleo({ id: 'pres-ass', area_id: 'pres', nome: 'Assessoria de Presidência' }),
    nucleo({ id: 'proj-cli', area_id: 'proj', nome: 'Entregas aos clientes' }),
    nucleo({ id: 'com-mkt', area_id: 'com', nome: 'Marketing', vaga: true }),
  ];
  const pessoas = [
    pessoa({ id: 'mel', nome: 'Mel', papel: 'presidente', area_id: 'pres', nucleo_id: null }),
    pessoa({ id: 'joao', nome: 'João', papel: 'diretor', area_id: 'com', nucleo_id: null }),
    pessoa({ id: 'maju', nome: 'Maju', papel: 'assessor', area_id: 'pres', nucleo_id: 'pres-ass' }),
    pessoa({ id: 'victor', nome: 'Victor', papel: 'gerente', nucleo_id: 'proj-cli' }),
    pessoa({ id: 'lucas', nome: 'Lucas', nucleo_id: 'proj-cli' }),
    pessoa({ id: 'ana', nome: 'Ana', nucleo_id: 'proj-cli' }),
    pessoa({ id: 'saiu', nome: 'Antiga', nucleo_id: 'proj-cli', ativo: false }),
  ];
  const organograma = montarOrganograma(areas, nucleos, pessoas);

  it('põe a Presidência no topo, com titular e núcleos', () => {
    expect(organograma.presidencia?.titular?.nome).toBe('Mel');
    expect(organograma.presidencia?.nucleos.map((n) => n.lideres.map((p) => p.nome))).toEqual([['Maju']]);
  });

  it('lista as diretorias por nome, sem a Presidência', () => {
    expect(organograma.diretorias.map((d) => d.area.titulo)).toEqual(['Diretoria Comercial', 'Diretoria de Projetos']);
  });

  it('separa liderança e membros do núcleo, por nome, sem pessoas desativadas', () => {
    const projetos = organograma.diretorias.find((d) => d.area.id === 'proj');
    expect(projetos?.nucleos[0]?.lideres.map((p) => p.nome)).toEqual(['Victor']);
    expect(projetos?.nucleos[0]?.membros.map((p) => p.nome)).toEqual(['Ana', 'Lucas']);
  });

  it('acha titular e cobertura e descreve a vaga', () => {
    const projetos = organograma.diretorias.find((d) => d.area.id === 'proj');
    expect(projetos?.titular).toBe(null);
    expect(projetos && descreverResponsavel(projetos)).toBe('Vaga · coberta por João');
    const comercial = organograma.diretorias.find((d) => d.area.id === 'com');
    expect(comercial && descreverResponsavel(comercial)).toBe('João');
    expect(descreverResponsavel({ titular: null, cobertura: null })).toBe('Vaga');
  });

  it('sem área da Presidência, não inventa uma', () => {
    expect(montarOrganograma([area({})], [], []).presidencia).toBe(null);
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
