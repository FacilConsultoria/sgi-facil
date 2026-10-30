// Contratos das visões e tabelas do Supabase usadas pela interface.
// Fonte: supabase/01_estrutura_e_regras.sql e supabase/03_visoes_interface.sql.

export type Papel = 'presidente' | 'vice' | 'diretor' | 'gerente' | 'assessor' | 'membro';

/** Linha da visão public.meu_perfil: quem está logado e o que pode fazer. */
export interface Perfil {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  area_id: string;
  area_titulo: string;
  nucleo_id: string | null;
  nucleo_nome: string | null;
  areas_que_conduz: string[];
  /** Presidência ou Vice-Presidência: acesso irrestrito. */
  eh_presidencia: boolean;
  /** Só a Presidente: aprova pedidos de itens restritos. */
  eh_presidente: boolean;
  pode_ajustar_pontos: boolean;
  pode_cadastrar_pessoas: boolean;
  pode_editar_regras: boolean;
}
