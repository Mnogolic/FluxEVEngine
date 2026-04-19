param(
    [int]$IdleThresholdMinutes = 15,
    [int]$SleepCheckDelaySeconds = 60,
    [int]$Concurrency = 15,
    [int]$FetchTimeoutMinutes = 30,
    [int]$MaxPairs = 0,
    [switch]$DryRun,
    [switch]$NoSleep
)

$ErrorActionPreference = "Stop"

$Project = "C:\Users\kasja\VsCodeSSD\FluxEVEngine"
$Python = Join-Path $Project ".venv\Scripts\python.exe"
$PgCtl = "H:\PostSQl\bin\pg_ctl.exe"
$PgIsReady = "H:\PostSQl\bin\pg_isready.exe"
$PgData = "H:\PostSQl\data"
$LogDir = Join-Path $Project "logs"
$Log = Join-Path $LogDir "scheduled_db_update.log"
$LockFile = Join-Path $LogDir "scheduled_db_update.lock"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log {
    param([string]$Message)
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" | Out-File $Log -Append -Encoding utf8
}

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class UserIdle {
    [StructLayout(LayoutKind.Sequential)]
    struct LASTINPUTINFO {
        public uint cbSize;
        public uint dwTime;
    }

    [DllImport("user32.dll")]
    static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    public static uint GetIdleMilliseconds() {
        LASTINPUTINFO lii = new LASTINPUTINFO();
        lii.cbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf(typeof(LASTINPUTINFO));
        GetLastInputInfo(ref lii);
        return ((uint)Environment.TickCount - lii.dwTime);
    }
}
"@

Add-Type @"
using System.Runtime.InteropServices;

public static class PowerState {
    [DllImport("powrprof.dll", SetLastError = true)]
    public static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);
}
"@

function Get-IdleMinutes {
    return [math]::Floor([UserIdle]::GetIdleMilliseconds() / 60000)
}

function Invoke-LoggedProcess {
    param(
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory = $Project,
        [int]$TimeoutSeconds = 0
    )
    function Join-ProcessArguments {
        param([string[]]$ArgsToJoin)
        $quoted = foreach ($arg in $ArgsToJoin) {
            if ($arg -match '[\s"]') {
                '"' + ($arg -replace '"', '\"') + '"'
            } else {
                $arg
            }
        }
        return ($quoted -join " ")
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $psi.Arguments = Join-ProcessArguments -ArgsToJoin $ArgumentList
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    try {
        [void]$process.Start()
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()

        if ($TimeoutSeconds -gt 0) {
            if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
                try { $process.Kill($true) } catch {}
                throw "Process timed out after $TimeoutSeconds seconds: $FilePath"
            }
        } else {
            $process.WaitForExit()
        }

        $process.WaitForExit()

        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()

        if ($stdout) { $stdout.TrimEnd() | Out-File $Log -Append -Encoding utf8 }
        if ($stderr) { $stderr.TrimEnd() | Out-File $Log -Append -Encoding utf8 }

        return $process.ExitCode
    } finally {
        $process.Dispose()
    }
}

