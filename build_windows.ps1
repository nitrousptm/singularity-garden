# SINGULARITY GARDEN - Windows build script (RTX 5090 / RTX 3090)
param([string]$Config = "Release")

Write-Host "SINGULARITY GARDEN - Windows Build ($Config)" -ForegroundColor Cyan

$BuildDir = "build\windows_" + $Config.ToLower()

# Always wipe the build directory to avoid stale CMake cache
if (Test-Path $BuildDir) {
    Write-Host "Cleaning $BuildDir ..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $BuildDir
}
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
Push-Location $BuildDir

$cmakeArgs = @(
    "..\..";
    "-G"; "Visual Studio 18 2026";
    "-A"; "x64";
    "-DCMAKE_BUILD_TYPE=$Config"
)
cmake @cmakeArgs
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

cmake --build . --config $Config --parallel
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

Pop-Location
Write-Host ""
Write-Host "Build complete: $BuildDir\$Config\singularity_garden.exe" -ForegroundColor Green
Write-Host "Run from the singularity-garden root directory."
