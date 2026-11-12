// Tela de Demandas: quadro por etapa com filtros, painel de detalhes e cadastro.
// Mostra só o que a visão demandas_visiveis devolve (a RLS já aplicou a hierarquia).
import type { ContextoDaSessao } from '../../app/sessao';
import { hojeEmSaoPaulo } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { el, substituir } from '../../ui/dom';
import { cartaoDaDemanda } from './componentes';
import type { ContextoDeDemandas } from './contexto';
import { carregarQuadro, type DadosDoQuadro } from './dados';
import { abrirNovaDemanda, abrirNovoProjeto } from './formularios';
import { abrirPainelDaDemanda } from './painel';
import {
  demandasDaEtapa, filtrarDemandas, FILTROS_VAZIOS, resumir, STATUS, type Filtros,
} from './regras';

// projeto escolhido em "Ver demandas" na tela Projetos; vale só para a próxima abertura desta tela
let projetoPedido = '';

export function pedirDemandasDoProjeto(projetoId: string): void {
  projetoPedido = projetoId;
}

// demanda escolhida na Tela Inicial; o painel dela abre assim que o quadro carrega
let demandaPedida = '';

export function pedirPainelDaDemanda(demandaId: string): void {
  demandaPedida = demandaId;
}

function abrirDemandaPedida(contexto: ContextoDeDemandas): void {
  const demanda = contexto.dados.demandas.find((d) => d.id === demandaPedida);
  demandaPedida = '';
  if (demanda) abrirPainelDaDemanda(contexto, demanda);
}

export function paginaDemandas(destino: HTMLElement, sessao: ContextoDaSessao): void {
  const pagina = el('div', { class: 'pagina-demandas' });
  substituir(destino, pagina);
  // filtros sobrevivem às recargas feitas depois de salvar, mas não à troca de tela
  let filtros: Filtros = { ...FILTROS_VAZIOS, projeto: projetoPedido };
  projetoPedido = '';

  const recarregar = async (): Promise<ContextoDeDemandas | null> => {
    try {
      const dados = await carregarQuadro();
      // a pessoa pode ter mudado de tela enquanto os dados chegavam
      if (!pagina.isConnected) return null;
      const contexto = montarContexto(dados);
      desenhar(contexto);
      abrirDemandaPedida(contexto);
      return contexto;
    } catch (erro: unknown) {
      registrarErro('Carregar demandas', erro);
      if (pagina.isConnected) desenharFalha(mensagemParaUsuario(erro));
      return null;
    }
  };

  const montarContexto = (dados: DadosDoQuadro): ContextoDeDemandas => ({
    pagina,
    perfil: sessao.perfil,
    tituloDaArea: sessao.tituloDaArea,
    dados,
    hoje: hojeEmSaoPaulo(),
    recarregar,
  });

  const desenharFalha = (mensagem: string): void => {
    const tentar = el('button', { type: 'button', class: 'btn' }, 'Tentar de novo');
    tentar.addEventListener('click', () => {
      substituir(pagina, cabecalho(null), el('p', { class: 'meta' }, 'Carregando demandas…'));
      void recarregar();
    });
    substituir(pagina, cabecalho(null), el('section', { class: 'bloco' }, el('p', {}, mensagem), el('div', { class: 'linha' }, tentar)));
  };

  const desenhar = (contexto: ContextoDeDemandas): void => {
    const { dados } = contexto;
    const resumo = el('div', { class: 'resumo', 'aria-live': 'polite' });
    const quadro = el('div', { class: 'quadro' });

    const atualizarQuadro = (): void => {
      const lista = filtrarDemandas(dados.demandas, filtros, sessao.perfil.id);
      substituir(resumo, ...linhaDeResumo(lista, contexto.hoje));
      substituir(quadro, ...STATUS.map((etapa) => {
        const cartoes = demandasDaEtapa(lista, etapa.id);
        return el('section', { class: 'coluna', 'aria-label': etapa.nome },
          el('div', { class: 'coluna-cab' }, el('span', {}, etapa.nome), el('span', {}, String(cartoes.length))),
          ...(cartoes.length
            ? cartoes.map((d) => cartaoDaDemanda(d, dados.nomeDe, contexto.hoje, (escolhida) => abrirPainelDaDemanda(contexto, escolhida)))
            : [el('p', { class: 'vazio-col' }, 'Nenhuma demanda nesta etapa.')]));
      }));
    };

    const conteudo = dados.demandas.length
      ? [barraDeFiltros(dados, sessao.perfil.id, filtros, (novos) => { filtros = novos; atualizarQuadro(); }), resumo, quadro]
      : [el('p', { class: 'vazio' }, mensagemSemDemandas(dados))];
    substituir(pagina, cabecalho(contexto), ...conteudo);
    if (dados.demandas.length) atualizarQuadro();
  };

  substituir(pagina, cabecalho(null), el('p', { class: 'meta' }, 'Carregando demandas…'));
  void recarregar();
}

