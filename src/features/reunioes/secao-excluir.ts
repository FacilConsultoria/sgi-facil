// Exclusão da reunião, em dois passos e só para quem o banco autoriza (indicador pode_excluir).
// Reunião encerrada exige o motivo: as faltas lançadas são desconsideradas e ele fica registrado nelas.
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { executarAcao, linhaDeErro } from '../../ui/formulario';
import type { ContextoDeReunioes } from './contexto';
import { carregarReuniao, excluirReuniao } from './dados';
import { validarExclusao } from './regras';
import { secaoQueCarrega, type Secao } from './secao';

export function secaoDeExclusao(contexto: ContextoDeReunioes, reuniaoId: string, aoExcluir: () => void): Secao {
  return secaoQueCarrega({
    operacao: 'Carregar exclusão da reunião',
    classe: 'zona-de-perigo',
    carregar: () => carregarReuniao(reuniaoId),
    montar: (reuniao) => {
      if (!reuniao?.pode_excluir) return [];
      const area = el('div', { class: 'linha' });
      const erro = linhaDeErro();
      const excluir = el('button', { type: 'button', class: 'btn perigo' }, 'Excluir reunião');
      const motivo = el('textarea', { id: 'excluir-motivo', placeholder: 'Por que esta reunião está sendo excluída?' });
      const confirmar = el('button', { type: 'button', class: 'btn perigo' }, 'Confirmar exclusão');
      const cancelar = el('button', { type: 'button', class: 'btn' }, 'Cancelar');
      const explicacao = el('p', { class: 'dica' },
        reuniao.encerrada
          ? 'Esta reunião já foi encerrada. Excluí-la desconsidera as faltas que viraram pontos, com o motivo abaixo, e apaga ata, transcrição e arquivos. Não dá para desfazer.'
          : 'A reunião, a ata, a transcrição e os arquivos serão apagados. Não dá para desfazer.');
      const mostrarBotao = (): void => substituir(area, excluir);

      excluir.addEventListener('click', () => {
        erro.limpar();
        substituir(area, el('div', { class: 'form' }, explicacao,
          reuniao.encerrada ? el('div', {}, el('label', { for: 'excluir-motivo' }, 'Motivo'), motivo) : null,
          el('div', { class: 'linha' }, confirmar, cancelar)));
        if (reuniao.encerrada) motivo.focus();
      });
      cancelar.addEventListener('click', () => {
        erro.limpar();
        mostrarBotao();
      });
      confirmar.addEventListener('click', () => {
        const problema = validarExclusao(reuniao.encerrada, motivo.value);
        if (problema) {
          erro.mostrar(problema);
          return;
        }
        void executarAcao({
          botao: confirmar, erro, operacao: 'Excluir reunião',
          acao: () => excluirReuniao(reuniao.id, motivo.value.trim()),
        }).then(async (deuCerto) => {
          if (!deuCerto) return;
          aoExcluir();
          mostrarAviso('Reunião excluída');
          await contexto.recarregar();
        });
      });
      mostrarBotao();
      return [el('h3', {}, 'Excluir reunião'), area, erro.elemento];
    },
  });
}
