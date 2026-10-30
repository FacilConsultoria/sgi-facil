// Ponto de entrada: decide entre configuração ausente, login, cadastro inexistente ou aplicação.
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';

import type { Session } from '@supabase/supabase-js';
import { montarLayout, type Layout } from './app/layout';
import { renderizarPagina } from './app/paginas';
import { rotaDoHash } from './app/rotas';
import { aoMudarSessao, carregarContexto, enviarLinkDeAcesso, sair, type ContextoDaSessao } from './app/sessao';
import { mostrarConfiguracaoAusente, mostrarFalhaAoCarregar, mostrarSemCadastro } from './app/telas-de-acesso';
import { paginaLogin } from './features/auth/pagina';
import { mensagemParaUsuario, registrarErro } from './lib/erros';
import { configuracaoValida } from './lib/supabase';
import { mostrarAviso } from './ui/aviso';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado em index.html.');

let layoutAtual: Layout | null = null;
let contextoAtual: ContextoDaSessao | null = null;
let usuarioAtual: string | null = null;
// cada troca de sessão ganha um número; respostas de trocas antigas são descartadas
let trocaAtual = 0;

function encerrarSessao(): void {
  sair().catch((erro: unknown) => {
    registrarErro('Sair', erro);
    mostrarAviso(mensagemParaUsuario(erro), 'erro');
  });
}

function mostrarRotaAtual(): void {
  if (!layoutAtual || !contextoAtual) return;
  const rota = rotaDoHash(window.location.hash);
  layoutAtual.marcarRotaAtiva(rota);
  renderizarPagina(rota, layoutAtual.conteudo, contextoAtual);
}

async function aoTrocarSessao(destino: HTMLElement, sessao: Session | null): Promise<void> {
  const idDoUsuario = sessao?.user.id ?? null;
  // renovação de token e retorno à aba repetem a mesma sessão: nada a redesenhar
  if (idDoUsuario !== null && idDoUsuario === usuarioAtual && layoutAtual) return;

  const minhaTroca = ++trocaAtual;
  usuarioAtual = idDoUsuario;
  layoutAtual = null;
  contextoAtual = null;
  if (!sessao) {
    paginaLogin(destino, enviarLinkDeAcesso);
    return;
  }
  try {
    const contexto = await carregarContexto();
    if (minhaTroca !== trocaAtual) return;
    if (!contexto) {
      mostrarSemCadastro(destino, sessao.user.email ?? 'este e-mail', encerrarSessao);
      return;
    }
    contextoAtual = contexto;
    layoutAtual = montarLayout(destino, contexto, encerrarSessao);
    mostrarRotaAtual();
  } catch (erro: unknown) {
    if (minhaTroca !== trocaAtual) return;
    registrarErro('Carregar perfil', erro);
    usuarioAtual = null;
    mostrarFalhaAoCarregar(destino, mensagemParaUsuario(erro), () => void aoTrocarSessao(destino, sessao));
  }
}

if (!configuracaoValida) {
  mostrarConfiguracaoAusente(raiz);
} else {
  aoMudarSessao((sessao) => void aoTrocarSessao(raiz, sessao));
  window.addEventListener('hashchange', mostrarRotaAtual);
}
