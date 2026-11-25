Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
foreach ($v in $synth.GetInstalledVoices()) {
    if ($v.VoiceInfo.Gender -eq 'Female' -and $v.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'es') {
        $synth.SelectVoice($v.VoiceInfo.Name)
        break
    }
}
$synth.Speak("listo, ya termine")
