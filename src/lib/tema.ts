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

/** Texto do botão: o que acontece ao clicar. */
export function rotuloDoBotaoDeTema(atual: Tema): string {
  return atual === 'escuro' ? 'Modo claro' : 'Modo escuro';
}
