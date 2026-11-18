$ErrorActionPreference = 'Stop'
$tools = Join-Path $PSScriptRoot '../.atlas/tools'
New-Item -ItemType Directory -Path $tools -Force | Out-Null
$hashes = @{
  ffmpeg = '04E1307997530F9CF2FE35CBA2CA7E8875CA91DA02F89D6C7243DF819C94AD00'
  ffprobe = '3A7E2DC003DC2CD1472827E4C7C4F056AE1AE0AE7C5BBC580C99B49827351BA4'
}
foreach ($tool in @('ffmpeg', 'ffprobe')) {
  $target = Join-Path $tools "$tool.exe"
  if (!(Test-Path -LiteralPath $target) -or (Get-FileHash -LiteralPath $target).Hash -ne $hashes[$tool]) {
    Invoke-WebRequest "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/$tool-win32-x64" -OutFile $target
    if ((Get-FileHash -LiteralPath $target).Hash -ne $hashes[$tool]) { throw "$tool checksum mismatch." }
  }
}
Invoke-WebRequest 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/win32-x64.LICENSE' -OutFile (Join-Path $tools 'FFmpeg-LICENSE')
Write-Output 'Portable FFmpeg tools are ready in .atlas/tools (Windows x64, including ARM64 via emulation).'