function Test-PostgresReady {
    $exitCode = Invoke-LoggedProcess `
        -FilePath $PgIsReady `
        -ArgumentList @("-h", "127.0.0.1", "-p", "5432", "-d", "fluxev", "-U", "fluxev") `
        -TimeoutSeconds 10
    return $exitCode -eq 0
}

function Start-PostgresIfNeeded {
    Write-Log "Checking PostgreSQL readiness..."
    if (Test-PostgresReady) {
        Write-Log "PostgreSQL is already accepting connections."
        return
    }

    Write-Log "PostgreSQL is not ready. Starting..."
    [void](Invoke-LoggedProcess -FilePath $PgCtl -ArgumentList @("start", "-D", $PgData) -TimeoutSeconds 90)

    for ($i = 1; $i -le 12; $i++) {
        if (Test-PostgresReady) {
            Write-Log "PostgreSQL is accepting connections."
            return
        }
        Write-Log "PostgreSQL is not ready yet, waiting... ($i/12)"
        Start-Sleep -Seconds 5
    }

    throw "PostgreSQL did not become ready in time."
}

function Enter-SleepIfIdle {
    if ($NoSleep) {
        Write-Log "NoSleep flag is set. Leaving computer awake."
        return
    }

    Write-Log "Waiting $SleepCheckDelaySeconds seconds before sleep check..."
    Start-Sleep -Seconds $SleepCheckDelaySeconds

    $idleMinutes = Get-IdleMinutes
    if ($idleMinutes -ge $IdleThresholdMinutes) {
        Write-Log "User idle for $idleMinutes minutes. Going to sleep."
        [void][PowerState]::SetSuspendState($false, $false, $false)
    } else {
        Write-Log "User active, idle only $idleMinutes minutes. Not sleeping."
    }
}

function Get-LockPid {
    if (-not (Test-Path $LockFile)) {
        return $null
    }

    $raw = (Get-Content -LiteralPath $LockFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $null
    }

    $pidValue = 0
    if ([int]::TryParse($raw, [ref]$pidValue)) {
        return $pidValue
    }

    return $null
}

function Test-PidRunning {
    param([int]$PidToCheck)

    if ($PidToCheck -le 0) {
        return $false
    }

    return $null -ne (Get-Process -Id $PidToCheck -ErrorAction SilentlyContinue)
}

if (Test-Path $LockFile) {
    $lockAge = (Get-Date) - (Get-Item $LockFile).LastWriteTime
    $lockPid = Get-LockPid

    if ($lockPid -and (Test-PidRunning -PidToCheck $lockPid)) {
        if ($lockAge.TotalHours -lt 6) {
            Write-Log "Another scheduled update appears to be running (PID $lockPid). Lock age: $([math]::Round($lockAge.TotalMinutes, 1)) minutes. Exiting."
            exit 0
        }
        Write-Log "Removing stale lock file for long-running PID $lockPid. Lock age: $([math]::Round($lockAge.TotalHours, 1)) hours."
    } elseif ($lockPid) {
        Write-Log "Removing stale lock file for exited PID $lockPid. Lock age: $([math]::Round($lockAge.TotalMinutes, 1)) minutes."
    } elseif ($lockAge.TotalHours -lt 6) {
        Write-Log "Removing stale lock file with no PID information. Lock age: $([math]::Round($lockAge.TotalMinutes, 1)) minutes."
    } else {
        Write-Log "Removing stale lock file. Lock age: $([math]::Round($lockAge.TotalHours, 1)) hours."
    }
    Remove-Item -LiteralPath $LockFile -Force
}

try {
    Set-Content -LiteralPath $LockFile -Value $PID -Encoding ascii

    Set-Location $Project
    $idleAtStart = Get-IdleMinutes
    Write-Log "============================================================"
    Write-Log "Scheduled DB update started. Idle at start: $idleAtStart minutes."

    Start-PostgresIfNeeded

    Write-Log "Running incremental ESI history update..."
    $fetchArgs = @("-m", "scripts.fetch_history", "--incremental", "--concurrency", "$Concurrency")
    if ($DryRun) {
        $fetchArgs += "--dry-run"
    }
    if ($MaxPairs -gt 0) {
        $fetchArgs += @("--max-pairs", "$MaxPairs")
    }

    $updateExitCode = Invoke-LoggedProcess `
        -FilePath $Python `
        -ArgumentList $fetchArgs `
        -WorkingDirectory $Project `
        -TimeoutSeconds ($FetchTimeoutMinutes * 60)

    if ($updateExitCode -ne 0) {
        throw "History update failed with exit code $updateExitCode."
    }

    Write-Log "Scheduled DB update finished successfully."
    Enter-SleepIfIdle
    exit 0
} catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
} finally {
    if (Test-Path $LockFile) {
        Remove-Item -LiteralPath $LockFile -Force
    }
    Write-Log "Scheduled DB update script ended."
}
