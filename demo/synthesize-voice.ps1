param([string]$DemoDirectory = $PSScriptRoot, [string]$VoiceName = 'en-US-AvaNeural')

$ErrorActionPreference = 'Stop'
$outputDirectory = Join-Path $DemoDirectory 'output'
$audioDirectory = Join-Path $outputDirectory 'audio'
New-Item -ItemType Directory -Force -Path $audioDirectory | Out-Null
$narration = Get-Content (Join-Path $DemoDirectory 'narration.json') -Raw | ConvertFrom-Json

# Voz neuronal online de Microsoft Edge (edge-tts, via pip) — es lo que
# aparentemente uso Codex para el video de referencia que le gusto al
# usuario; suena mucho mas humana que Windows SAPI o Google Cloud TTS
# estandar. Requiere el paquete "edge-tts" instalado (pip) y conexion a
# internet (llama al backend de Microsoft Edge).
function Format-SrtTime([double]$Seconds) { [TimeSpan]::FromSeconds($Seconds).ToString('hh\:mm\:ss\,fff') }
function Get-AudioDurationSeconds([string]$Path) {
  $probe = & ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $Path
  [double]$probe
}
# Subtitulos cortos (1-2 lineas) en vez de todo el parlamento de la escena
# de una — con el texto completo de una vez tapaba media pantalla.
function Split-IntoCaptionChunks([string]$Text, [int]$MaxChars = 70) {
  $chunks = @()
  foreach ($sentence in [regex]::Split($Text, '(?<=[.!?])\s+')) {
    if ([string]::IsNullOrWhiteSpace($sentence)) { continue }
    if ($sentence.Length -le $MaxChars) { $chunks += $sentence.Trim(); continue }
    $current = ''
    foreach ($word in ($sentence -split '\s+')) {
      $candidate = if ($current) { "$current $word" } else { $word }
      if ($candidate.Length -gt $MaxChars -and $current) { $chunks += $current; $current = $word }
      else { $current = $candidate }
    }
    if ($current) { $chunks += $current }
  }
  $chunks
}

$timing = @(); $cursor = 0.0
foreach ($scene in $narration.scenes) {
  $textFile = Join-Path $audioDirectory ("scene-{0}.txt" -f $scene.id)
  $mp3 = Join-Path $audioDirectory ("scene-{0}.mp3" -f $scene.id)
  $wav = Join-Path $audioDirectory ("scene-{0}.wav" -f $scene.id)
  [System.IO.File]::WriteAllText($textFile, $scene.text, [System.Text.UTF8Encoding]::new($false))

  python -m edge_tts -f $textFile -v $VoiceName --write-media $mp3 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "edge-tts failed for scene $($scene.id)." }
  ffmpeg -y -i $mp3 -ar 48000 -ac 1 $wav | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed converting scene $($scene.id) audio to wav." }

  $duration = [Math]::Round((Get-AudioDurationSeconds $wav), 3)
  $start = $cursor; $end = [Math]::Round($start + $duration + 0.6, 3)
  $timing += [PSCustomObject]@{ id = $scene.id; start = $start; end = $end; narrationDuration = $duration; segmentDuration = [Math]::Round($duration + 0.6, 3); text = $scene.text }
  $cursor = $end
}
$timing | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $outputDirectory 'timing.json')
$cueIndex = 1
$cues = foreach ($entry in $timing) {
  $chunks = Split-IntoCaptionChunks $entry.text
  $totalChars = ($chunks | ForEach-Object { $_.Length } | Measure-Object -Sum).Sum
  $chunkCursor = $entry.start
  foreach ($chunk in $chunks) {
    $chunkDuration = $entry.narrationDuration * ($chunk.Length / $totalChars)
    $chunkEnd = [Math]::Min($entry.start + $entry.narrationDuration, $chunkCursor + $chunkDuration)
    "{0}`r`n{1} --> {2}`r`n{3}`r`n" -f $cueIndex, (Format-SrtTime $chunkCursor), (Format-SrtTime $chunkEnd), $chunk
    $cueIndex++
    $chunkCursor = $chunkEnd
  }
}
[System.IO.File]::WriteAllText((Join-Path $outputDirectory 'subtitles.srt'), ($cues -join "`r`n"), [System.Text.UTF8Encoding]::new($true))
Write-Output ("Synthesized {0} scenes with edge-tts ({1}). Total duration: {2:N2} seconds." -f $timing.Count, $VoiceName, $cursor)
