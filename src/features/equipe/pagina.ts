// Estrutura e equipe: o organograma (para todos) e o cadastro de pessoas (para quem cadastra), em duas abas.
import type { ContextoDaSessao } from '../../app/sessao';
import { montarPaginaComAbas, type Aba } from '../../ui/abas';
import { montarRecarregavel } from '../../ui/recarregavel';
import { desenharCadastro } from './cadastro';
import { carregarEstrutura, type DadosDaEstrutura } from './dados';
import { desenharOrganograma } from './organograma';

type IdDaAba = 'organograma' | 'cadastro';

// a aba escolhida vale até a pessoa sair do sistema
let abaAtual: IdDaAba = 'organograma';

export function paginaEquipe(destino: HTMLElement, sessao: ContextoDaSessao): void {
  const montar = (operacao: string, textoDeCarregando: string, desenhar: (contexto: { pagina: HTMLElement; dados: DadosDaEstrutura; recarregar: () => Promise<void> }) => HTMLElement[]) =>
    (painel: HTMLElement): void => {
      montarRecarregavel<DadosDaEstrutura>(painel, {
        carregar: carregarEstrutura, operacao, textoDeCarregando,
        desenhar: (dados, recarregar) => desenhar({ pagina: painel, dados, recarregar }),
      });
    };

  const abas: Aba<IdDaAba>[] = [
    {
      id: 'organograma', titulo: 'Organograma',
      montar: montar('Carregar organograma', 'Carregando organograma…', (contexto) => desenharOrganograma({ ...contexto, sessao })),
    },
  ];
  // o cadastro é de quem cadastra pessoas; o banco confere de novo cada gravação
  if (sessao.perfil.pode_cadastrar_pessoas) {
    abas.push({ id: 'cadastro', titulo: 'Cadastro', montar: montar('Carregar cadastro', 'Carregando cadastro…', desenharCadastro) });
  }

  montarPaginaComAbas<IdDaAba>(destino, {
    titulo: 'Estrutura e equipe',
    subtitulo: 'Quem é quem na Fácil neste ano e a quem cada cargo se reporta.',
    abas,
    inicial: abas.some((aba) => aba.id === abaAtual) ? abaAtual : 'organograma',
    aoEscolher: (id) => { abaAtual = id; },
  });
}
