// Regras do seletor "Ver como" do ambiente de desenvolvimento. Funções puras, sem acesso a dados.
// Quem pode trocar de cargo é decidido no banco (public.dev_trocar_meu_cargo, só no sgi-facil-dev).
import type { Papel, Perfil } from '../../types/database';

export interface CargoEscolhido {
  papel: Papel;
  area: string | null;
  nucleo: string | null;
}

export interface OpcaoDeCargo extends CargoEscolhido {
  valor: string;
  rotulo: string;
  grupo: string;
}

export interface AreaSimples { id: string; titulo: string }
export interface NucleoSimples { id: string; nome: string; area_id: string }

export const AREA_DA_PRESIDENCIA = 'pres';

/** "papel|área|núcleo", o valor de cada opção da lista. */
export function valorDoCargo(cargo: CargoEscolhido): string {
  return `${cargo.papel}|${cargo.area ?? ''}|${cargo.nucleo ?? ''}`;
}

/**
 * Todos os cargos que a conta de teste pode ocupar: Presidência, Vice-Presidência, a diretoria de cada área,
 * a assessoria dos núcleos da Presidência e a gerência e um lugar de membro em cada núcleo.
 */
export function opcoesDeCargo(areas: readonly AreaSimples[], nucleos: readonly NucleoSimples[]): OpcaoDeCargo[] {
  const opcao = (grupo: string, rotulo: string, cargo: CargoEscolhido): OpcaoDeCargo => ({ ...cargo, grupo, rotulo, valor: valorDoCargo(cargo) });
  const porNome = (a: string, b: string): number => a.localeCompare(b, 'pt-BR');
  const diretorias = areas.filter((a) => a.id !== AREA_DA_PRESIDENCIA).sort((a, b) => porNome(a.titulo, b.titulo));
  const nucleosOrdenados = [...nucleos].sort((a, b) => porNome(a.nome, b.nome));
  return [
    opcao('Presidência', 'Presidência', { papel: 'presidente', area: null, nucleo: null }),
    opcao('Presidência', 'Vice-Presidência', { papel: 'vice', area: null, nucleo: null }),
    ...nucleosOrdenados.filter((n) => n.area_id === AREA_DA_PRESIDENCIA)
      .map((n) => opcao('Presidência', `Assessoria · ${n.nome}`, { papel: 'assessor', area: null, nucleo: n.id })),
    ...diretorias.map((a) => opcao('Diretorias', a.titulo, { papel: 'diretor', area: a.id, nucleo: null })),
    ...nucleosOrdenados.map((n) => opcao('Gerências', `Gerência · ${n.nome}`, { papel: 'gerente', area: null, nucleo: n.id })),
    ...nucleosOrdenados.map((n) => opcao('Membros', `Membro · ${n.nome}`, { papel: 'membro', area: null, nucleo: n.id })),
  ];
}

/** O valor da opção que corresponde ao cargo de agora (a Vice é uma opção só, qualquer que seja a área que conduz). */
export function cargoAtual(perfil: Pick<Perfil, 'papel' | 'area_id' | 'nucleo_id'>): string {
  if (perfil.papel === 'presidente' || perfil.papel === 'vice') return valorDoCargo({ papel: perfil.papel, area: null, nucleo: null });
  if (perfil.papel === 'diretor') return valorDoCargo({ papel: 'diretor', area: perfil.area_id, nucleo: null });
  return valorDoCargo({ papel: perfil.papel, area: null, nucleo: perfil.nucleo_id });
}
