// Tela de Reuniões e atas: reuniões abertas e realizadas, painel de detalhes e agendamento.
// Mostra só o que as visões do banco devolvem (a RLS já aplicou quem convoca e quem organiza).
import { dataEHora, hojeEmSaoPaulo } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { contarPalavras } from '../../lib/texto';
import type { TranscricaoDaReuniao } from '../../types/database';
import { el, substituir } from '../../ui/dom';
import { linhaDaReuniao } from './componentes';
import type { ContextoDeReunioes } from './contexto';
import { carregarReunioes } from './dados';
import { abrirNovaReuniao, abrirVinculo } from './formularios';
import { abrirPainelDaReuniao } from './painel';
import { nomeDoPublico, separarReunioes } from './regras';

export function paginaReunioes(destino: HTMLElement): void {
  // o conteúdo é redesenhado a cada recarga; painéis e janelas ficam em `pagina`, fora dele
  const conteudo = el('div', {});
  const pagina = el('div', { class: 'pagina-reunioes' }, conteudo);
  substituir(destino, pagina);

  const recarregar = async (): Promise<ContextoDeReunioes | null> => {
    try {
      const dados = await carregarReunioes();
      // a pessoa pode ter mudado de tela enquanto os dados chegavam
      if (!pagina.isConnected) return null;
      const contexto: ContextoDeReunioes = { pagina, dados, hoje: hojeEmSaoPaulo(), recarregar };
      substituir(conteudo, ...desenhar(contexto));
      return contexto;
    } catch (erro: unknown) {
      registrarErro('Carregar reuniões', erro);
      if (pagina.isConnected) substituir(conteudo, ...desenharFalha(mensagemParaUsuario(erro)));
      return null;
    }
  };

  const desenharFalha = (mensagem: string): HTMLElement[] => {
    const tentar = el('button', { type: 'button', class: 'btn' }, 'Tentar de novo');
    tentar.addEventListener('click', () => {
      substituir(conteudo, cabecalho(null), el('p', { class: 'meta' }, 'Carregando reuniões…'));
      void recarregar();
    });
    return [cabecalho(null), el('section', { class: 'bloco' }, el('p', {}, mensagem), el('div', { class: 'linha' }, tentar))];
  };

  substituir(conteudo, cabecalho(null), el('p', { class: 'meta' }, 'Carregando reuniões…'));
  void recarregar();
}

/** Título, explicação e o botão de agendar (só aparece para quem pode agendar para algum público). */
function cabecalho(contexto: ContextoDeReunioes | null): HTMLElement {
  const botoes: HTMLElement[] = [];
  if (contexto?.dados.publicos.some((p) => p.pode_criar)) {
    const agendar = el('button', { type: 'button', class: 'btn prim' }, 'Agendar reunião');
    agendar.addEventListener('click', () => abrirNovaReuniao(contexto));
    botoes.push(agendar);
  }
  return el('section', { class: 'cab' },
    el('div', {},
      el('h1', {}, 'Reuniões e atas'),
      el('p', { class: 'sub' }, 'Pauta, presença, ata, transcrição e arquivos de cada reunião. Ao encerrar, as faltas viram lançamentos de pontuação.')),
    botoes.length ? el('div', { class: 'linha' }, ...botoes) : null);
}

function desenhar(contexto: ContextoDeReunioes): HTMLElement[] {
  const { dados, hoje } = contexto;
  const { abertas, encerradas } = separarReunioes(dados.reunioes);
  const abrir = (id: string): void => abrirPainelDaReuniao(contexto, id);
  const lista = (reunioes: typeof abertas, vazio: string): HTMLElement =>
    reunioes.length
      ? el('div', { class: 'lista' }, ...reunioes.map((r) => linhaDaReuniao(r, nomeDoPublico(r, dados.publicos), hoje, (escolhida) => abrir(escolhida.id))))
      : el('p', { class: 'vazio' }, vazio);

  return [
    cabecalho(contexto),
    el('div', { class: 'aviso integracao' },
      el('span', { class: 'ponto', 'aria-hidden': 'true' }),
      el('p', {},
        el('strong', {}, 'Integração com o Google Meet: planejada. '),
        'Ao fim de cada reunião, a transcrição e os arquivos vão chegar aqui sozinhos, ligados à reunião agendada. Até lá, quem organiza pode colar a transcrição e anexar arquivos manualmente.')),
    ...(dados.semVinculo.length ? [blocoSemVinculo(contexto)] : []),
    el('section', { class: 'secao' }, el('h2', {}, 'Próximas e pendentes'), lista(abertas, 'Nenhuma reunião agendada.')),
    el('section', { class: 'secao' }, el('h2', {}, 'Realizadas'), lista(encerradas, 'Nenhuma reunião encerrada ainda.')),
  ];
}

/** Transcrições que chegaram pela integração sem reunião correspondente (só Presidência e Assessoria as veem). */
function blocoSemVinculo(contexto: ContextoDeReunioes): HTMLElement {
  const item = (transcricao: TranscricaoDaReuniao): HTMLElement => {
    const ligar = el('button', { type: 'button', class: 'btn peq' }, 'Ligar a uma reunião');
    ligar.addEventListener('click', () => abrirVinculo(contexto, transcricao));
    return el('li', { class: 'sem-vinculo' },
      el('div', { class: 'anexo-info' },
        el('b', {}, transcricao.titulo_origem ?? 'Sem título'),
        el('span', { class: 'meta' },
          `${transcricao.inicio_origem ? `Reunião de ${dataEHora(transcricao.inicio_origem)}` : `Recebida em ${dataEHora(transcricao.recebida_em)}`} · ${contarPalavras(transcricao.texto)} palavras`),
        el('details', {}, el('summary', {}, 'Ler transcrição'), el('p', { class: 'ata' }, transcricao.texto))),
      ligar);
  };
  return el('section', { class: 'secao' },
    el('h2', {}, 'Transcrições sem reunião'),
    el('p', { class: 'dica' }, 'Chegaram da integração e não casaram com nenhuma reunião agendada no mesmo dia e horário. Ligue cada uma à reunião certa.'),
    el('ul', { class: 'anexos' }, ...contexto.dados.semVinculo.map(item)));
}
