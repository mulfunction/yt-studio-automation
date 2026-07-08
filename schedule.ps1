# schedule.ps1
# This script sets up a Windows Scheduled Task to run the daily YouTube download.

$taskName = "YouTube-Studio-CSV-Downloader"
$scriptDir = $PSScriptRoot
$nodePath = (Get-Command node).Source

if (-not $nodePath) {
    Write-Host "Node.js not found in PATH. Please ensure Node is installed." -ForegroundColor Red
    exit
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "download-csv.js" -WorkingDirectory $scriptDir

# Triggers daily at 9:00 AM (change as needed)
$trigger = New-ScheduledTaskTrigger -Daily -At 12:00PM

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Downloads YouTube Studio Views by Content CSV daily"

Write-Host "✅ Scheduled Task '$taskName' successfully registered." -ForegroundColor Green
Write-Host "It will run daily at 9:00 AM. You can modify the time in the Windows Task Scheduler app." -ForegroundColor Cyan
