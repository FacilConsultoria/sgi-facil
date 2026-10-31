// Organograma deste ano: poucos cargos, em árvore, da Presidência para baixo. A tabela abaixo diz quais cargos
// aparecem, quem se reporta a quem e de onde vem a pessoa; a montagem só junta isso com os dados do banco.
// Também calcula as posições para o desenho em níveis das telas estreitas. Funções puras, sem acesso a dados.
import type { AreaDaEstrutura, Papel, PessoaDaEquipe } from '../../types/database';

/** De onde sai a pessoa do cargo. */
export type SeletorDePessoa =
  /** Titular de uma área (ids das áreas: "pres", "com"…). */
  | { titularDe: string }
  /** Quem tem este papel (Vice-Presidente, por exemplo). */
  | { papel: Papel }
  /** Gerência ou assessoria de um núcleo (ids dos núcleos: "com-mkt"…). */
  | { liderDe: string };

export interface CargoDoOrganograma {
  id: string;
  titulo: string;
  pessoa: SeletorDePessoa;
  /** Texto da função do cargo; vazio até o usuário definir. */
  funcao?: string;
  /** Cargos que se reportam a este. */
  filhos?: readonly CargoDoOrganograma[];
}

/** Os cargos de 2027, com os ids da estrutura cadastrada em supabase/02. Para mudar o desenho, é aqui. */
export const ORGANOGRAMA_DESTE_ANO: CargoDoOrganograma = {
  id: 'presidencia',
  titulo: 'Presidência',
  pessoa: { titularDe: 'pres' },
  filhos: [
    { id: 'vice', titulo: 'Vice-presidência', pessoa: { papel: 'vice' } },
    { id: 'assessoria', titulo: 'Assessoria de Presidência', pessoa: { liderDe: 'pres-ass' } },
    {
      id: 'comercial',
      titulo: 'Diretor Comercial',
      pessoa: { titularDe: 'com' },
      filhos: [
        { id: 'gerente-comercial-captacao', titulo: 'Gerente Comercial', pessoa: { liderDe: 'com-cap' } },
        { id: 'gerente-comercial-entregas', titulo: 'Gerente Comercial', pessoa: { liderDe: 'proj-cli' } },
        { id: 'marketing', titulo: 'Marketing', pessoa: { liderDe: 'com-mkt' } },
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

/** Junta a tabela de cargos com as áreas e as pessoas ativas. */
export function montarOrganograma(
  cargo: CargoDoOrganograma,
  areas: readonly AreaDaEstrutura[],
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
  return {
    id: cargo.id,
    titulo: cargo.titulo,
    pessoa,
    funcao: cargo.funcao?.trim() || null,
    area,
    filhos: (cargo.filhos ?? []).map((filho) => montarOrganograma(filho, areas, pessoas)),
  };
}

/** Texto da janela de um cargo: a função, ou "A definir" enquanto não há texto. */
export function descreverFuncao(no: Pick<NoDoOrganograma, 'funcao'>): string {
  return no.funcao ?? 'A definir.';
}

/** Nome a mostrar no retângulo: a pessoa ou "A definir". */
export function nomeNoRetangulo(no: Pick<NoDoOrganograma, 'pessoa'>, meuId: string): string {
  if (!no.pessoa) return 'A definir';
  return no.pessoa.id === meuId ? `${no.pessoa.nome} (você)` : no.pessoa.nome;
}

export type LugarNaLinha = 'unico' | 'primeiro' | 'meio' | 'ultimo';

export interface PosicaoNoDesenho {
  /** Linha do desenho em níveis: 1 é a Presidência. */
  nivel: number;
  /** Coluna do desenho em níveis (a partir de 1). */
  coluna: number;
  lugar: LugarNaLinha;
  temFilhos: boolean;
}

export interface MedidasDoOrganograma {
  /** Cargos sem ninguém abaixo: decidem a largura de cada retângulo na árvore. */
  folhas: number;
  /** Maior número de cargos num mesmo nível: colunas do desenho em níveis. */
  colunas: number;
  posicoes: ReadonlyMap<string, PosicaoNoDesenho>;
}

/**
 * Mede a árvore. Na árvore, a largura de cada retângulo depende do número de folhas; nas telas estreitas
 * os cargos se alinham por nível, em colunas, e um nível com um cargo só fica na coluna do meio.
 */
export function medirOrganograma(raiz: NoDoOrganograma): MedidasDoOrganograma {
  const niveis: NoDoOrganograma[][] = [];
  const subir = (no: NoDoOrganograma, nivel: number): void => {
    (niveis[nivel] ??= []).push(no);
    for (const filho of no.filhos) subir(filho, nivel + 1);
  };
  subir(raiz, 0);

  const colunas = Math.max(1, ...niveis.map((n) => n.length));
  const posicoes = new Map<string, PosicaoNoDesenho>();
  niveis.forEach((nos, indice) => {
    nos.forEach((no, i) => {
      const lugar: LugarNaLinha = nos.length === 1 ? 'unico' : i === 0 ? 'primeiro' : i === nos.length - 1 ? 'ultimo' : 'meio';
      posicoes.set(no.id, {
        nivel: indice + 1,
        coluna: nos.length === 1 ? Math.ceil(colunas / 2) : i + 1,
        lugar,
        temFilhos: no.filhos.length > 0,
      });
    });
  });
  const contarFolhas = (no: NoDoOrganograma): number => (no.filhos.length ? no.filhos.reduce((soma, f) => soma + contarFolhas(f), 0) : 1);
  return { folhas: contarFolhas(raiz), colunas, posicoes };
}
