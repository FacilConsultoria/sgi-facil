// Ponto de entrada: decide entre configuração ausente, login, criação de senha, cadastro inexistente ou aplicação.
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/componentes.css';
import './styles/demandas.css';
import './styles/reunioes.css';
import './styles/avais.css';
import './styles/pontuacao.css';
import './styles/equipe.css';
import './styles/historico.css';

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { montarLayout, type Layout } from './app/layout';
import { renderizarPagina } from './app/paginas';
import { rotaDoHash } from './app/rotas';
import {
  aoMudarSessao, carregarContexto, definirSenha, enviarLinkDeAcesso, enviarLinkDeRecuperacao, entrarComSenha, sair, sessaoAtual,
  type ContextoDaSessao,
} from './app/sessao';
import { mostrarConfiguracaoAusente, mostrarFalhaAoCarregar, mostrarSemCadastro } from './app/telas-de-acesso';
import { paginaDefinirSenha } from './features/auth/definir-senha';
import { paginaLogin, type AcoesDeLogin } from './features/auth/pagina';
import { senhaJaDefinida } from './features/auth/regras';
import { mensagemParaUsuario, registrarErro } from './lib/erros';
import { configuracaoValida } from './lib/supabase';
import { mostrarAviso } from './ui/aviso';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado em index.html.');

const ACOES_DE_LOGIN: AcoesDeLogin = {
  entrarComSenha,
  enviarLinkDePrimeiroAcesso: enviarLinkDeAcesso,
  enviarLinkDeRecuperacao,
};

let layoutAtual: Layout | null = null;
let contextoAtual: ContextoDaSessao | null = null;
let usuarioAtual: string | null = null;
// cada troca de sessão ganha um número; respostas de trocas antigas são descartadas
let trocaAtual = 0;
// verdadeiro depois do link de "esqueci a senha", até a pessoa salvar a nova senha
let recuperandoSenha = false;
let mostrandoCriarSenha = false;
// usuário que acabou de criar a senha nesta página (vale até os dados da sessão refletirem a marca)
let senhaCriadaPor: string | null = null;

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

/** Grava a senha e segue para o sistema com a sessão já atualizada. Erros voltam para a tela de criar senha. */
async function salvarNovaSenha(destino: HTMLElement, senha: string): Promise<void> {
  await definirSenha(senha);
  recuperandoSenha = false;
  mostrandoCriarSenha = false;
  senhaCriadaPor = usuarioAtual;
  await aoTrocarSessao(destino, await sessaoAtual(), 'USER_UPDATED');
}

async function aoTrocarSessao(destino: HTMLElement, sessao: Session | null, evento: AuthChangeEvent): Promise<void> {
  const idDoUsuario = sessao?.user.id ?? null;
  const veioDeRecuperacao = evento === 'PASSWORD_RECOVERY';
  if (veioDeRecuperacao) recuperandoSenha = true;
  // renovação de token e retorno à aba repetem a mesma sessão: nada a redesenhar
  // (o link de recuperação é a exceção: precisa interromper o que estiver na tela)
  const jaMostrando = layoutAtual !== null || mostrandoCriarSenha;
  if (!veioDeRecuperacao && idDoUsuario !== null && idDoUsuario === usuarioAtual && jaMostrando) return;

  const minhaTroca = ++trocaAtual;
  usuarioAtual = idDoUsuario;
  layoutAtual = null;
  contextoAtual = null;
  mostrandoCriarSenha = false;
  if (!sessao) {
    recuperandoSenha = false;
    senhaCriadaPor = null;
    paginaLogin(destino, ACOES_DE_LOGIN);
    return;
  }
  const senhaPendente = recuperandoSenha || (!senhaJaDefinida(sessao.user.user_metadata) && senhaCriadaPor !== idDoUsuario);
  if (senhaPendente) {
    mostrandoCriarSenha = true;
    paginaDefinirSenha(destino, {
      email: sessao.user.email ?? '',
      recuperacao: recuperandoSenha,
      salvar: (senha) => salvarNovaSenha(destino, senha),
      aoSair: encerrarSessao,
    });
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
    mostrarFalhaAoCarregar(destino, mensagemParaUsuario(erro), () => void aoTrocarSessao(destino, sessao, evento));
  }
}

if (!configuracaoValida) {
  mostrarConfiguracaoAusente(raiz);
} else {
  aoMudarSessao((sessao, evento) => void aoTrocarSessao(raiz, sessao, evento));
  window.addEventListener('hashchange', mostrarRotaAtual);
}
