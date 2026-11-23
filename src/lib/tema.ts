// Tema claro ou escuro. Sem escolha, segue o sistema; a escolha fica guardada neste navegador
// e vira o atributo data-theme do <html>, que os tokens de cor (styles/tokens.css) leem.
export type Tema = 'claro' | 'escuro';

const CHAVE = 'sgi-tema';

function temaSalvo(): Tema | null {
  try {
    const valor = localStorage.getItem(CHAVE);
    return valor === 'claro' || valor === 'escuro' ? valor : null;
  } catch {
    return null;
  }
}

/** O tema em uso agora: o escolhido ou, sem escolha, o do sistema. */
export function temaAtual(): Tema {
  const salvo = temaSalvo();
  if (salvo) return salvo;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

/** Aplica a escolha guardada (chamar antes de desenhar a primeira tela). */
export function aplicarTemaSalvo(): void {
  const salvo = temaSalvo();
  if (salvo) document.documentElement.dataset.theme = salvo;
}

/** Troca para o outro tema, guarda a escolha e devolve o tema novo. */
export function alternarTema(): Tema {
  const novo: Tema = temaAtual() === 'escuro' ? 'claro' : 'escuro';
  document.documentElement.dataset.theme = novo;
  try {
    localStorage.setItem(CHAVE, novo);
  } catch {
    // sem armazenamento (janela anônima): vale só enquanto a página estiver aberta
  }
  return novo;
}

/** Nome do botão para leitores de tela: o que acontece ao clicar. */
export function rotuloDoBotaoDeTema(atual: Tema): string {
  return atual === 'escuro' ? 'Modo escuro em uso. Mudar para o modo claro' : 'Modo claro em uso. Mudar para o modo escuro';
}

const SVG = 'http://www.w3.org/2000/svg';

/** Sol (modo claro) ou lua (modo escuro), no tamanho do sino. */
function desenharIcone(tema: Tema): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `tema-desenho ${tema}`);
  const caminho = document.createElementNS(SVG, 'path');
  caminho.setAttribute('d', tema === 'escuro'
    ? 'M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z'
    : 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1.5v2.6M12 19.9v2.6M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M1.5 12h2.6M19.9 12h2.6M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8');
  svg.append(caminho);
  return svg;
}

/** Botão com o sol ou a lua do tema em uso; o clique troca o tema na hora, sem recarregar. */
export function criarBotaoDeTema(): HTMLButtonElement {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'tema-botao';
  const pintar = (tema: Tema): void => {
    botao.replaceChildren(desenharIcone(tema));
    botao.setAttribute('aria-label', rotuloDoBotaoDeTema(tema));
    botao.title = tema === 'escuro' ? 'Mudar para o modo claro' : 'Mudar para o modo escuro';
  };
  pintar(temaAtual());
  botao.addEventListener('click', () => pintar(alternarTema()));
  return botao;
}
