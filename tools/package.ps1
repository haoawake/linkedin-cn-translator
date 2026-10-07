$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root 'dist'
$Stage = Join-Path ([System.IO.Path]::GetTempPath()) ('linkedin-cn-translator-' + [guid]::NewGuid())
$App = Join-Path $Stage 'linkedin-cn-translator'
New-Item -ItemType Directory -Force -Path $Out, $App | Out-Null
try {
  'manifest.json','background.js','content.js','content.css','popup.html','popup.css','popup.js' | ForEach-Object {
    Copy-Item (Join-Path $Root $_) $App
  }
  Copy-Item (Join-Path $Root 'assets') $App -Recurse
  Copy-Item (Join-Path $Root 'README.zh-CN.md') (Join-Path $App 'README.md')
  $Zip = Join-Path $Out 'linkedin-cn-translator.zip'
  if (Test-Path $Zip) { Remove-Item $Zip -Force }
  Compress-Archive -Path $App -DestinationPath $Zip -CompressionLevel Optimal
  Write-Host "Created: $Zip"
} finally {
  Remove-Item $Stage -Recurse -Force -ErrorAction SilentlyContinue
}
