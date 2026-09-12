# Start only the repository-local Windows test server provisioned in docs/test-windows.md.
$ErrorActionPreference = 'Stop'
$testRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.test/trilium'))
foreach ($name in @('node.exe', 'server/main.cjs', 'server/node_modules/better-sqlite3/prebuilds/win32-x64.node')) {
    if (!(Test-Path -LiteralPath (Join-Path $testRoot $name))) { throw "Missing $name; see docs/test-windows.md." }
}
$socket = New-Object Net.Sockets.TcpClient
try {
    try { $socket.Connect('127.0.0.1', 37841) } catch {}
    if ($socket.Connected) { throw 'Port 37841 is already in use; do not start a second test server.' }
} finally { $socket.Dispose() }
$env:TRILIUM_DATA_DIR = Join-Path $testRoot 'data'
$env:TRILIUM_HOST = '127.0.0.1'
$env:TRILIUM_PORT = '37841'
$env:TRILIUM_ENV = 'production'
$server = Start-Process -FilePath (Join-Path $testRoot 'node.exe') -ArgumentList 'main.cjs' `
    -WorkingDirectory (Join-Path $testRoot 'server') -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $testRoot 'server.log') `
    -RedirectStandardError (Join-Path $testRoot 'server-error.log')
Set-Content -LiteralPath (Join-Path $testRoot 'server.pid') -Value $server.Id
Write-Output "Trilium test server started (PID $($server.Id)): http://127.0.0.1:37841/"
