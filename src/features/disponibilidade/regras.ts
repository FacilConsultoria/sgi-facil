// Regras do calendário de disponibilidade. Funções puras, sem acesso a dados.
// A grade é semanal: segunda a domingo, das 7h às 22h, de hora em hora. Cada horário é um número,
// dia * 24 + hora de início (segunda = dia 0), o mesmo que o banco confere em salvar_minha_disponibilidade.

export const DIAS: readonly { nome: string; curto: string }[] = [
  { nome: 'Segunda-feira', curto: 'Seg' },
  { nome: 'Terça-feira', curto: 'Ter' },
  { nome: 'Quarta-feira', curto: 'Qua' },
  { nome: 'Quinta-feira', curto: 'Qui' },
  { nome: 'Sexta-feira', curto: 'Sex' },
  { nome: 'Sábado', curto: 'Sáb' },
  { nome: 'Domingo', curto: 'Dom' },
];

export const HORA_INICIAL = 7;
/** Primeira hora fora da grade: o último horário começa às 21h e termina às 22h. */
export const HORA_FINAL = 22;
export const HORAS: readonly number[] = Array.from({ length: HORA_FINAL - HORA_INICIAL }, (_, i) => HORA_INICIAL + i);
export const DURACOES_EM_HORAS: readonly number[] = [1, 2, 3, 4];

export type Horarios = ReadonlySet<number>;
/** Grade de cada pessoa, pelo id. */
export type Grades = ReadonlyMap<string, Horarios>;

export function codigoDoHorario(dia: number, hora: number): number {
  return dia * 24 + hora;
}

export function horarioDoCodigo(codigo: number): { dia: number; hora: number } {
  return { dia: Math.floor(codigo / 24), hora: codigo % 24 };
}

export function horarioValido(codigo: number): boolean {
  if (!Number.isInteger(codigo) || codigo < 0 || codigo > 167) return false;
  const { hora } = horarioDoCodigo(codigo);
  return hora >= HORA_INICIAL && hora < HORA_FINAL;
}

/** "07:00". */
export function descreverHora(hora: number): string {
  return `${String(hora).padStart(2, '0')}:00`;
}

/** Só os horários que cabem na grade, sem repetição (o que o banco guardaria). */
export function horariosValidos(codigos: readonly number[]): Set<number> {
  return new Set(codigos.filter(horarioValido));
}

/** Marca ou desmarca um horário. */
export function alternarHorario(atuais: Horarios, dia: number, hora: number): Set<number> {
  const novos = new Set(atuais);
  const codigo = codigoDoHorario(dia, hora);
  if (novos.has(codigo)) novos.delete(codigo);
  else novos.add(codigo);
  return novos;
}

function alternarGrupo(atuais: Horarios, grupo: readonly number[]): Set<number> {
  const novos = new Set(atuais);
  const todosMarcados = grupo.every((codigo) => novos.has(codigo));
  for (const codigo of grupo) {
    if (todosMarcados) novos.delete(codigo);
    else novos.add(codigo);
  }
  return novos;
}

/** O dia inteiro (das 7h às 22h): marca tudo ou, se já estava tudo marcado, desmarca. */
export function alternarDia(atuais: Horarios, dia: number): Set<number> {
  return alternarGrupo(atuais, HORAS.map((hora) => codigoDoHorario(dia, hora)));
}

/** A mesma hora em todos os dias da semana. */
export function alternarHora(atuais: Horarios, hora: number): Set<number> {
  return alternarGrupo(atuais, DIAS.map((_, dia) => codigoDoHorario(dia, hora)));
}

/** "9h–12h" e "19h–22h" para as faixas seguidas de um dia; vazio se não há horário marcado. */
export function faixasDoDia(selecionados: Horarios, dia: number): string[] {
  const faixas: string[] = [];
  let inicio: number | null = null;
  for (const hora of [...HORAS, HORA_FINAL]) {
    const marcada = hora < HORA_FINAL && selecionados.has(codigoDoHorario(dia, hora));
    if (marcada && inicio === null) inicio = hora;
    if (!marcada && inicio !== null) {
      faixas.push(`${inicio}h–${hora}h`);
      inicio = null;
    }
  }
  return faixas;
}

