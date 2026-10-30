// Telas mostradas fora da aplicação logada: configuração ausente e login sem cadastro.
import { el, substituir } from '../ui/dom';
import { molduraDeAcesso } from '../ui/moldura-acesso';

export function mostrarConfiguracaoAusente(raiz: HTMLElement): void {
  substituir(raiz, molduraDeAcesso(
    el('h1', {}, 'Configuração pendente'),
    el('p', {}, 'O site ainda não sabe qual banco usar. Cadastre VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente (veja .env.example) e publique de novo.'),
  ));
}

export function mostrarSemCadastro(raiz: HTMLElement, email: string, aoSair: () => void): void {
  const botao = el('button', { type: 'button', class: 'btn' }, 'Entrar com outro e-mail');
  botao.addEventListener('click', aoSair);
  substituir(raiz, molduraDeAcesso(
    el('h1', {}, 'E-mail sem cadastro'),
    el('p', {}, `Você entrou como ${email}, mas esse e-mail não tem cadastro ativo no SGI. Peça à Gente e Gestão para cadastrar você.`),
    botao,
  ));
}

export function mostrarFalhaAoCarregar(raiz: HTMLElement, mensagem: string, aoTentarDeNovo: () => void): void {
  const botao = el('button', { type: 'button', class: 'btn prim' }, 'Tentar de novo');
  botao.addEventListener('click', aoTentarDeNovo);
  substituir(raiz, molduraDeAcesso(el('h1', {}, 'Não foi possível abrir o SGI'), el('p', {}, mensagem), botao));
}
