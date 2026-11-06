// O sino amarelo ao lado do nome: mostra quantas notificações há (atrasos, atividades atribuídas, recados internos e,
// para a Presidência, recados aguardando autorização) e abre a lista num painel. Um só controle serve os dois sinos da tela (menu lateral e barra do celular).
import { hojeEmSaoPaulo } from '../../lib/datas';
import { registrarErro } from '../../lib/erros';
import type { Notificacao } from '../../types/database';
import { abrirCamada } from '../../ui/camada';
import { el, substituir } from '../../ui/dom';
import { botaoFechar } from '../../ui/formulario';
import { pedirPainelDaDemanda } from '../demandas/pagina';
import { carregarNotificacoes, marcarComoLidas } from './dados';
import {
  descreverNotificacao, idsParaMarcar, NOME_DO_TIPO_DE_NOTIFICACAO, ordenarNotificacoes, rotuloDoSino, textoDoContador,
} from './regras';

const SVG = 'http://www.w3.org/2000/svg';
const INTERVALO_DE_ATUALIZACAO = 60_000;

/** Avisado (em window) por quem muda algo que entra no sino; o sino busca de novo na hora. */
export const EVENTO_NOTIFICACOES_MUDARAM = 'sgi:notificacoes-mudaram';

export interface ControleDoSino {
  /** Um botão novo; todos os botões criados mostram o mesmo número. */
  criarBotao: () => HTMLButtonElement;
  /** Busca de novo no banco e atualiza o número (e a lista, se estiver aberta). */
  atualizar: () => Promise<void>;
}

function desenharSino(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'sino-desenho');
  svg.setAttribute('aria-hidden', 'true');
  const corpo = document.createElementNS(SVG, 'path');
  corpo.setAttribute('d', 'M12 2.5a6.2 6.2 0 0 0-6.2 6.2v3.5c0 .5-.2 1-.5 1.4l-1.6 2.1a1.3 1.3 0 0 0 1 2.1h14.6a1.3 1.3 0 0 0 1-2.1l-1.6-2.1a2.4 2.4 0 0 1-.5-1.4V8.7A6.2 6.2 0 0 0 12 2.5Z');
  const badalo = document.createElementNS(SVG, 'path');
  badalo.setAttribute('d', 'M9.4 19.6a2.6 2.6 0 0 0 5.2 0Z');
  svg.append(corpo, badalo);
  return svg;
}

/** Leva à tela do assunto; se a pessoa já está nela, redesenha para o painel pedido abrir. */
function irPara(rota: string): void {
  const alvo = `#${rota}`;
  if (window.location.hash === alvo) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = alvo;
}

