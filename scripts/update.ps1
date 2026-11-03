# scripts/update.ps1 — update an existing DSH Cinema install, keeping a backup and your own edits visible.
#
#   pwsh -File scripts/update.ps1                 # copy this checkout over the installed skill
#   pwsh -File scripts/update.ps1 -Repo           # git pull the installed clone instead
#   pwsh -File scripts/update.ps1 -DryRun         # show what would change, change nothing
#
# The update never deletes files that only exist in the destination: if you added a shot or a reference, it stays. It
# reports files that differ so you can see what a pull would overwrite before it does.
[CmdletBinding()]
param(
  [string]$Source = "",
  [string]$Dest = "",
  [switch]$Repo,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $Dest) {
  $dshHome = $env:DSH_HOME
  if (-not $dshHome) { $dshHome = Join-Path $HOME ".dsh" }
  $Dest = Join-Path $dshHome (Join-Path "skills" "dsh-cinema")
}
$Dest = [IO.Path]::GetFullPath($Dest)
if (-not (Test-Path $Dest)) { throw "not installed: $Dest (run scripts/install.ps1 first)" }

if ($Repo) {
  if (-not (Test-Path (Join-Path $Dest ".git"))) { throw "$Dest is not a git clone; run install.ps1 -Repo instead" }
  Write-Host "==> git pull in $Dest" -ForegroundColor Cyan
  Push-Location $Dest
  try {
    git status --short
    if ($DryRun) { git fetch --all; git log --oneline HEAD..@{u} 2>$null } else { git pull --ff-only }
  } finally { Pop-Location }
  exit $LASTEXITCODE
}

if (-not $Source) {
  $repoRoot = Split-Path -Parent $PSScriptRoot
  if (-not (Test-Path (Join-Path $repoRoot "SKILL.md"))) { throw "no local checkout next to this script; pass -Source <path> or use -Repo" }
  $Source = $repoRoot
}
$Source = [IO.Path]::GetFullPath($Source)

# ---- what would change -------------------------------------------------------------------------
$changed = @()
$srcFiles = Get-ChildItem $Source -Recurse -File | Where-Object { $_.FullName -notmatch '\\(node_modules|out|\.git)\\' }
foreach ($f in $srcFiles) {
  $rel = $f.FullName.Substring($Source.Length).TrimStart('\')
  $target = Join-Path $Dest $rel
  if (-not (Test-Path -LiteralPath $target)) { $changed += "+ $rel"; continue }
  $a = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash
  $b = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  if ($a -ne $b) { $changed += "~ $rel" }
}
Write-Host "==> $($changed.Count) file(s) would change" -ForegroundColor Cyan
$changed | Select-Object -First 40 | ForEach-Object { Write-Host "    $_" }
if ($changed.Count -gt 40) { Write-Host "    ... and $($changed.Count - 40) more" }
if ($DryRun) { Write-Host "`n(dry run: nothing was written)"; exit 0 }

# ---- back up, then copy ------------------------------------------------------------------------
$skillsRoot = Split-Path -Parent $Dest
$backupRoot = Join-Path $skillsRoot ".backup"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$backup = Join-Path $backupRoot ("dsh-cinema-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
Write-Host "==> backup: $backup" -ForegroundColor Cyan
Copy-Item -LiteralPath $Dest -Destination $backup -Recurse -Force

$excludeDirs = @("node_modules", "out", ".git")
$robocopyArgs = @($Source, $Dest, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/XD") + $excludeDirs + @("/XF", "package-lock.json")
robocopy @robocopyArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

Push-Location $Dest
try { node scripts/render-check.mjs; node scripts/preflight.mjs --skill } finally { Pop-Location }
Write-Host "`n==> updated to $Dest (backup: $backup)" -ForegroundColor Green
