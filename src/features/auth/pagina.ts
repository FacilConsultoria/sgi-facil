// Login em duas etapas: e-mail, depois senha. No primeiro acesso (ou se esqueceu a senha)
// a pessoa recebe um link no e-mail, abre o SGI por ele e cria a senha (ver definir-senha.ts).
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { el, substituir } from '../../ui/dom';
import { molduraDeAcesso } from '../../ui/moldura-acesso';
import { emailValido, normalizarEmail } from './regras';

export interface AcoesDeLogin {
  entrarComSenha: (email: string, senha: string) => Promise<void>;
  enviarLinkDePrimeiroAcesso: (email: string) => Promise<void>;
  enviarLinkDeRecuperacao: (email: string) => Promise<void>;
}

export function paginaLogin(raiz: HTMLElement, acoes: AcoesDeLogin): void {
  const campoEmail = el('input', { type: 'email', id: 'login-email', name: 'email', autocomplete: 'username', required: true, placeholder: 'seu.email@gmail.com' });
  const campoSenha = el('input', { type: 'password', id: 'login-senha', name: 'senha', autocomplete: 'current-password', placeholder: 'Sua senha' });
  const blocoSenha = el('div', { hidden: true }, el('label', { for: 'login-senha' }, 'Senha'), campoSenha);
  const botao = el('button', { type: 'submit', class: 'btn prim largo' }, 'Continuar');
  const mensagem = el('p', { class: 'mensagem-form', role: 'status', 'aria-live': 'polite' });
  const trocarEmail = el('button', { type: 'button', class: 'btn-link', hidden: true }, 'Usar outro e-mail');
  const primeiroAcesso = el('button', { type: 'button', class: 'btn-link' }, 'Primeiro acesso? Receber link por e-mail');
  const esqueci = el('button', { type: 'button', class: 'btn-link', hidden: true }, 'Esqueci minha senha');
  const formulario = el('form', { class: 'form', novalidate: true },
    el('div', {}, el('label', { for: 'login-email' }, 'E-mail'), campoEmail),
    blocoSenha, botao, mensagem,
    el('div', { class: 'acoes-secundarias' }, esqueci, primeiroAcesso, trocarEmail));

  let etapaDaSenha = false;
  const controles = [botao, trocarEmail, primeiroAcesso, esqueci];

  const avisar = (texto: string, erro = false): void => {
    mensagem.textContent = texto;
    mensagem.classList.toggle('erro', erro);
  };

  const irParaEtapa = (senha: boolean): void => {
    etapaDaSenha = senha;
    campoEmail.readOnly = senha;
    blocoSenha.hidden = !senha;
    trocarEmail.hidden = !senha;
    esqueci.hidden = !senha;
    botao.textContent = senha ? 'Entrar' : 'Continuar';
    campoSenha.value = '';
    avisar('');
    (senha ? campoSenha : campoEmail).focus();
  };

  const emailDigitado = (): string | null => {
    const email = normalizarEmail(campoEmail.value);
    if (emailValido(email)) return email;
    avisar('Digite um e-mail válido.', true);
    campoEmail.focus();
    return null;
  };

  /** Trava os controles, executa e mostra o resultado; o detalhe técnico do erro vai para o console. */
  const executar = (operacao: string, acao: () => Promise<void>, sucesso: string): void => {
    for (const controle of controles) controle.disabled = true;
    avisar('Aguarde…');
    acao()
      .then(() => avisar(sucesso))
      .catch((erro: unknown) => {
        registrarErro(operacao, erro);
        avisar(mensagemParaUsuario(erro), true);
      })
      .finally(() => {
        for (const controle of controles) controle.disabled = false;
      });
  };

  const enviarLink = (operacao: string, enviar: (email: string) => Promise<void>, texto: (email: string) => string): void => {
    const email = emailDigitado();
    if (email) executar(operacao, () => enviar(email), texto(email));
  };

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const email = emailDigitado();
    if (!email) return;
    if (!etapaDaSenha) {
      irParaEtapa(true);
      return;
    }
    if (!campoSenha.value) {
      avisar('Digite sua senha.', true);
      campoSenha.focus();
      return;
    }
    // ao entrar, a mudança de sessão troca esta tela pelo sistema (main.ts)
    executar('Entrar com senha', () => acoes.entrarComSenha(email, campoSenha.value), 'Entrando…');
  });
  trocarEmail.addEventListener('click', () => irParaEtapa(false));
  primeiroAcesso.addEventListener('click', () => enviarLink('Enviar link de primeiro acesso', acoes.enviarLinkDePrimeiroAcesso,
    (email) => `Enviamos um link para ${email}. Abra o e-mail neste mesmo navegador, clique no link e crie sua senha. Confira também o spam.`));
  esqueci.addEventListener('click', () => enviarLink('Enviar link de nova senha', acoes.enviarLinkDeRecuperacao,
    (email) => `Se ${email} tem cadastro, enviamos um link para criar uma nova senha. Abra-o neste mesmo navegador. Confira também o spam.`));

  substituir(raiz, molduraDeAcesso(
    el('h1', {}, 'Entrar'),
    el('p', {}, 'Use o e-mail cadastrado pela Fácil. No primeiro acesso, você recebe um link por e-mail e cria sua senha.'),
    formulario,
  ));
  campoEmail.focus();
}
