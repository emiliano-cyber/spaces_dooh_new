# scripts/publicar-apk.ps1
# Compila el APK y lo publica con sus metadatos.
#
# El archivo space-eye.json es lo que permite la actualizacion remota: el backend
# lo lee para saber que version esta publicada y con que huella debe verificarla
# el equipo antes de instalar. Sin el, el dashboard no puede saber quien esta
# atrasado.
param(
  [string]$ServerUrl = "http://159.203.188.58:4000",
  [switch]$SoloPublicar   # omite la compilacion y publica el APK ya compilado
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$apkCompilado = Join-Path $raiz "android\app\build\outputs\apk\debug\app-debug.apk"
$destinoApk = Join-Path $raiz "frontend\public\space-eye.apk"
$destinoJson = Join-Path $raiz "frontend\public\space-eye.json"

if (-not $SoloPublicar) {
  Write-Host "`n[1] Compilando APK..." -ForegroundColor Cyan
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
  Push-Location (Join-Path $raiz "android")
  try {
    & .\gradlew.bat assembleDebug "-PserverUrl=$ServerUrl" --console=plain
    if ($LASTEXITCODE -ne 0) { throw "la compilacion fallo" }
  } finally { Pop-Location }
}

if (-not (Test-Path $apkCompilado)) { throw "No encuentro $apkCompilado" }

Write-Host "`n[2] Leyendo version del build.gradle.kts..." -ForegroundColor Cyan
$gradle = Get-Content (Join-Path $raiz "android\app\build.gradle.kts") -Raw
$versionName = [regex]::Match($gradle, 'versionName\s*=\s*"([^"]+)"').Groups[1].Value
$versionCode = [regex]::Match($gradle, 'versionCode\s*=\s*(\d+)').Groups[1].Value
if (-not $versionName -or -not $versionCode) { throw "no pude leer versionName/versionCode" }
Write-Host "    v$versionName (codigo $versionCode)"

Write-Host "`n[3] Publicando..." -ForegroundColor Cyan
Copy-Item $apkCompilado $destinoApk -Force
$sha = (Get-FileHash $destinoApk -Algorithm SHA256).Hash.ToLower()
$bytes = (Get-Item $destinoApk).Length

# Sin BOM: Out-File -Encoding utf8 en PowerShell 5.1 lo agrega y JSON.parse del
# backend no lo tolera.
$json = @{
  version      = $versionName
  version_code = [int]$versionCode
  sha256       = $sha
  bytes        = $bytes
  publicado    = (Get-Date).ToString("o")
} | ConvertTo-Json
[System.IO.File]::WriteAllText($destinoJson, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "    APK:  $destinoApk  ($([math]::Round($bytes/1MB,1)) MB)"
Write-Host "    sha256: $sha"
Write-Host "`nListo. Falta subir al servidor:" -ForegroundColor Green
Write-Host "  pscp frontend\public\space-eye.apk  ...:/var/www/Marketplace/space-eye/frontend/public/"
Write-Host "  pscp frontend\public\space-eye.json ...:/var/www/Marketplace/space-eye/frontend/public/"
