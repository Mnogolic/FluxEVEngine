param(
    [string]$TaskName = "FluxEVEngine DB Update",
    [string]$Project = "C:\Users\kasja\VsCodeSSD\FluxEVEngine",
    [string]$MorningTime = "07:00",
    [string]$EveningTime = "18:00"
)

$ErrorActionPreference = "Stop"

$UpdateScript = Join-Path $Project "automation\scheduled_db_update.ps1"

if (-not (Test-Path $UpdateScript)) {
    throw "Update script not found: $UpdateScript"
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$UpdateScript`""

$triggers = @(
    (New-ScheduledTaskTrigger -Daily -At $MorningTime);
    (New-ScheduledTaskTrigger -Daily -At $EveningTime)
)

$settings = New-ScheduledTaskSettingsSet `
    -WakeToRun `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 3) `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

$task = New-ScheduledTask `
    -Action $action `
    -Trigger $triggers `
    -Settings $settings `
    -Principal $principal `
    -Description "Wake PC, update FluxEVEngine market history from ESI, and sleep again if user is idle."

Register-ScheduledTask `
    -TaskName $TaskName `
    -InputObject $task `
    -Force | Out-Null

Write-Host "Registered scheduled task: $TaskName"
Write-Host "Triggers: $MorningTime and $EveningTime daily"
Write-Host "WakeToRun: enabled"
Write-Host "Script: $UpdateScript"
