# scripts/install.ps1 — install DSH Cinema into the DSH user skills directory.
#
#   pwsh -File scripts/install.ps1                      # install from this checkout into ~/.dsh/skills/dsh-cinema
#   pwsh -File scripts/install.ps1 -Force               # replace an existing install (it is backed up first)
#   pwsh -File scripts/install.ps1 -Repo                # git clone the public repository instead of copying this tree
#   pwsh -File scripts/install.ps1 -Dest D:\skills      # install somewhere else (must be on the DSH skill path)
#
# Safety: it only writes inside the destination directory, it backs up an existing install before replacing it, and it
# refuses to overwrite anything without -Force.
[CmdletBinding()]
param(
  [string]$Source = "",
  [string]$Repo = "https://github.com/LKMT-CNSZ/dsh-cinema.git",
  [string]$Ref = "main",
  [string]$Dest = "",
  [switch]$Force,
  [switch]$SkipCheck
)

$ErrorActionPreference = "Stop"
$skillName = "dsh-cinema"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "    ok   $msg" -ForegroundColor Green }
function Write-Warn2($msg) { Write-Host "    note $msg" -ForegroundColor Yellow }

# ---- 1. where does the skill go ----------------------------------------------------------------
if (-not $Dest) {
  $dshHome = $env:DSH_HOME
  if (-not $dshHome) { $dshHome = Join-Path $HOME ".dsh" }
  $Dest = Join-Path $dshHome (Join-Path "skills" $skillName)
}
$Dest = [IO.Path]::GetFullPath($Dest)
Write-Step "destination: $Dest"

# ---- 2. where does the source come from --------------------------------------------------------
$cloneDir = $null
if (-not $Source) {
  $repoRoot = Split-Path -Parent $PSScriptRoot
  if (Test-Path (Join-Path $repoRoot "SKILL.md")) {
    $Source = $repoRoot
  } else {
    Write-Step "no local checkout next to this script; cloning $Repo"
    $cloneDir = Join-Path ([IO.Path]::GetTempPath()) ("dsh-cinema-" + [Guid]::NewGuid().ToString("n").Substring(0, 8))
    git clone --depth 1 --branch $Ref $Repo $cloneDir
    if ($LASTEXITCODE -ne 0) { throw "git clone failed: $Repo ($Ref)" }
    $Source = $cloneDir
  }
}
$Source = [IO.Path]::GetFullPath($Source)
if (-not (Test-Path (Join-Path $Source "SKILL.md"))) { throw "source has no SKILL.md: $Source" }
Write-Step "source: $Source"

# ---- 3. existing install: back it up, never silently overwrite ---------------------------------
$backup = $null
if (Test-Path $Dest) {
  if (-not $Force) {
    throw "destination already exists: $Dest`n    Re-run with -Force to replace it (the current install is backed up).`n    Or use scripts/update.ps1 to copy a new version over it."
  }
  $skillsRoot = Split-Path -Parent $Dest
  $backupRoot = Join-Path $skillsRoot ".backup"
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  $backup = Join-Path $backupRoot ($skillName + "-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  Write-Step "backing up the existing install to $backup"
  Copy-Item -LiteralPath $Dest -Destination $backup -Recurse -Force
  Write-Ok "backup: $backup"
}

# ---- 4. copy the tree --------------------------------------------------------------------------
Write-Step "installing files"
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$excludeDirs = @("node_modules", "out", ".git")
$robocopyArgs = @($Source, $Dest, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/XD") + $excludeDirs + @("/XF", "package-lock.json", ".DS_Store")
robocopy @robocopyArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }
$files = Get-ChildItem $Dest -Recurse -File
Write-Ok ("{0} files, {1:N1} MB" -f $files.Count, (($files | Measure-Object -Property Length -Sum).Sum / 1MB))

# ---- 5. strip UTF-8 BOMs (a BOM silently drops the skill from the DSH catalog) -----------------
$bomFixed = 0
foreach ($f in Get-ChildItem $Dest -Recurse -File -Include *.md, *.js, *.mjs, *.json, *.html) {
  $bytes = [IO.File]::ReadAllBytes($f.FullName)
  if ($bytes.Length -gt 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    [IO.File]::WriteAllBytes($f.FullName, $bytes[3..($bytes.Length - 1)])
    $bomFixed++
  }
}
Write-Ok "BOM-free ($bomFixed file(s) fixed)"

# ---- 6. verify the skill will actually load ----------------------------------------------------
if (-not $SkipCheck) {
  Write-Step "verifying the install"
  Push-Location $Dest
  try {
    node scripts/render-check.mjs
    if ($LASTEXITCODE -ne 0) { throw "render-check failed - the skill may not load, see the output above" }
    node scripts/preflight.mjs --skill
    if ($LASTEXITCODE -ne 0) { Write-Warn2 "preflight reported problems (often just a missing node_modules in template/, which a scaffolded project installs)" }
  } finally { Pop-Location }
}

# ---- 7. tell the user what to do next ----------------------------------------------------------
Write-Step "installed"
Write-Host "    skill : $Dest"
Write-Host "    invoke: /dsh-cinema   (or pick it from the / menu in DSH)"
Write-Host "    verify: node `"$Dest\scripts\preflight.mjs`" --skill"
if ($backup) { Write-Host "    backup: $backup" }
if ($cloneDir) { Remove-Item $cloneDir -Recurse -Force -ErrorAction SilentlyContinue }
