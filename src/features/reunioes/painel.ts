// Painel lateral de uma reunião: dados, presença, ata, transcrição, anexos e histórico.
// Cada parte é uma seção que se atualiza sozinha (ver secao.ts); o que muda aqui também
// refresca o histórico e a lista de reuniões por trás.
import { dataCompleta, dataEHora, horaCurta } from '../../lib/datas';
import { abrirCamada } from '../../ui/camada';
import { el } from '../../ui/dom';
import { botaoFechar } from '../../ui/formulario';
import { seloDoPublico } from './componentes';
import type { ContextoDeReunioes } from './contexto';
import { carregarHistoricoDaReuniao, carregarReuniao } from './dados';
import { nomeDoPublico } from './regras';
import { secaoQueCarrega, type Secao } from './secao';
import { secaoDosAnexos } from './secao-anexos';
import { secaoDeExclusao } from './secao-excluir';
import { secaoDePresenca } from './secao-presenca';
import { secaoDaAta, secaoDaTranscricao } from './secao-texto';

const ID_DO_TITULO = 'painel-reuniao-titulo';

export function abrirPainelDaReuniao(contexto: ContextoDeReunioes, reuniaoId: string): void {
  const { dados } = contexto;
  const conhecida = dados.reunioes.find((r) => r.id === reuniaoId);

  abrirCamada(contexto.pagina, {
    tipo: 'painel',
    idDoTitulo: ID_DO_TITULO,
    montar: (fechar) => {
      const topo = secaoDoTopo(contexto, reuniaoId);
      const historico = secaoDoHistorico(contexto, reuniaoId);
      /** Depois de gravar: atualiza as seções afetadas, o histórico e a lista por trás do painel. */
      const aoMudar = (...afetadas: Secao[]) => async (): Promise<void> => {
        await Promise.all([...afetadas.map((secao) => secao.atualizar()), historico.atualizar(), contexto.recarregar()]);
      };
      const presenca = secaoDePresenca(contexto, reuniaoId, aoMudar(topo));
      const ata = secaoDaAta(contexto, reuniaoId, aoMudar());
      const transcricao = secaoDaTranscricao(contexto, reuniaoId, aoMudar());
      const anexos = secaoDosAnexos(contexto, reuniaoId, aoMudar());
      const exclusao = secaoDeExclusao(contexto, reuniaoId, fechar);

      return [
        el('div', { class: 'painel-cab' },
          el('span', { class: 'mono' }, conhecida ? `${dataCompleta(conhecida.data)} · ${horaCurta(conhecida.hora)}` : 'Reunião'),
          botaoFechar(fechar)),
        el('div', { class: 'painel-corpo' },
          topo.elemento, presenca.elemento, ata.elemento, transcricao.elemento, anexos.elemento, historico.elemento, exclusao.elemento),
      ];
    },
  });
}

function secaoDoTopo(contexto: ContextoDeReunioes, reuniaoId: string): Secao {
  const { dados } = contexto;
  return secaoQueCarrega({
    operacao: 'Carregar reunião',
    carregar: () => carregarReuniao(reuniaoId),
    montar: (reuniao) => {
      if (!reuniao) return [el('h2', { id: ID_DO_TITULO }, 'Reunião indisponível'), el('p', { class: 'dica' }, 'Esta reunião não existe mais ou você deixou de poder vê-la.')];
      return [
        el('h2', { id: ID_DO_TITULO }, reuniao.titulo),
        el('div', { class: 'linha selos' },
          seloDoPublico(reuniao.escopo, nomeDoPublico(reuniao, dados.publicos)),
          reuniao.encerrada ? el('span', { class: 'chip ok' }, 'Encerrada') : null),
        el('dl', { class: 'dl' },
          el('dt', {}, 'Pauta'),
          el('dd', { class: reuniao.pauta ? undefined : 'meta' }, reuniao.pauta || 'Sem pauta'),
          el('dt', {}, 'Organização'),
          el('dd', {}, dados.nomeDe(reuniao.criado_por))),
      ];
    },
  });
}

function secaoDoHistorico(contexto: ContextoDeReunioes, reuniaoId: string): Secao {
  const { nomeDe } = contexto.dados;
  return secaoQueCarrega({
    operacao: 'Carregar histórico da reunião',
    classe: 'secao-hist',
    carregar: () => carregarHistoricoDaReuniao(reuniaoId),
    montar: (registros) => [
      el('h3', {}, 'Histórico'),
      registros.length
        ? el('ul', { class: 'hist' },
          ...registros.map((r) => el('li', {},
            el('time', { datetime: r.em }, dataEHora(r.em)),
            el('span', {}, el('strong', {}, r.ator ? nomeDe(r.ator) : 'Integração'), ` · ${r.acao}: ${r.detalhe}`))))
        : el('p', { class: 'dica' }, 'Sem alterações registradas.'),
    ],
  });
}
