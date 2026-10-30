// Criação de senha: no primeiro acesso (depois do link do e-mail) ou ao redefinir a senha esquecida.
// Enquanto a senha não for salva, o sistema não abre (decidido em main.ts).
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { el, substituir } from '../../ui/dom';
import { molduraDeAcesso } from '../../ui/moldura-acesso';
import { TAMANHO_MINIMO_DA_SENHA, validarNovaSenha } from './regras';

export interface OpcoesDeCriarSenha {
  email: string;
  /** Verdadeiro quando veio de "Esqueci minha senha"; muda só os textos. */
  recuperacao: boolean;
  salvar: (senha: string) => Promise<void>;
  aoSair: () => void;
}

export function paginaDefinirSenha(raiz: HTMLElement, opcoes: OpcoesDeCriarSenha): void {
  // campo de usuário invisível: faz o gerenciador de senhas do navegador salvar a senha junto com o e-mail
  const usuario = el('input', { type: 'email', name: 'email', autocomplete: 'username', value: opcoes.email, readonly: true, tabindex: '-1', class: 'sr', 'aria-hidden': 'true' });
  const campoSenha = el('input', { type: 'password', id: 'nova-senha', name: 'nova-senha', autocomplete: 'new-password', required: true });
  const campoConfirmacao = el('input', { type: 'password', id: 'nova-senha-confirmacao', name: 'nova-senha-confirmacao', autocomplete: 'new-password', required: true });
  const botao = el('button', { type: 'submit', class: 'btn prim largo' }, 'Salvar senha');
  const mensagem = el('p', { class: 'mensagem-form erro', role: 'alert' });
  const sair = el('button', { type: 'button', class: 'btn-link' }, 'Sair');
  sair.addEventListener('click', opcoes.aoSair);

  const formulario = el('form', { class: 'form', novalidate: true },
    usuario,
    el('div', {}, el('label', { for: 'nova-senha' }, 'Nova senha'), campoSenha),
    el('div', {}, el('label', { for: 'nova-senha-confirmacao' }, 'Repita a senha'), campoConfirmacao),
    botao, mensagem,
    el('div', { class: 'acoes-secundarias' }, sair));

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const problema = validarNovaSenha(campoSenha.value, campoConfirmacao.value);
    if (problema) {
      mensagem.textContent = problema;
      campoSenha.focus();
      return;
    }
    mensagem.textContent = '';
    botao.disabled = true;
    // com sucesso, main.ts troca esta tela pelo sistema
    opcoes.salvar(campoSenha.value)
      .catch((erro: unknown) => {
        registrarErro('Criar senha', erro);
        mensagem.textContent = mensagemParaUsuario(erro);
        botao.disabled = false;
      });
  });

  substituir(raiz, molduraDeAcesso(
    el('h1', {}, opcoes.recuperacao ? 'Crie uma nova senha' : 'Crie sua senha'),
    el('p', {}, `Use pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres, com letras e números. Nos próximos acessos você entra com ${opcoes.email} e esta senha.`),
    formulario,
  ));
  campoSenha.focus();
}
