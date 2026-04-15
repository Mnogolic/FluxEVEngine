# FluxEVEngine scheduled database update

This folder contains Windows automation for updating market history twice a day.

## What it does

- Wakes the computer via Windows Task Scheduler.
- Starts PostgreSQL if needed.
- Runs:

```powershell
.venv\Scripts\python.exe -m scripts.fetch_history --incremental --concurrency 15
```

- Writes logs to:

```text
logs\scheduled_db_update.log
```

- Waits 60 seconds after the update.
- Puts the computer back to sleep only if the user has been idle for at least 15 minutes.

## Test manually without sleeping

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\automation\scheduled_db_update.ps1 -NoSleep
```

Fast smoke test without ESI writes:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\automation\scheduled_db_update.ps1 -NoSleep -DryRun -MaxPairs 10
```

## Register the scheduled task

Run PowerShell as Administrator from the project root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\automation\register_scheduled_db_update.ps1
```

The task name is:

```text
FluxEVEngine DB Update
```

It runs daily at 07:00 and 18:00.

## Required Windows setting

Enable wake timers:

```text
Control Panel -> Power Options -> Change plan settings -> Advanced power settings -> Sleep -> Allow wake timers -> Enable
```

## Useful commands

Run the task manually:

```powershell
Start-ScheduledTask -TaskName "FluxEVEngine DB Update"
```

Check task info:

```powershell
Get-ScheduledTask -TaskName "FluxEVEngine DB Update"
Get-ScheduledTaskInfo -TaskName "FluxEVEngine DB Update"
```

Remove the task:

```powershell
Unregister-ScheduledTask -TaskName "FluxEVEngine DB Update" -Confirm:$false
```
