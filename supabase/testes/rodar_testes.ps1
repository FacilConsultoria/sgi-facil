# Roda os testes de regras do banco do SGI (PGlite dentro do Microsoft Edge, sem janela).
# Uso, a partir da pasta do projeto:
#   powershell -ExecutionPolicy Bypass -File supabase\testes\rodar_testes.ps1
# Requisitos: Microsoft Edge instalado e acesso à internet (o PGlite vem do cdn.jsdelivr.net).
# Sai com código 1 se alguma verificação falhar.
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
  $teste = [string](Get-Content -Raw -Encoding utf8 (Join-Path $aqui 'teste_regras.js'))
  $pagina = "<!doctype html><meta charset=utf-8><body><script>window.SQL01=" + (ConvertTo-Json -InputObject $sql01 -Compress) +
            ";window.SQL02=" + (ConvertTo-Json -InputObject $sql02 -Compress) +
            ";window.SQL03=" + (ConvertTo-Json -InputObject $sql03 -Compress) + ";</script><script type=`"module`">`n" + $teste + "`n</script>"
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
