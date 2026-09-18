# ===========================================================================
#  Reconcilia el registro de migraciones de una base con los archivos en LF.
#  Lo corre una PERSONA. Lo pide el arreglo de .gitattributes del 2026-09-18.
# ---------------------------------------------------------------------------
#  POR QUE HACE FALTA
#
#  `scripts/migrar.mjs` registra el sha256 del archivo TAL COMO ESTA EN DISCO.
#  Sin congelar finales de linea, el checksum de una migracion dependia de en
#  que maquina se hizo el checkout. Medido el 18/09 sobre la base `spaces`:
#
#      filas registradas (sin backfill) : 70
#      coincide con el archivo en LF    :  5
#      coincide con el archivo en CRLF  : 65
#      ni uno ni otro                   :  0
#
#  Las 70 se explican por finales de linea. CERO diferencias de contenido.
#
#  `.gitattributes` ya congela `db/migrations/*.sql` a LF, asi que de aqui en
#  adelante el checksum es el mismo en cualquier maquina. Lo que queda es esta
#  reconciliacion de una sola vez sobre las bases que ya tienen historia.
#
#  ES SEGURO, y conviene saber por que: `--forzar-checksum` NO REAPLICA NADA.
#  Solo pone al dia el hash que el registro afirma, y exige el nombre del
#  archivo uno por uno a proposito — una bandera suelta perdonaria a bulto
#  cualquier migracion alterada, presente y futura.
#
#  QUE NO ES: esto no arregla una migracion que de verdad haya cambiado de
#  contenido. Si el guion encuentra alguna que no se explique por finales de
#  linea, SE DETIENE y la nombra. Eso si seria una persona decidiendo.
# ===========================================================================

param(
  # Sin valor por omision a proposito: reconciliar la base equivocada es facil
  # y no da ningun error visible.
  [Parameter(Mandatory = $true)][string]$Base,
  [string]$Servidor = "localhost",
  [int]$Puerto = 5433,
  [string]$Usuario = "spaces",
  [string]$Clave = "spaces",
  [string]$Repo = "C:\Users\Server\spaces_doohmain_nueva\.claude\worktrees\entidades",
  [switch]$SoloMirar
)

$ErrorActionPreference = "Stop"
Set-Location $Repo
$env:DATABASE_URL = "postgresql://${Usuario}:${Clave}@${Servidor}:${Puerto}/${Base}"

Write-Host "base      : $Base en ${Servidor}:${Puerto}"
Write-Host "repo      : $Repo"
Write-Host ""

# --- 1. Los archivos deben estar en LF antes de medir nada ------------------
$muestra = "db\migrations\20260812_sin_default_tenant.sql"
if ((Get-Content -Raw -Path $muestra) -match "`r`n") {
  Write-Host "Los .sql estan en CRLF en este arbol. Normalizando con git..." -ForegroundColor Yellow
  Remove-Item db\migrations\*.sql -Force
  git checkout -- db/migrations/
  if ((Get-Content -Raw -Path $muestra) -match "`r`n") {
    throw "Siguen en CRLF. Falta la linea 'db/migrations/*.sql text eol=lf' en .gitattributes."
  }
  Write-Host "  normalizados a LF" -ForegroundColor Green
}

# --- 2. Clasificar cada fila registrada -------------------------------------
$sql = "select archivo || '|' || checksum from schema_migrations where tipo is distinct from 'backfill' order by archivo;"
$filas = docker exec spaces_db psql -U $Usuario -d $Base -tAc $sql

$aReconciliar = @(); $yaBien = 0; $inexplicables = @()

foreach ($f in $filas) {
  if (-not $f.Trim()) { continue }
  $archivo, $registrado = $f.Trim() -split '\|', 2
  $ruta = Join-Path "db\migrations" $archivo
  if (-not (Test-Path -LiteralPath $ruta)) {
    $inexplicables += "$archivo (el archivo no existe en este arbol)"; continue
  }
  $bytesLf = [IO.File]::ReadAllBytes($ruta)
  $lf = (Get-FileHash -LiteralPath $ruta -Algorithm SHA256).Hash.ToLower()
  # La version CRLF: como estaria tras un checkout con autocrlf=true
  $texto = [Text.Encoding]::UTF8.GetString($bytesLf)
  $crlf = [BitConverter]::ToString(
      [Security.Cryptography.SHA256]::Create().ComputeHash(
        [Text.Encoding]::UTF8.GetBytes(($texto -replace "(?<!`r)`n", "`r`n"))
      )).Replace("-", "").ToLower()

  if     ($registrado -eq $lf)   { $yaBien++ }
  elseif ($registrado -eq $crlf) { $aReconciliar += $archivo }
  else   { $inexplicables += "$archivo (no coincide ni con LF ni con CRLF)" }
}

Write-Host "ya correctas (LF)      : $yaBien"
Write-Host "a reconciliar (CRLF)   : $($aReconciliar.Count)"
Write-Host "INEXPLICABLES          : $($inexplicables.Count)"
Write-Host ""

# --- 3. La puerta: si algo no se explica, no se toca nada -------------------
if ($inexplicables.Count -gt 0) {
  Write-Host "ME DETENGO. Estas no se explican por finales de linea:" -ForegroundColor Red
  $inexplicables | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  Write-Host ""
  Write-Host "Una de estas SI puede ser una migracion que cambio de verdad." -ForegroundColor Red
  Write-Host "No se reconcilia nada hasta que una persona las mire una por una."
  exit 1
}

if ($aReconciliar.Count -eq 0) { Write-Host "Nada que hacer: el registro ya esta en LF." -ForegroundColor Green; exit 0 }

if ($SoloMirar) {
  Write-Host "(-SoloMirar) Se reconciliarian estas $($aReconciliar.Count):"
  $aReconciliar | ForEach-Object { Write-Host "  - $_" }
  exit 0
}

# --- 4. Reconciliar ---------------------------------------------------------
$hechas = 0; $fallos = @()
foreach ($archivo in $aReconciliar) {
  node scripts/migrar.mjs --forzar-checksum=$archivo | Out-Null
  if ($LASTEXITCODE -eq 0) { $hechas++ } else { $fallos += $archivo }
}

Write-Host "reconciliadas: $hechas · fallos: $($fallos.Count)" -ForegroundColor Green
if ($fallos.Count -gt 0) { $fallos | ForEach-Object { Write-Host "  fallo: $_" -ForegroundColor Red } }

# --- 5. La comprobacion que lo cierra ---------------------------------------
Write-Host ""
Write-Host "=== migrar.mjs --pendientes (deberia listar lo pendiente, no abortar) ==="
node scripts/migrar.mjs --pendientes
Write-Host ""
Write-Host "Salida 0 y una lista de pendientes = reconciliado." -ForegroundColor Green
Write-Host "Salida 3 = sigue bloqueada; pega el error y se mira." -ForegroundColor Yellow
