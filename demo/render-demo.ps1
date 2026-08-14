param([string]$DemoDirectory = $PSScriptRoot)

$ErrorActionPreference = 'Stop'
$outputDirectory = Join-Path $DemoDirectory 'output'
$framesDirectory = Join-Path $outputDirectory 'frames'
$audioDirectory = Join-Path $outputDirectory 'audio'
$segmentsDirectory = Join-Path $outputDirectory 'segments'
$assetsDirectory = Join-Path $DemoDirectory 'assets'
$backgroundMusic = Join-Path $assetsDirectory 'background-music.mp3'
New-Item -ItemType Directory -Force -Path $segmentsDirectory | Out-Null
Push-Location (Split-Path $DemoDirectory -Parent)

node (Join-Path $DemoDirectory 'render-frames.mjs')
& $PSScriptRoot\synthesize-voice.ps1 -DemoDirectory $DemoDirectory
$timing = Get-Content (Join-Path $outputDirectory 'timing.json') -Raw | ConvertFrom-Json
$concat = @()
foreach ($entry in $timing) {
  $segment = Join-Path $segmentsDirectory ("scene-{0}.mp4" -f $entry.id)
  $fadeOutStart = [Math]::Max(0, $entry.segmentDuration - 0.35)
  # Ken Burns sutil (zoom lento + paneo leve, alternando direccion por
  # escena) para que no sea una foto fija toda la escena — antes no habia
  # ningun movimiento, solo el fade in/out.
  $panDirection = if ($entry.id % 2 -eq 0) { 1 } else { -1 }
  $zoomExpr = "min(zoom+0.0006,1.07)"
  $xExpr = "iw/2-(iw/zoom/2)+$panDirection*min(on/8\,70)"
  $kenBurns = "scale=3840:-2,zoompan=z='$zoomExpr':d=1:x='$xExpr':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30"
  ffmpeg -y -loop 1 -framerate 30 -i (Join-Path $framesDirectory ("scene-{0}.png" -f $entry.id)) -i (Join-Path $audioDirectory ("scene-{0}.wav" -f $entry.id)) -filter:v "$kenBurns,fade=t=in:st=0:d=0.35,fade=t=out:st=$fadeOutStart`:d=0.35,format=yuv420p" -c:v libx264 -crf 20 -preset medium -t $entry.segmentDuration -af apad=pad_dur=0.6 -c:a aac -b:a 192k -ar 48000 $segment
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed rendering scene $($entry.id)." }
  $concat += "file '$($segment.Replace('\','/'))'"
}
$concatPath = Join-Path $outputDirectory 'concat.txt'
[System.IO.File]::WriteAllLines($concatPath, $concat, [System.Text.UTF8Encoding]::new($false))
$videoOnly = Join-Path $outputDirectory 'video-only.mp4'
ffmpeg -y -f concat -safe 0 -i $concatPath -c copy $videoOnly
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg failed concatenating scenes.' }
$total = [Math]::Round((($timing | Measure-Object -Property segmentDuration -Sum).Sum), 3)
if (-not (Test-Path $backgroundMusic)) {
  throw "Background music file not found: $backgroundMusic"
}
$musicFadeStart = [Math]::Max(0, $total - 3.0)
$final = Join-Path $outputDirectory 'fiakto-devpost-demo.mp4'
ffmpeg -y -i $videoOnly -stream_loop -1 -i $backgroundMusic -filter_complex "[0:a]volume=1.0[narration];[1:a]atrim=0:$total,asetpts=N/SR/TB,volume=0.35,afade=t=out:st=$musicFadeStart`:d=3.0[music];[narration][music]amix=inputs=2:duration=first:normalize=0:dropout_transition=0[audio]" -map 0:v -map "[audio]" -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart $final
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg failed composing final video.' }
ffmpeg -y -ss 1 -i $final -frames:v 1 -q:v 2 (Join-Path $outputDirectory 'fiakto-thumbnail.jpg')
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg failed extracting thumbnail.' }
Pop-Location
Write-Output "Rendered final video: $final"
