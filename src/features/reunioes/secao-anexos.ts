// Anexos da reunião: quem consegue ver a reunião abre os arquivos; quem organiza envia e remove.
// Os arquivos ficam no bucket privado "anexos" e são abertos por endereços temporários.
import { dataEHora } from '../../lib/datas';
import { registrarErro, mensagemParaUsuario } from '../../lib/erros';
import { plural } from '../../lib/texto';
import type { AnexoDaReuniao } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { executarAcao, linhaDeErro, type LinhaDeErro } from '../../ui/formulario';
import type { ContextoDeReunioes } from './contexto';
import { carregarAnexos, carregarReuniao, enderecoDoAnexo, enviarAnexo, removerAnexo } from './dados';
import { extensaoDoArquivo, formatarTamanho, LIMITE_DO_ANEXO_EM_BYTES, NOME_DA_ORIGEM, validarArquivo } from './regras';
import { secaoQueCarrega, type Secao } from './secao';

export function secaoDosAnexos(contexto: ContextoDeReunioes, reuniaoId: string, aoMudar: () => Promise<void>): Secao {
  const { nomeDe } = contexto.dados;
  return secaoQueCarrega({
    operacao: 'Carregar anexos da reunião',
    classe: 'bloco-reu',
    carregar: async () => {
      const [reuniao, anexos] = await Promise.all([carregarReuniao(reuniaoId), carregarAnexos(reuniaoId)]);
      return { reuniao, anexos };
    },
    montar: ({ reuniao, anexos }, atualizar) => {
      const podeGerir = reuniao?.pode_gerir ?? false;
      const erro = linhaDeErro();
      const depoisDeMudar = async (): Promise<void> => {
        await atualizar();
        await aoMudar();
      };
      return [
        el('div', { class: 'linha' }, el('h3', {}, 'Anexos'), el('span', { class: 'meta' }, plural(anexos.length, 'arquivo', 'arquivos'))),
        anexos.length
          ? el('ul', { class: 'anexos' }, ...anexos.map((anexo) => itemDoAnexo(anexo, nomeDe, podeGerir, erro, depoisDeMudar)))
          : el('p', { class: 'dica' }, 'Nenhum arquivo anexado.'),
        erro.elemento,
        podeGerir ? areaDeEnvio(reuniaoId, depoisDeMudar) : null,
      ];
    },
  });
}

function itemDoAnexo(
  anexo: AnexoDaReuniao,
  nomeDe: (id: string) => string,
  podeGerir: boolean,
  erro: LinhaDeErro,
  depoisDeMudar: () => Promise<void>,
): HTMLElement {
  const abrir = el('button', { type: 'button', class: 'btn peq' }, 'Abrir');
  abrir.addEventListener('click', () => {
    void executarAcao({
      botao: abrir, erro, operacao: 'Abrir anexo',
      acao: async () => {
        const endereco = await enderecoDoAnexo(anexo);
        const ligacao = el('a', { href: endereco, target: '_blank', rel: 'noopener' });
        document.body.append(ligacao);
        ligacao.click();
        ligacao.remove();
      },
    });
  });

  const acoes = el('div', { class: 'acoes' }, abrir);
  if (podeGerir) {
    const remover = el('button', { type: 'button', class: 'btn peq' }, 'Remover');
    const confirmar = el('button', { type: 'button', class: 'btn perigo peq' }, 'Confirmar');
    const cancelar = el('button', { type: 'button', class: 'btn peq' }, 'Cancelar');
    const mostrarRemover = (): void => substituir(acoes, abrir, remover);
    remover.addEventListener('click', () => substituir(acoes, abrir, confirmar, cancelar));
    cancelar.addEventListener('click', mostrarRemover);
    confirmar.addEventListener('click', () => {
      void executarAcao({
        botao: confirmar, erro, operacao: 'Remover anexo',
        acao: () => removerAnexo(anexo.id),
      }).then(async (deuCerto) => {
        if (!deuCerto) {
          mostrarRemover();
          return;
        }
        mostrarAviso('Anexo removido');
        await depoisDeMudar();
      });
    });
    mostrarRemover();
  }

  return el('li', { class: 'anexo' },
    el('span', { class: 'ext', 'aria-hidden': 'true' }, extensaoDoArquivo(anexo.nome, anexo.tipo)),
    el('div', { class: 'anexo-info' },
      el('b', {}, anexo.nome),
      el('span', { class: 'meta' },
        [formatarTamanho(anexo.tamanho), anexo.enviado_por ? nomeDe(anexo.enviado_por) : 'Integração', dataEHora(anexo.enviado_em), NOME_DA_ORIGEM[anexo.origem]].join(' · '))),
    acoes);
}

/** Arraste e solte ou escolha no computador; os arquivos sobem um a um e a lista é recarregada no fim. */
function areaDeEnvio(reuniaoId: string, depoisDeMudar: () => Promise<void>): HTMLElement {
  const entrada = el('input', { type: 'file', id: 'anexo-arquivos', class: 'sr', multiple: true });
  const andamento = el('p', { class: 'dica', role: 'status', 'aria-live': 'polite' });
  const zona = el('label', { class: 'soltar', for: 'anexo-arquivos' },
    'Arraste arquivos aqui ou ',
    el('u', {}, 'escolha no computador'),
    el('span', {}, `Apresentações, planilhas, PDFs, imagens. Até ${LIMITE_DO_ANEXO_EM_BYTES / (1024 * 1024)} MB por arquivo.`),
    entrada);

  const enviar = async (arquivos: File[]): Promise<void> => {
    let enviados = 0;
    const falhas: string[] = [];
    for (const [posicao, arquivo] of arquivos.entries()) {
      const problema = validarArquivo(arquivo);
      if (problema) {
        falhas.push(problema);
        continue;
      }
      andamento.textContent = `Enviando ${posicao + 1} de ${arquivos.length}: ${arquivo.name}…`;
      try {
        await enviarAnexo(reuniaoId, arquivo);
        enviados += 1;
      } catch (falha: unknown) {
        registrarErro('Enviar anexo', falha);
        falhas.push(`Não foi possível enviar “${arquivo.name}”. ${mensagemParaUsuario(falha)}`);
      }
    }
    andamento.textContent = '';
    if (enviados > 0) mostrarAviso(plural(enviados, 'arquivo anexado', 'arquivos anexados'));
    if (falhas.length > 0) mostrarAviso(falhas.join(' '), 'erro');
    if (enviados > 0) await depoisDeMudar();
  };

  entrada.addEventListener('change', () => {
    const escolhidos = [...(entrada.files ?? [])];
    entrada.value = '';
    if (escolhidos.length > 0) void enviar(escolhidos);
  });
  for (const nome of ['dragenter', 'dragover']) {
    zona.addEventListener(nome, (evento) => {
      evento.preventDefault();
      zona.classList.add('sobre');
    });
  }
  for (const nome of ['dragleave', 'drop']) zona.addEventListener(nome, () => zona.classList.remove('sobre'));
  zona.addEventListener('drop', (evento) => {
    evento.preventDefault();
    const soltos = [...(evento.dataTransfer?.files ?? [])];
    if (soltos.length > 0) void enviar(soltos);
  });
  return el('div', {}, zona, andamento);
}