/** `moldura` devolve a moldura da aplicação (onde o painel abre); é chamada só depois de a tela estar montada. */
export function criarControleDoSino(moldura: () => HTMLElement): ControleDoSino {
  let lista: Notificacao[] = [];
  const botoes = new Set<HTMLButtonElement>();
  const aoMudar = new Set<() => void>();

  const pintar = (): void => {
    const total = lista.length;
    for (const botao of botoes) {
      botao.setAttribute('aria-label', rotuloDoSino(total));
      const numero = botao.querySelector('.sino-num');
      if (!numero) continue;
      numero.textContent = total > 0 ? textoDoContador(total) : '';
      botao.classList.toggle('com-novas', total > 0);
    }
    for (const acao of aoMudar) acao();
  };

  const atualizar = async (): Promise<void> => {
    try {
      lista = ordenarNotificacoes(await carregarNotificacoes());
      pintar();
    } catch (erro: unknown) {
      // o sino é um apoio: se não carregar, fica como estava e o erro vai só para o console
      registrarErro('Carregar notificações', erro);
    }
  };

  const abrirItem = (notificacao: Notificacao, fechar: () => void): void => {
    fechar();
    if (notificacao.demanda_id) {
      pedirPainelDaDemanda(notificacao.demanda_id);
      irPara('demandas');
    } else if (notificacao.sugestao_id) {
      irPara('sugestoes');
    } else {
      irPara('dashboard');
    }
    if (notificacao.id) {
      marcarComoLidas([notificacao.id]).then(atualizar).catch((erro: unknown) => registrarErro('Marcar notificação como lida', erro));
    }
  };

  const abrirPainel = (): void => {
    const idDoTitulo = 'notificacoes-titulo';
    abrirCamada(moldura(), {
      tipo: 'painel',
      idDoTitulo,
      montar: (fechar) => {
        const corpo = el('div', { class: 'painel-corpo' });
        const desenhar = (): void => {
          const hoje = hojeEmSaoPaulo();
          const paraMarcar = idsParaMarcar(lista);
          const marcarTudo = el('button', { type: 'button', class: 'btn peq' }, 'Marcar como lidas');
          marcarTudo.disabled = paraMarcar.length === 0;
          marcarTudo.addEventListener('click', () => {
            marcarComoLidas(null).then(atualizar).catch((erro: unknown) => registrarErro('Marcar notificações como lidas', erro));
          });
          substituir(corpo,
            lista.length
              ? el('ul', { class: 'itens notificacoes' }, ...lista.map((notificacao) => {
                const texto = descreverNotificacao(notificacao, hoje);
                const botao = el('button', { type: 'button', class: 'item' },
                  el('div', {}, el('div', { class: 'item-tit' }, texto.titulo), el('div', { class: 'meta' }, texto.detalhe)),
                  el('span', { class: `lado tipo-${notificacao.tipo}` }, NOME_DO_TIPO_DE_NOTIFICACAO[notificacao.tipo]));
                botao.addEventListener('click', () => abrirItem(notificacao, fechar));
                return el('li', {}, botao);
              }))
              : el('p', { class: 'vazio' }, 'Nenhuma notificação por enquanto. Aqui aparecem atrasos, atividades atribuídas a você e recados internos.'),
            lista.length ? el('div', { class: 'linha' }, marcarTudo) : null,
            lista.length ? el('p', { class: 'dica' }, 'Atrasos saem daqui quando a demanda é concluída; o restante, quando você abre ou marca como lido.') : null);
        };
        desenhar();
        // o painel pode ser fechado pelo véu ou pela tecla Esc: quando sai da página, deixa de ouvir
        const redesenhar = (): void => {
          if (corpo.isConnected) desenhar();
          else aoMudar.delete(redesenhar);
        };
        aoMudar.add(redesenhar);
        return [
          el('div', { class: 'painel-cab' }, el('h2', { id: idDoTitulo }, 'Notificações'), botaoFechar(fechar)),
          corpo,
        ];
      },
    });
  };

  const criarBotao = (): HTMLButtonElement => {
    const botao = el('button', { type: 'button', class: 'sino', 'aria-label': rotuloDoSino(lista.length) },
      desenharSino(), el('span', { class: 'sino-num' }));
    botao.addEventListener('click', abrirPainel);
    botoes.add(botao);
    pintar();
    return botao;
  };

  // atualiza de tempos em tempos e ao voltar para a aba; o ciclo termina quando a moldura sai da página
  // (a moldura só existe depois que o layout monta; antes disso nada é cobrado)
  const ciclo = window.setInterval(() => {
    if (!moldura().isConnected) window.clearInterval(ciclo);
    else if (!document.hidden) void atualizar();
  }, INTERVALO_DE_ATUALIZACAO);
  const aoVoltar = (): void => {
    if (!moldura().isConnected) document.removeEventListener('visibilitychange', aoVoltar);
    else if (!document.hidden) void atualizar();
  };
  document.addEventListener('visibilitychange', aoVoltar);
  // outras telas avisam quando algo que entra no sino mudou (ex.: recado autorizado)
  const aoMudarFora = (): void => {
    if (!moldura().isConnected) window.removeEventListener(EVENTO_NOTIFICACOES_MUDARAM, aoMudarFora);
    else void atualizar();
  };
  window.addEventListener(EVENTO_NOTIFICACOES_MUDARAM, aoMudarFora);

  void atualizar();
  return { criarBotao, atualizar };
}