/** Título, explicação e botões de cadastro (só aparecem para quem pode usá-los, segundo as visões do banco). */
function cabecalho(contexto: ContextoDeDemandas | null): HTMLElement {
  const botoes: HTMLElement[] = [];
  if (contexto?.dados.nucleos.some((n) => n.pode_criar_projeto)) {
    const novoProjeto = el('button', { type: 'button', class: 'btn' }, 'Novo projeto');
    novoProjeto.addEventListener('click', () => abrirNovoProjeto(contexto));
    botoes.push(novoProjeto);
  }
  if (contexto?.dados.projetos.some((p) => p.pode_criar_demanda)) {
    const novaDemanda = el('button', { type: 'button', class: 'btn prim' }, 'Nova demanda');
    novaDemanda.addEventListener('click', () => abrirNovaDemanda(contexto));
    botoes.push(novaDemanda);
  }
  return el('section', { class: 'cab' },
    el('div', {},
      el('h1', {}, 'Demandas'),
      el('p', { class: 'sub' }, 'Atividades no seu escopo, por etapa. Cada entrega passa de quem executa (R) para quem aprova (A) e, se impactar a Fácil como um todo, avisa quem é informado (I).')),
    botoes.length ? el('div', { class: 'linha' }, ...botoes) : null);
}

function mensagemSemDemandas(dados: DadosDoQuadro): string {
  if (dados.projetos.some((p) => p.pode_criar_demanda)) return 'Nenhuma demanda ainda. Use “Nova demanda” para cadastrar a primeira.';
  if (dados.nucleos.some((n) => n.pode_criar_projeto)) return 'Nenhuma demanda ainda. Comece criando um projeto em “Novo projeto”.';
  return 'Nenhuma demanda com você no momento. Quando a liderança atribuir uma, ela aparece aqui.';
}

function barraDeFiltros(
  dados: DadosDoQuadro,
  meuId: string,
  atuais: Filtros,
  aoMudar: (filtros: Filtros) => void,
): HTMLElement {
  // só entram nos filtros projetos e pessoas que aparecem em alguma demanda visível
  const projetosComDemanda = dados.projetos.filter((p) => dados.demandas.some((d) => d.projeto_id === p.id));
  const executores = [...new Set(dados.demandas.flatMap((d) => d.executores))]
    .map((id) => ({ id, nome: dados.nomeDe(id) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const busca = el('input', { type: 'search', id: 'f-busca', placeholder: 'Buscar por título ou código', value: atuais.busca });
  const projeto = el('select', { id: 'f-projeto' },
    el('option', { value: '' }, 'Todos os projetos'),
    ...projetosComDemanda.map((p) => el('option', { value: p.id, selected: p.id === atuais.projeto },
      [p.nome, p.cliente].filter(Boolean).join(' · '))));
  const executor = el('select', { id: 'f-executor' },
    el('option', { value: '' }, 'Todos os executores'),
    ...executores.map((p) => el('option', { value: p.id, selected: p.id === atuais.executor }, p.nome)));
  const soMinhas = el('input', { type: 'checkbox', id: 'f-minhas', checked: atuais.soMinhas });
  const minhaCaixa = el('input', { type: 'checkbox', id: 'f-caixa', checked: atuais.minhaCaixa });

  const ler = (): Filtros => ({
    busca: busca.value, projeto: projeto.value, executor: executor.value, soMinhas: soMinhas.checked, minhaCaixa: minhaCaixa.checked,
  });
  busca.addEventListener('input', () => aoMudar(ler()));
  for (const controle of [projeto, executor, soMinhas, minhaCaixa]) controle.addEventListener('change', () => aoMudar(ler()));

  return el('div', { class: 'filtros' },
    el('div', { class: 'busca' }, el('label', { for: 'f-busca', class: 'sr' }, 'Buscar demandas'), busca),
    el('label', { for: 'f-projeto', class: 'sr' }, 'Projeto'), projeto,
    el('label', { for: 'f-executor', class: 'sr' }, 'Executor'), executor,
    dados.demandas.some((d) => d.executores.includes(meuId))
      ? el('label', { class: 'check', for: 'f-minhas' }, soMinhas, ' Só as minhas')
      : null,
    el('label', { class: 'check', for: 'f-caixa', title: 'O que espera uma ação sua: entregar, responder dúvida ou aprovar' }, minhaCaixa, ' Minha caixa'));
}

function linhaDeResumo(lista: Parameters<typeof resumir>[0], hoje: string): HTMLElement[] {
  const r = resumir(lista, hoje);
  const numero = (valor: number, texto: string, classe?: string): HTMLElement =>
    el('span', { class: classe }, el('b', {}, String(valor)), ` ${texto}`);
  return [
    numero(r.total, r.total === 1 ? 'demanda' : 'demandas'),
    numero(r.andamento, 'em andamento'),
    numero(r.revisao, 'em aprovação'),
    numero(r.atrasadas, r.atrasadas === 1 ? 'atrasada' : 'atrasadas', r.atrasadas ? 'alerta' : undefined),
    numero(r.concluidas, r.concluidas === 1 ? 'concluída' : 'concluídas'),
    numero(r.naMinhaCaixa, 'na sua caixa', r.naMinhaCaixa ? 'destaque' : undefined),
  ];
}
