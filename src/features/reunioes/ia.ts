// Rascunho de ata com a IA que a pessoa já usa (Claude, Gemini), sem custo e sem chave: o SGI monta o pedido para
// colar no chat e lê a resposta colada de volta. Funções puras, sem acesso a dados.
import { dataCompleta } from '../../lib/datas';

export interface Encaminhamento {
  tarefa: string;
  /** Nome como a IA escreveu; nulo quando "a definir". */
  responsavel: string | null;
  /** AAAA-MM-DD; nulo quando sem prazo ou em formato que não dá para ler. */
  prazo: string | null;
}

export interface RespostaDaIa {
  ata: string;
  encaminhamentos: Encaminhamento[];
}

/** Texto para colar no Claude ou no Gemini: instruções, formato da resposta e a transcrição. */
export function montarPedidoDaAta(reuniao: { titulo: string; data: string }, transcricao: string): string {
  return [
    'Você vai redigir a ata de uma reunião da Fácil Consultoria (empresa júnior) a partir da transcrição abaixo.',
    `Reunião: ${reuniao.titulo} · ${dataCompleta(reuniao.data)}`,
    '',
    'Responda exatamente neste formato, sem nada antes ou depois:',
    'ATA',
    '<resumo em tópicos curtos: contexto, decisões tomadas e pontos de atenção>',
    'ENCAMINHAMENTOS',
    '- <tarefa> | <responsável, com o nome como aparece na transcrição, ou "a definir"> | <prazo no formato AAAA-MM-DD, ou "sem prazo">',
    '',
    'Regras: escreva em português; não invente decisões, responsáveis ou prazos que não estejam na transcrição;',
    'não inclua dados pessoais (CPF, telefone, endereço); se não houver encaminhamentos, deixe a seção vazia.',
    '',
    'TRANSCRIÇÃO',
    '"""',
    transcricao.trim(),
    '"""',
  ].join('\n');
}

const TITULO = /^[#*\s]*(ata|encaminhamentos)[*:\s]*$/i;
const MARCADOR = /^\s*(?:[-*•]|\d+[.)])\s*/;

/**
 * Lê a resposta colada. Sem as seções ATA/ENCAMINHAMENTOS (ex.: o resumo do Fathom), o texto inteiro vira a ata.
 * Linhas de encaminhamento: "- tarefa | responsável | prazo".
 */
export function lerRespostaDaIa(texto: string): RespostaDaIa {
  const linhas = texto.replace(/\r\n/g, '\n').split('\n');
  const inicioAta = linhas.findIndex((l) => TITULO.test(l) && /ata/i.test(l) && !/encaminhamentos/i.test(l));
  const inicioEnc = linhas.findIndex((l) => TITULO.test(l) && /encaminhamentos/i.test(l));
  if (inicioAta < 0 && inicioEnc < 0) return { ata: texto.trim(), encaminhamentos: [] };

  const fimAta = inicioEnc > inicioAta ? inicioEnc : linhas.length;
  const ata = inicioAta >= 0 ? linhas.slice(inicioAta + 1, fimAta).join('\n').trim() : linhas.slice(0, Math.max(0, inicioEnc)).join('\n').trim();
  const encaminhamentos = inicioEnc < 0 ? [] : linhas.slice(inicioEnc + 1)
    .filter((l) => MARCADOR.test(l) && l.replace(MARCADOR, '').trim())
    .map((l) => {
      const [tarefa = '', responsavel = '', prazo = ''] = l.replace(MARCADOR, '').split('|').map((p) => p.trim());
      const semResponsavel = !responsavel || /^a definir$/i.test(responsavel);
      return {
        tarefa,
        responsavel: semResponsavel ? null : responsavel,
        prazo: /^\d{4}-\d{2}-\d{2}$/.test(prazo) ? prazo : null,
      };
    })
    .filter((e) => e.tarefa);
  return { ata, encaminhamentos };
}

/** Minúsculas e sem acentos, para comparar nomes. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * A pessoa citada pela IA entre as que podem ser executoras: nome igual; senão, primeiro nome que só uma pessoa tem.
 * Nulo quando não dá para saber com segurança (aí ninguém vem marcado).
 */
export function acharPessoaPeloNome<P extends { id: string; nome: string }>(pessoas: readonly P[], nome: string | null): P | null {
  if (!nome) return null;
  const alvo = normalizar(nome);
  const igual = pessoas.find((p) => normalizar(p.nome) === alvo);
  if (igual) return igual;
  const primeiro = alvo.split(/\s+/)[0] ?? '';
  const mesmos = pessoas.filter((p) => normalizar(p.nome).split(/\s+/)[0] === primeiro);
  return mesmos.length === 1 ? (mesmos[0] ?? null) : null;
}
