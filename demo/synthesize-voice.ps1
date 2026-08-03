param([string]$DemoDirectory = $PSScriptRoot)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$outputDirectory = Join-Path $DemoDirectory 'output'
$audioDirectory = Join-Path $outputDirectory 'audio'
New-Item -ItemType Directory -Force -Path $audioDirectory | Out-Null
$narration = Get-Content (Join-Path $DemoDirectory 'narration.json') -Raw | ConvertFrom-Json
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$englishVoice = $voice.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'en-*' } | Select-Object -First 1
if (-not $englishVoice) { throw 'No installed English System.Speech voice is available.' }
$voice.SelectVoice($englishVoice.VoiceInfo.Name)
$voice.Rate = -1
$voice.Volume = 100

function Convert-ToSsml([string]$Text) {
  $escaped = [System.Security.SecurityElement]::Escape($Text)
  $withPauses = $escaped -replace '([.!?])\s+', '$1<break time="350ms" /> '
  "<speak version=`"1.0`" xml:lang=`"en-US`">$withPauses</speak>"
}
function Format-SrtTime([double]$Seconds) { [TimeSpan]::FromSeconds($Seconds).ToString('hh\:mm\:ss\,fff') }

$timing = @(); $cursor = 0.0
foreach ($scene in $narration.scenes) {
  $wav = Join-Path $audioDirectory ("scene-{0}.wav" -f $scene.id)
  $voice.SetOutputToWaveFile($wav)
  $voice.SpeakSsml((Convert-ToSsml $scene.text))
  $voice.SetOutputToNull()
  $duration = [Math]::Round(([System.IO.FileInfo]::new($wav).Length - 44) / 96000, 3)
  $start = $cursor; $end = [Math]::Round($start + $duration + 0.6, 3)
  $timing += [PSCustomObject]@{ id = $scene.id; start = $start; end = $end; narrationDuration = $duration; segmentDuration = [Math]::Round($duration + 0.6, 3); text = $scene.text }
  $cursor = $end
}
$voice.Dispose()
$timing | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $outputDirectory 'timing.json')
$cues = foreach ($entry in $timing) { "{0}`r`n{1} --> {2}`r`n{3}`r`n" -f $entry.id, (Format-SrtTime $entry.start), (Format-SrtTime $entry.end), $entry.text }
[System.IO.File]::WriteAllText((Join-Path $outputDirectory 'subtitles.srt'), ($cues -join "`r`n"), [System.Text.UTF8Encoding]::new($false))
Write-Output ("Synthesized {0} scenes with {1}. Total timed duration: {2:N2} seconds." -f $timing.Count, $englishVoice.VoiceInfo.Name, $cursor)
