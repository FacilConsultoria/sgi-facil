// Datas no fuso do banco (São Paulo). Datas de calendário viajam como texto AAAA-MM-DD.
const FUSO = 'America/Sao_Paulo';
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** Dia de hoje em São Paulo, no formato AAAA-MM-DD. */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

/** Soma dias a uma data AAAA-MM-DD, sem depender do fuso do aparelho. */
export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const resultado = new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, (dia ?? 1) + dias));
  return resultado.toISOString().slice(0, 10);
}

/** "2026-11-05" → "05/11". */
export function dataCurta(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

/** "2026-11-05" → "05/11/2026". */
export function dataCompleta(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** "2026-11-05" → { dia: "05", mes: "NOV" }, para o bloco de data das listas. */
export function diaEMes(data: string): { dia: string; mes: string } {
  const [, mes, dia] = data.split('-');
  return { dia: dia ?? '', mes: MESES[Number(mes) - 1] ?? '' };
}

/** "19:00:00" (hora do banco) → "19:00". */
export function horaCurta(hora: string): string {
  return hora.slice(0, 5);
}

/** Instante do banco (timestamptz) → "05/11 14:30", no horário de São Paulo. */
export function dataEHora(instante: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(instante));
  const parte = (tipo: Intl.DateTimeFormatPartTypes): string => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('day')}/${parte('month')} ${parte('hour')}:${parte('minute')}`;
}
