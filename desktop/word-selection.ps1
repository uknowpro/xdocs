# Windows PowerShell 5.1, interactive Microsoft Word.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$utf8 = New-Object System.Text.UTF8Encoding($false)
$id = [guid]::NewGuid().ToString()
$request = Join-Path $PSScriptRoot "$id.xdocs-word.json"
$reply = Join-Path $PSScriptRoot "$id.reply.json"
$ready = Join-Path $PSScriptRoot "$id.ready"
try {
    $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application')
    $doc = $word.ActiveDocument
    $windowHandle = $word.ActiveWindow.Hwnd
    $selection = $word.Selection.Range.Duplicate
    $original = [string]$selection.Text
    if ($selection.StoryType -ne 1 -or !$original.Trim() -or $original.Length -gt 50000 -or $original -match '[\x00-\x08\x0e-\x1f]') {
        throw 'Select up to 50,000 characters of ordinary document body text in Word first.'
    }
    $start = $selection.Start
    $end = $selection.End
    $expires = [DateTimeOffset]::UtcNow.AddMinutes(30)
    $packet = @{version=1; id=$id; name=$doc.Name; text=$original; expires=$expires.ToUnixTimeMilliseconds()}
    [IO.File]::WriteAllText("$request.tmp", ($packet | ConvertTo-Json -Compress), $utf8)
    [IO.File]::Move("$request.tmp", $request)
    Write-Host "In xdocs, open Word and import $request. Waiting for your edit for 30 minutes. Ctrl+C cancels."
    while (!(Test-Path -LiteralPath $ready)) {
        if ([DateTimeOffset]::UtcNow -ge $expires) { throw 'Selection expired. Capture it again.' }
        Start-Sleep -Milliseconds 400
    }
    if ((Get-Item -LiteralPath $reply).Length -gt 400000) { throw 'Replacement is too large.' }
    $edit = [IO.File]::ReadAllText($reply, $utf8) | ConvertFrom-Json
    if ($edit.id -cne $id -or $edit.text -isnot [string] -or !$edit.text.Trim() -or $edit.text.Length -gt 50000 -or $edit.text -match '[\x00-\x08\x0e-\x1f]') {
        throw 'Invalid replacement.'
    }
    $preview = $edit.text.Substring(0,[Math]::Min(800,$edit.text.Length))
    $prompt = "Replace the selected text in " + $doc.Name + "? (" + $edit.text.Length + " characters)" + [Environment]::NewLine + [Environment]::NewLine + $preview
    if ([Windows.Forms.MessageBox]::Show($prompt,'xdocs Word','YesNo','Question','Button2') -ne 'Yes') { return }
    if ([DateTimeOffset]::UtcNow -ge $expires) { throw 'Selection expired. Capture it again.' }
    $now = $word.Selection.Range
    if ($word.ActiveWindow.Hwnd -ne $windowHandle -or ![object]::ReferenceEquals($doc,$word.ActiveDocument) -or $now.StoryType -ne 1 -or $now.Start -ne $start -or $now.End -ne $end -or $now.Text -cne $original -or $doc.ReadOnly -or $doc.ProtectionType -ne -1) {
        throw 'Word document or selection changed, or is protected. Capture the selection again.'
    }
    $text = $edit.text -replace "\r\n|\n",([string][char]13)
    if ($original.EndsWith([string][char]13)) {
        $now.End = $now.End - 1
        if ($text.EndsWith([string][char]13)) { $text = $text.Substring(0,$text.Length-1) }
    }
    $now.Text = $text
    Write-Host 'Applied in Word. Review the change and save in Word when ready.'
} catch {
    [void][Windows.Forms.MessageBox]::Show($_.Exception.Message,'xdocs Word')
} finally {
    foreach ($file in @($request,"$request.tmp",$reply,$ready)) {
        if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
    }
}