/** "Seg 19h–22h · Sáb 9h–12h"; "Nenhum horário marcado" quando a grade está vazia. */
export function resumirSemana(selecionados: Horarios): string {
  const partes = DIAS.flatMap((dia, indice) => {
    const faixas = faixasDoDia(selecionados, indice);
    return faixas.length ? [`${dia.curto} ${faixas.join(', ')}`] : [];
  });
  return partes.length ? partes.join(' · ') : 'Nenhum horário marcado';
}

/** Quantas das pessoas indicadas estão disponíveis em cada horário (só aparecem os horários com alguém). */
export function contarDisponiveis(grades: Grades, pessoas: readonly string[]): Map<number, number> {
  const contagens = new Map<number, number>();
  for (const id of pessoas) {
    for (const codigo of grades.get(id) ?? []) contagens.set(codigo, (contagens.get(codigo) ?? 0) + 1);
  }
  return contagens;
}

/** 0 (ninguém) a 4 (todas as pessoas), para a cor do mapa de calor. */
export function nivelDeCalor(disponiveis: number, total: number): number {
  if (total <= 0 || disponiveis <= 0) return 0;
  return Math.max(1, Math.ceil((disponiveis / total) * 4));
}

export interface Janela {
  dia: number;
  /** Primeira hora em que a reunião pode começar. */
  inicio: number;
  /** Hora em que termina a última reunião possível nessa faixa. */
  fim: number;
  disponiveis: number;
  total: number;
}

/**
 * Os melhores horários para uma reunião de `duracao` horas: aqueles em que mais pessoas estão
 * disponíveis durante a reunião inteira. Horários seguidos com a mesma contagem viram uma faixa só.
 * Vazio quando ninguém pode, ou quando não há pessoa escolhida.
 */
export function melhoresJanelas(grades: Grades, pessoas: readonly string[], duracao: number): Janela[] {
  const total = pessoas.length;
  if (total === 0 || duracao < 1) return [];
  const candidatas: { dia: number; inicio: number; disponiveis: number }[] = [];
  for (let dia = 0; dia < DIAS.length; dia++) {
    for (let inicio = HORA_INICIAL; inicio + duracao <= HORA_FINAL; inicio++) {
      let disponiveis = 0;
      for (const id of pessoas) {
        const grade = grades.get(id);
        if (grade && Array.from({ length: duracao }, (_, i) => codigoDoHorario(dia, inicio + i)).every((c) => grade.has(c))) disponiveis++;
      }
      candidatas.push({ dia, inicio, disponiveis });
    }
  }
  const maximo = Math.max(...candidatas.map((c) => c.disponiveis));
  if (maximo === 0) return [];
  const melhores = candidatas.filter((c) => c.disponiveis === maximo);
  const faixas: Janela[] = [];
  for (const candidata of melhores) {
    const ultima = faixas[faixas.length - 1];
    if (ultima && ultima.dia === candidata.dia && ultima.fim === candidata.inicio + duracao - 1) {
      ultima.fim = candidata.inicio + duracao;
    } else {
      faixas.push({ dia: candidata.dia, inicio: candidata.inicio, fim: candidata.inicio + duracao, disponiveis: maximo, total });
    }
  }
  return faixas;
}

/** "Sábado, das 09:00 às 12:00 · 5 de 6 pessoas". */
export function descreverJanela(janela: Janela): string {
  const dia = DIAS[janela.dia]?.nome ?? '';
  return `${dia}, das ${descreverHora(janela.inicio)} às ${descreverHora(janela.fim)} · ${janela.disponiveis} de ${janela.total} ${janela.total === 1 ? 'pessoa' : 'pessoas'}`;
}

/** Nomes de quem ainda não preencheu, em ordem alfabética. */
export function semGrade(pessoas: readonly { nome: string; preenchida: boolean }[]): string[] {
  return pessoas.filter((p) => !p.preenchida).map((p) => p.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
