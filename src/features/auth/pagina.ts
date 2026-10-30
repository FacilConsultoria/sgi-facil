// Login por link mágico: a pessoa informa o e-mail e recebe um link de acesso, sem senha.
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { el, substituir } from '../../ui/dom';
import { molduraDeAcesso } from '../../ui/moldura-acesso';
import { emailValido, normalizarEmail } from './regras';

export function paginaLogin(raiz: HTMLElement, enviarLink: (email: string) => Promise<void>): void {
  const campo = el('input', { type: 'email', id: 'login-email', name: 'email', autocomplete: 'email', required: true, placeholder: 'seu.email@gmail.com' });
  const botao = el('button', { type: 'submit', class: 'btn prim largo' }, 'Receber link de acesso');
  const mensagem = el('p', { class: 'mensagem-form', role: 'status', 'aria-live': 'polite' });
  const formulario = el('form', { class: 'form', novalidate: true },
    el('div', {}, el('label', { for: 'login-email' }, 'E-mail'), campo),
    botao, mensagem);

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const email = normalizarEmail(campo.value);
    if (!emailValido(email)) {
      mensagem.textContent = 'Digite um e-mail válido.';
      mensagem.classList.add('erro');
      campo.focus();
      return;
    }
    botao.disabled = true;
    mensagem.classList.remove('erro');
    mensagem.textContent = 'Enviando…';
    enviarLink(email)
      .then(() => {
        mensagem.textContent = `Enviamos um link para ${email}. Abra o e-mail neste mesmo navegador para entrar.`;
      })
      .catch((erro: unknown) => {
        registrarErro('Enviar link de acesso', erro);
        mensagem.textContent = mensagemParaUsuario(erro);
        mensagem.classList.add('erro');
      })
      .finally(() => {
        botao.disabled = false;
      });
  });

  substituir(raiz, molduraDeAcesso(
    el('h1', {}, 'Entrar'),
    el('p', {}, 'Use o e-mail cadastrado pela Fácil. Você recebe um link de acesso, sem senha.'),
    formulario,
  ));
  campo.focus();
}
