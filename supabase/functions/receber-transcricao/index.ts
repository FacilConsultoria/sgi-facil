// SGI Fácil Consultoria · Edge Function "receber-transcricao"
// Recebe a transcrição de uma reunião (enviada pelo Apps Script, Make ou outra
// automação) e grava no SGI, vinculando à reunião agendada mais próxima.
//
// Chamada:
//   POST https://<projeto>.supabase.co/functions/v1/receber-transcricao
//   Cabeçalho: x-sgi-chave: <valor do segredo SGI_CHAVE_INTEGRACAO>
//   Corpo JSON: { "titulo": "Reunião geral", "inicio": "2026-11-06T19:00:00-03:00", "texto": "..." }
//
// Esta função precisa ser publicada SEM verificação de JWT, porque quem chama
// é uma automação, não uma pessoa logada. A proteção é a chave secreta.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CHAVE = Deno.env.get("SGI_CHAVE_INTEGRACAO") ?? "";

// comparação em tempo constante, para não vazar a chave por tempo de resposta
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return resposta(405, { erro: "Use POST." });
  if (CHAVE.length < 24) return resposta(500, { erro: "Segredo SGI_CHAVE_INTEGRACAO não configurado (mínimo 24 caracteres)." });
  if (!iguais(req.headers.get("x-sgi-chave") ?? "", CHAVE)) return resposta(401, { erro: "Chave de integração inválida." });

  let corpo: { titulo?: string; inicio?: string; texto?: string };
  try { corpo = await req.json(); } catch { return resposta(400, { erro: "O corpo precisa ser JSON." }); }

  const { titulo, inicio, texto } = corpo ?? {};
  if (typeof texto !== "string" || typeof inicio !== "string" || Number.isNaN(Date.parse(inicio))) {
    return resposta(400, { erro: "Envie 'inicio' (data e hora ISO 8601, com fuso) e 'texto'." });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase.rpc("receber_transcricao_externa", {
    p_titulo: typeof titulo === "string" ? titulo : null,
    p_inicio: inicio,
    p_texto: texto,
    p_origem: "meet",
  });
  if (error) return resposta(422, { erro: error.message });
  return resposta(201, { transcricao_id: data });
});
