$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$dataPath = Join-Path $workspace '.local\postgres'
New-Item -ItemType Directory -Force (Join-Path $workspace '.local') | Out-Null
if (!(Test-Path (Join-Path $dataPath 'PG_VERSION'))) {
  & "$pgBin\initdb.exe" -D $dataPath -U fishing -A trust --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
}
& "$pgBin\pg_ctl.exe" -D $dataPath status | Out-Null
if ($LASTEXITCODE -ne 0) {
  & "$pgBin\pg_ctl.exe" -D $dataPath -l (Join-Path $workspace '.local\postgres.log') -o '-p 55432 -h 127.0.0.1' start
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to start' }
}
$exists = & "$pgBin\psql.exe" -h 127.0.0.1 -p 55432 -U fishing -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='fishing'"
if ($exists -ne '1') { & "$pgBin\createdb.exe" -h 127.0.0.1 -p 55432 -U fishing fishing }
