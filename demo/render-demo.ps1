param([string]$DemoDirectory = $PSScriptRoot)

$ErrorActionPreference = 'Stop'
$outputDirectory = Join-Path $DemoDirectory 'output'
$framesDirectory = Join-Path $outputDirectory 'frames'
$audioDirectory = Join-Path $outputDirectory 'audio'
$segmentsDirectory = Join-Path $outputDirectory 'segments'
New-Item -ItemType Directory -Force -Path $segmentsDirectory | Out-Null
Push-Location (Split-Path $DemoDirectory -Parent)

node (Join-Path $DemoDirectory 'render-frames.mjs')
& $PSScriptRoot\synthesize-voice.ps1 -DemoDirectory $DemoDirectory
$timing = Get-Content (Join-Path $outputDirectory 'timing.json') -Raw | ConvertFrom-Json
$concat = @()
foreach ($entry in $timing) {
  $segment = Join-Path $segmentsDirectory ("scene-{0}.mp4" -f $entry.id)
  $fadeOutStart = [Math]::Max(0, $entry.segmentDuration - 0.35)
  ffmpeg -y -loop 1 -framerate 30 -i (Join-Path $framesDirectory ("scene-{0}.png" -f $entry.id)) -i (Join-Path $audioDirectory ("scene-{0}.wav" -f $entry.id)) -filter:v "fade=t=in:st=0:d=0.35,fade=t=out:st=$fadeOutStart`:d=0.35,format=yuv420p" -c:v libx264 -crf 20 -preset medium -t $entry.segmentDuration -af apad=pad_dur=5 -c:a aac -b:a 192k -ar 48000 $segment
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed rendering scene $($entry.id)." }
  $concat += "file '$($segment.Replace('\','/'))'"
}
$concatPath = Join-Path $outputDirectory 'concat.txt'
[System.IO.File]::WriteAllLines($concatPath, $concat, [System.Text.UTF8Encoding]::new($false))
$videoOnly = Join-Path $outputDirectory 'video-only.mp4'
ffmpeg -y -f concat -safe 0 -i $concatPath -c copy $videoOnly
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg failed concatenating scenes.' }
$total = [Math]::Round((($timing | Measure-Object -Property segmentDuration -Sum).Sum), 3)
$ambient = Join-Path $outputDirectory 'ambient.wav'
ffmpeg -y -f lavfi -i "aevalsrc=0.012*sin(2*PI*110*t)+0.006*sin(2*PI*165*t):s=48000:d=$total" -af "lowpass=f=600,volume=0.55" -c:a pcm_s16le $ambient
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg failed generating ambient bed.' }
$final = Join-Path $outputDirectory 'fiakto-devpost-demo.mp4'
$subtitleFilter = "subtitles=demo/output/subtitles.srt:force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF,BackColour=&H90000000,BorderStyle=4,Outline=2,Shadow=0,Alignment=2,MarginV=52'"
ffmpeg -y -i $videoOnly -i $ambient -filter_complex "[0:a][1:a]amix=inputs=2:duration=first:weights='1 0.22'[audio]" -vf $subtitleFilter -map 0:v -map "[audio]" -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart $final
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg failed composing final video.' }
ffmpeg -y -ss 1 -i $final -frames:v 1 -q:v 2 (Join-Path $outputDirectory 'fiakto-thumbnail.jpg')
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg failed extracting thumbnail.' }
Pop-Location
Write-Output "Rendered final video: $final"
