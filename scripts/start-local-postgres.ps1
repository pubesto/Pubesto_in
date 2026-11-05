[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Local development database for Pubesto (separate cluster, port 5434).
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dataDirectory = Join-Path $projectRoot ".local-postgres-data"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$pgCtl = Join-Path $pgBin "pg_ctl.exe"
$port = 5434

if (-not (Test-Path -LiteralPath $pgCtl)) {
  throw "PostgreSQL 18 was not found at $pgBin. Install PostgreSQL 18 or update scripts/start-local-postgres.ps1."
}

if (-not (Test-Path -LiteralPath $dataDirectory)) {
  Write-Output "Creating local PostgreSQL cluster in $dataDirectory"
  & (Join-Path $pgBin "initdb.exe") -D $dataDirectory -U pubesto --auth=trust -E UTF8 | Out-Null
  & $pgCtl start -D $dataDirectory -o "-p $port -h 127.0.0.1" -l (Join-Path $dataDirectory "server.log") -w -t 60
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $port -U pubesto pubesto
  Write-Output "Local PostgreSQL is ready on 127.0.0.1:$port"
  exit 0
}

& $pgCtl status -D $dataDirectory *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Output "Local PostgreSQL is already running on 127.0.0.1:$port"
  exit 0
}

& $pgCtl start -D $dataDirectory -o "-p $port -h 127.0.0.1" -l (Join-Path $dataDirectory "server.log") -w -t 60
if ($LASTEXITCODE -ne 0) {
  throw "Could not start local PostgreSQL. Check .local-postgres-data/server.log for details."
}

Write-Output "Local PostgreSQL is ready on 127.0.0.1:$port"
