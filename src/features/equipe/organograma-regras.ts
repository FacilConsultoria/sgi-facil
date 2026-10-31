// Organograma deste ano: poucos cargos, em árvore, da Presidência para baixo. A tabela abaixo diz quais cargos
// aparecem, quem se reporta a quem e de onde vêm a pessoa e o texto da função; a montagem só junta isso com
// os dados do banco. Funções puras, sem acesso a dados.
import type { AreaDaEstrutura, NucleoDaEstrutura, Papel, PessoaDaEquipe } from '../../types/database';

/** De onde sai a pessoa do cargo. */
export type SeletorDePessoa =
  /** Titular de uma área (ids das áreas: "pres", "com"…). */
  | { titularDe: string }
  /** Quem tem este papel (Vice-Presidente, por exemplo). */
  | { papel: Papel }
  /** Gerência ou assessoria de um núcleo (ids dos núcleos: "com-mkt"…). */
  | { liderDe: string };

/** De onde sai o texto da função: a nota da área ou do núcleo, que se edita no banco. */
export type OrigemDaFuncao = { area: string } | { nucleo: string };

export interface CargoDoOrganograma {
  id: string;
  titulo: string;
  pessoa: SeletorDePessoa;
  funcao: OrigemDaFuncao;
  /** Cargos que se reportam a este. */
  filhos?: readonly CargoDoOrganograma[];
}

/** Os cargos de 2027, com os ids da estrutura cadastrada em supabase/02. Para mudar o desenho, é aqui. */
export const ORGANOGRAMA_DESTE_ANO: CargoDoOrganograma = {
  id: 'presidencia',
  titulo: 'Presidência',
  pessoa: { titularDe: 'pres' },
  funcao: { area: 'pres' },
  filhos: [
    { id: 'vice', titulo: 'Vice-presidência', pessoa: { papel: 'vice' }, funcao: { area: 'fin' } },
    { id: 'assessoria', titulo: 'Assessoria de Presidência', pessoa: { liderDe: 'pres-ass' }, funcao: { nucleo: 'pres-ass' } },
    {
      id: 'comercial',
      titulo: 'Diretor Comercial',
      pessoa: { titularDe: 'com' },
      funcao: { area: 'com' },
      filhos: [
        { id: 'gerente-comercial', titulo: 'Gerente Comercial', pessoa: { liderDe: 'com-cap' }, funcao: { nucleo: 'com-cap' } },
        { id: 'marketing', titulo: 'Marketing', pessoa: { liderDe: 'com-mkt' }, funcao: { nucleo: 'com-mkt' } },
      ],
    },
  ],
};

export interface NoDoOrganograma {
  id: string;
  titulo: string;
  /** Nulo quando o cargo está sem pessoa. */
  pessoa: PessoaDaEquipe | null;
  /** Texto da função; nulo enquanto não foi escrito. */
  funcao: string | null;
  /** Área de que a pessoa é titular, para quem pode definir lideranças; nula nos demais cargos. */
  area: AreaDaEstrutura | null;
  filhos: NoDoOrganograma[];
}

/** Junta a tabela de cargos com as áreas, os núcleos e as pessoas ativas. */
export function montarOrganograma(
  cargo: CargoDoOrganograma,
  areas: readonly AreaDaEstrutura[],
  nucleos: readonly NucleoDaEstrutura[],
  pessoas: readonly PessoaDaEquipe[],
): NoDoOrganograma {
  const ativas = pessoas.filter((p) => p.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const seletor = cargo.pessoa;
  let area: AreaDaEstrutura | null = null;
  let pessoa: PessoaDaEquipe | null = null;
  if ('titularDe' in seletor) {
    area = areas.find((a) => a.id === seletor.titularDe) ?? null;
    const titular = area?.titular;
    pessoa = (titular && ativas.find((p) => p.id === titular)) || null;
  } else if ('papel' in seletor) {
    pessoa = ativas.find((p) => p.papel === seletor.papel) ?? null;
  } else {
    pessoa = ativas.find((p) => p.nucleo_id === seletor.liderDe && (p.papel === 'gerente' || p.papel === 'assessor')) ?? null;
  }

  const origem = cargo.funcao;
  const nota = 'area' in origem
    ? areas.find((a) => a.id === origem.area)?.nota
    : nucleos.find((n) => n.id === origem.nucleo)?.nota;

  return {
    id: cargo.id,
    titulo: cargo.titulo,
    pessoa,
    funcao: nota?.trim() || null,
    area,
    filhos: (cargo.filhos ?? []).map((filho) => montarOrganograma(filho, areas, nucleos, pessoas)),
  };
}

/** Texto da janela de um cargo: a função, ou o aviso de que ainda não foi descrita. */
export function descreverFuncao(no: Pick<NoDoOrganograma, 'funcao'>): string {
  return no.funcao ?? 'A função deste cargo ainda não foi descrita.';
}

/** Nome a mostrar no retângulo: a pessoa ou "A definir". */
export function nomeNoRetangulo(no: Pick<NoDoOrganograma, 'pessoa'>, meuId: string): string {
  if (!no.pessoa) return 'A definir';
  return no.pessoa.id === meuId ? `${no.pessoa.nome} (você)` : no.pessoa.nome;
}
