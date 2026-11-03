# scripts/publish.ps1 — create the GitHub repository and push the first release.
#
#   $env:GITHUB_TOKEN = "ghp_..."            # a token with "repo" scope (classic) or Contents+Administration (fine-grained)
#   pwsh -File scripts/publish.ps1           # creates LKMT-CNSZ/dsh-cinema if absent, then pushes main and the tags
#   pwsh -File scripts/publish.ps1 -DryRun   # shows what would happen, changes nothing
#
# The script is idempotent: if the repository already exists it is left alone (nothing is overwritten), and nothing is
# force-pushed.
[CmdletBinding()]
param(
  [string]$Org = "LKMT-CNSZ",
  [string]$Repo = "dsh-cinema",
  [string]$Token = $env:GITHUB_TOKEN,
  [string]$Description = "DSH Cinema - a DSH skill for making 2.5D documentary art films with code: plates in a metric world, procedural materials, a measurable complexity budget, and a P0/P1/P2 render sweep.",
  [switch]$Private,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Push-Location $Root
try {
  if (-not (Test-Path ".git")) { throw "not a git repository: $Root" }
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($branch -ne "main") { throw "current branch is '$branch'; publish from main" }
  Write-Host "==> repo: $Root (branch $branch)" -ForegroundColor Cyan

  if (-not $Token -and -not $DryRun) {
    throw "no token. Set `$env:GITHUB_TOKEN to a token with repo scope, or pass -Token.`n    Create one at https://github.com/settings/tokens (classic, 'repo') or a fine-grained token with Contents: read/write and Administration: read/write on the organisation."
  }

  $api = "https://api.github.com"
  $headers = @{ "User-Agent" = "dsh-cinema-publish"; "Accept" = "application/vnd.github+json" }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }

  # ---- does the repository exist? --------------------------------------------------------------
  $exists = $false
  if (-not $DryRun) {
    try {
      $r = Invoke-WebRequest -Uri "$api/repos/$Org/$Repo" -Headers $headers -UseBasicParsing -TimeoutSec 20
      $exists = ($r.StatusCode -eq 200)
    } catch {
      $code = $_.Exception.Response.StatusCode.value__
      if ($code -eq 404) { $exists = $false }
      else { throw "cannot check $Org/$Repo (HTTP $code). Is the token valid and does it see the organisation?" }
    }
  }
  Write-Host "==> repository $Org/$Repo exists: $exists" -ForegroundColor Cyan

  # ---- create it (the organisation first, then the user account) --------------------------------
  if (-not $exists) {
    $endpoints = @("orgs/$Org/repos", "user/repos")
    foreach ($ep in $endpoints) {
      if ($DryRun) {
        Write-Host "    would POST $api/$ep with name=$Repo private=$([bool]$Private)"
        continue
      }
      $body = @{ name = $Repo; description = $Description; private = [bool]$Private; has_issues = $true; has_wiki = $false; auto_init = $false } | ConvertTo-Json
      try {
        Invoke-WebRequest -Uri "$api/$ep" -Method Post -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30 | Out-Null
        Write-Host "    created $Org/$Repo (via $ep)" -ForegroundColor Green
        $exists = $true
        break
      } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "    $ep failed (HTTP $code) - will try the next option" -ForegroundColor Yellow
      }
    }
    if (-not $exists -and -not $DryRun) { throw "could not create the repository - check that the token may create repos in $Org" }
  }

  # ---- remote ---------------------------------------------------------------------------------
  $remoteUrl = "https://github.com/$Org/$Repo.git"
  $authUrl = if ($Token) { "https://x-access-token:$Token@github.com/$Org/$Repo.git" } else { $remoteUrl }
  $remotes = @(git remote)
  if ($remotes -notcontains "origin") {
    if ($DryRun) { Write-Host "    would add remote origin $remoteUrl" }
    else { git remote add origin $authUrl; Write-Host "    added remote origin" -ForegroundColor Green }
  } else {
    Write-Host "    origin exists: $(git remote get-url origin)" -ForegroundColor Cyan
  }

  if ($DryRun) {
    Write-Host "`n(dry run) would run: git push -u origin main; git push origin --tags" -ForegroundColor Yellow
    return
  }

  git push -u origin main
  if ($LASTEXITCODE -ne 0) { throw "push failed (auth or branch protection)" }
  git push origin --tags
  if ($LASTEXITCODE -ne 0) { throw "tag push failed" }
  Write-Host "`n==> published: https://github.com/$Org/$Repo" -ForegroundColor Green
  Write-Host "    next: create a release for v1.0.0 and attach the rendered film as an asset" -ForegroundColor Cyan
} finally { Pop-Location }
