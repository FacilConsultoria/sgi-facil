// Moldura da aplicação: menu lateral (marca, pessoa logada, navegação) e área de conteúdo.
import { abrirMeusDados, EVENTO_DADOS_SALVOS } from '../features/dadospessoais/janela';
import { criarControleDoSino } from '../features/notificacoes/sino';
import { descreverCargo } from '../lib/perfil';
import { criarBotaoDeTema } from '../lib/tema';
import { el, substituir } from '../ui/dom';
import { criarSimbolo } from '../ui/logo';
import { rotasDoPapel, type Rota } from './rotas';
import type { ContextoDaSessao } from './sessao';

export interface Layout {
  conteudo: HTMLElement;
  marcarRotaAtiva: (rota: Rota) => void;
}

export function montarLayout(raiz: HTMLElement, contexto: ContextoDaSessao, aoSair: () => void): Layout {
  const { perfil, tituloDaArea } = contexto;

  const botoesDaNavegacao = rotasDoPapel(perfil.papel).map((rota) =>
    el('a', { href: `#${rota.id}`, class: 'nav-item', 'data-rota': rota.id },
      el('span', {}, rota.titulo),
      rota.disponivel ? null : el('span', { class: 'nav-selo' }, 'em breve')),
  );

  // enquanto os dados pessoais não foram preenchidos (indicador dados_pendentes do perfil), o atalho pede para preencher
  const nomeDaPessoa = el('strong', {}, perfil.nome);
  // o sino (amarelo, com o número de notificações) fica na linha do nome; no celular também aparece na barra de cima
  const sino = criarControleDoSino(() => app);
  const meusDados = el('button', { type: 'button', class: 'meus-dados' }, perfil.dados_pendentes ? 'Preencher meus dados' : 'Meus dados');

  const lateral = el('aside', { class: 'lateral', id: 'lateral', 'aria-label': 'Menu principal' },
    el('div', { class: 'marca' },
      criarSimbolo(),
      el('div', {},
        el('strong', {}, 'FÁCIL'),
        el('span', { class: 'consultoria' }, 'CONSULTORIA'),
        el('small', {}, 'Sistema de Gestão Interna'))),
    el('div', { class: 'quem' },
      el('div', { class: 'quem-linha' }, el('span', { class: 'nome-e-tema' }, nomeDaPessoa, criarBotaoDeTema()), sino.criarBotao()),
      el('span', {}, descreverCargo(perfil, tituloDaArea)),
      meusDados),
    el('nav', { class: 'nav' }, ...botoesDaNavegacao),
    el('button', { type: 'button', class: 'sair' }, 'Sair'),
  );

  const conteudo = el('main', { class: 'conteudo-principal', id: 'conteudo' });
  const botaoMenu = el('button', { type: 'button', class: 'abrir-menu', 'aria-controls': 'lateral', 'aria-expanded': 'false' }, 'Menu');
  const tituloMovel = el('strong', {}, 'SGI');
  const app = el('div', { class: 'app' },
    lateral,
    el('div', { class: 'coluna-conteudo' }, el('div', { class: 'barra-movel' }, botaoMenu, tituloMovel, sino.criarBotao()), conteudo));

  const alternarMenu = (aberto: boolean): void => {
    app.classList.toggle('menu-aberto', aberto);
    botaoMenu.setAttribute('aria-expanded', String(aberto));
  };
  botaoMenu.addEventListener('click', () => alternarMenu(!app.classList.contains('menu-aberto')));
  lateral.addEventListener('click', (evento) => {
    if (evento.target instanceof Element && evento.target.closest('.nav-item')) alternarMenu(false);
  });
  lateral.querySelector('button.sair')?.addEventListener('click', aoSair);
  meusDados.addEventListener('click', () => {
    alternarMenu(false);
    void abrirMeusDados(app, perfil);
  });
  const aoSalvarDados = (): void => {
    // a janela do layout de uma sessão antiga já saiu da página: o ouvinte se remove
    if (!app.isConnected) {
      window.removeEventListener(EVENTO_DADOS_SALVOS, aoSalvarDados);
      return;
    }
    meusDados.textContent = 'Meus dados';
  };
  window.addEventListener(EVENTO_DADOS_SALVOS, aoSalvarDados);

  substituir(raiz, app);

  return {
    conteudo,
    marcarRotaAtiva: (rota) => {
      for (const botao of botoesDaNavegacao) {
        const ativo = botao.dataset.rota === rota.id;
        if (ativo) botao.setAttribute('aria-current', 'page');
        else botao.removeAttribute('aria-current');
      }
      tituloMovel.textContent = rota.titulo;
      // trocar de tela é um bom momento para conferir o que mudou (atividade nova, conclusão, recado)
      void sino.atualizar();
    },
  };
}
