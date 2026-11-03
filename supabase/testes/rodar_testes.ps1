# Roda os testes de regras do banco do SGI (PGlite dentro do Microsoft Edge, sem janela).
# Uso, a partir da pasta do projeto:
#   powershell -ExecutionPolicy Bypass -File supabase\testes\rodar_testes.ps1
# Para conferir o script de dados fictícios do ambiente de desenvolvimento (supabase\dev):
#   powershell -ExecutionPolicy Bypass -File supabase\testes\rodar_testes.ps1 -Teste teste_dev.js
# Requisitos: Microsoft Edge instalado e acesso à internet (o PGlite vem do cdn.jsdelivr.net).
# Sai com código 1 se alguma verificação falhar.
param([string]$Teste = 'teste_regras.js')
$ErrorActionPreference = 'Stop'
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$pastaSupabase = Split-Path -Parent $aqui

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Error 'Microsoft Edge não encontrado.'; exit 1 }

$temp = Join-Path $env:TEMP ("sgi-testes-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
try {
  $sql01 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '01_estrutura_e_regras.sql'))
  $sql02 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '02_dados_iniciais.sql'))
  $sql03 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '03_visoes_interface.sql'))
  $sql04 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '04_modulo_demandas.sql'))
  $sql05 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '05_modulo_reunioes.sql'))
  $sql06 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '06_reuniao_por_pessoas.sql'))
  $sql07 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '07_assessoria_aval_publico_exclusao.sql'))
  $sql08 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '08_modulo_acessos.sql'))
  $sql09 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '09_modulo_pontuacao.sql'))
  $sql10 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '10_modulo_presencas.sql'))
  $sql11 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '11_modulo_equipe.sql'))
  $sql12 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '12_modulo_historico.sql'))
  $sql13 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '13_modulo_regras.sql'))
  $sql14 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '14_modulo_projetos.sql'))
  $sql15 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '15_dados_pessoais.sql'))
  $sql16 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '16_tratamento.sql'))
  $sql17 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '17_disponibilidade.sql'))
  $sql18 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '18_recados_e_notificacoes.sql'))
  $sql19 = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase '19_recados_autorizacao_e_prazo.sql'))
  $sqlDev = [string](Get-Content -Raw -Encoding utf8 (Join-Path $pastaSupabase 'dev\02_dados_dev.sql'))
  $teste = [string](Get-Content -Raw -Encoding utf8 (Join-Path $aqui $Teste))
  $pagina = "<!doctype html><meta charset=utf-8><body><script>window.SQL01=" + (ConvertTo-Json -InputObject $sql01 -Compress) +
            ";window.SQL02=" + (ConvertTo-Json -InputObject $sql02 -Compress) +
            ";window.SQL03=" + (ConvertTo-Json -InputObject $sql03 -Compress) +
            ";window.SQL04=" + (ConvertTo-Json -InputObject $sql04 -Compress) +
            ";window.SQL05=" + (ConvertTo-Json -InputObject $sql05 -Compress) +
            ";window.SQL06=" + (ConvertTo-Json -InputObject $sql06 -Compress) +
            ";window.SQL07=" + (ConvertTo-Json -InputObject $sql07 -Compress) +
            ";window.SQL08=" + (ConvertTo-Json -InputObject $sql08 -Compress) +
            ";window.SQL09=" + (ConvertTo-Json -InputObject $sql09 -Compress) +
            ";window.SQL10=" + (ConvertTo-Json -InputObject $sql10 -Compress) +
            ";window.SQL11=" + (ConvertTo-Json -InputObject $sql11 -Compress) +
            ";window.SQL12=" + (ConvertTo-Json -InputObject $sql12 -Compress) +
            ";window.SQL13=" + (ConvertTo-Json -InputObject $sql13 -Compress) +
            ";window.SQL14=" + (ConvertTo-Json -InputObject $sql14 -Compress) +
            ";window.SQL15=" + (ConvertTo-Json -InputObject $sql15 -Compress) +
            ";window.SQL16=" + (ConvertTo-Json -InputObject $sql16 -Compress) +
            ";window.SQL17=" + (ConvertTo-Json -InputObject $sql17 -Compress) +
            ";window.SQL18=" + (ConvertTo-Json -InputObject $sql18 -Compress) +
            ";window.SQL19=" + (ConvertTo-Json -InputObject $sql19 -Compress) +
            ";window.SQLDEV=" + (ConvertTo-Json -InputObject $sqlDev -Compress) + ";</script><script type=`"module`">`n" + $teste + "`n</script>"
  [IO.File]::WriteAllText((Join-Path $temp 'teste.html'), $pagina, (New-Object System.Text.UTF8Encoding $false))

  $url = 'file:///' + ((Join-Path $temp 'teste.html') -replace '\\', '/')
  Start-Process -FilePath $edge -Wait -WindowStyle Hidden -RedirectStandardOutput (Join-Path $temp 'saida.html') -RedirectStandardError (Join-Path $temp 'erros.txt') `
    -ArgumentList '--headless=new', '--disable-gpu', "--user-data-dir=`"$temp\perfil`"", '--virtual-time-budget=600000', '--dump-dom', $url

  $dom = Get-Content -Raw -Encoding utf8 (Join-Path $temp 'saida.html')
  $achado = [regex]::Match($dom, '(?s)<pre id="out">(.*?)</pre>')
  if (-not $achado.Success) { Write-Error 'Os testes não produziram resultado (sem acesso à internet ou o Edge não terminou).'; exit 1 }
  $resultado = [System.Net.WebUtility]::HtmlDecode($achado.Groups[1].Value)
  Write-Output $resultado
  if ($resultado -notmatch 'FIM' -or $resultado -match '(?m)^(FALHA|ERRO GERAL)') { exit 1 }
  exit 0
} finally {
  Remove-Item -Recurse -Force -Path $temp -ErrorAction SilentlyContinue
}
