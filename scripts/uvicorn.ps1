$arguments = @($args)
$Command = if ($arguments.Count -gt 0) { [string]$arguments[0] } else { "dev" }
$RestArgs = if ($arguments.Count -gt 1) { @($arguments[1..($arguments.Count - 1)]) } else { @() }

$uvicornPath = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "..\.venv\Scripts\uvicorn.exe")
)

if (-not (Test-Path $uvicornPath)) {
    Write-Error "Uvicorn executable not found at $uvicornPath"
    exit 1
}

function Invoke-Uvicorn {
    param(
        [string[]]$CliArgs
    )

    $argumentLine = [string]::Join(
        " ",
        ($CliArgs | ForEach-Object {
            if ($_ -match '[\s"]') {
                '"' + ($_ -replace '"', '\"') + '"'
            }
            else {
                $_
            }
        })
    )

    $process = Start-Process -FilePath $uvicornPath -ArgumentList $argumentLine -NoNewWindow -Wait -PassThru
    exit $process.ExitCode
}

switch ($Command) {
    "dev" {
        Invoke-Uvicorn -CliArgs (@("main:app", "--reload", "--port", "8001") + $RestArgs)
    }
    "help" {
        Write-Host "Usage:"
        Write-Host "  bun api"
        Write-Host "  bun run uvicorn dev"
        Write-Host "  bun run uvicorn main:app --reload --port 8001"
        exit 0
    }
    "--help" {
        Write-Host "Usage:"
        Write-Host "  bun api"
        Write-Host "  bun run uvicorn dev"
        Write-Host "  bun run uvicorn main:app --reload --port 8001"
        exit 0
    }
    default {
        Invoke-Uvicorn -CliArgs (@($Command) + $RestArgs)
    }
}
