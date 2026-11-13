function Get-GitObject {
    param([string]$sha)
    $prefix = $sha.Substring(0, 2)
    $rest = $sha.Substring(2)
    $path = "d:\AIRIS\airis-enterprise\.git\objects\$prefix\$rest"
    if (-not (Test-Path $path)) { return $null }
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $ms = New-Object System.IO.MemoryStream(@(,$bytes[2..($bytes.Length - 1)]))
    $deflate = New-Object System.IO.Compression.DeflateStream($ms, [System.IO.Compression.CompressionMode]::Decompress)
    $outMs = New-Object System.IO.MemoryStream
    $deflate.CopyTo($outMs)
    $deflate.Close()
    $ms.Close()
    return $outMs.ToArray()
}

function Parse-GitTree {
    param([byte[]]$treeBytes)
    $i = 0
    while ($i -lt $treeBytes.Length -and $treeBytes[$i] -ne 0) { $i++ }
    $i++
    $entries = @()
    while ($i -lt $treeBytes.Length) {
        $spaceIdx = $i
        while ($spaceIdx -lt $treeBytes.Length -and $treeBytes[$spaceIdx] -ne 32) { $spaceIdx++ }
        $mode = [System.Text.Encoding]::ASCII.GetString($treeBytes[$i..($spaceIdx - 1)])
        $nullIdx = $spaceIdx + 1
        while ($nullIdx -lt $treeBytes.Length -and $treeBytes[$nullIdx] -ne 0) { $nullIdx++ }
        $name = [System.Text.Encoding]::UTF8.GetString($treeBytes[($spaceIdx + 1)..($nullIdx - 1)])
        $shaBytes = $treeBytes[($nullIdx + 1)..($nullIdx + 20)]
        $sha = ($shaBytes | ForEach-Object { $_.ToString("x2") }) -join ""
        $entries += [PSCustomObject]@{ Mode = $mode; Name = $name; Sha = $sha }
        $i = $nullIdx + 21
    }
    return $entries
}

$root = Parse-GitTree (Get-GitObject 'b075d6d5c96e2c1c9867adb055bdef98266ddd65')
$srcEntry = $root | Where-Object { $_.Name -eq 'src' }
$srcTree = Parse-GitTree (Get-GitObject $srcEntry.Sha)
$compEntry = $srcTree | Where-Object { $_.Name -eq 'components' }
$compTree = Parse-GitTree (Get-GitObject $compEntry.Sha)

$adminDocsBlob = Get-GitObject ($compTree | Where-Object { $_.Name -eq 'AdminDocsView.tsx' }).Sha
$nullPos = 0
while ($nullPos -lt $adminDocsBlob.Length -and $adminDocsBlob[$nullPos] -ne 0) { $nullPos++ }
$adminDocsText = [System.Text.Encoding]::UTF8.GetString($adminDocsBlob[($nullPos + 1)..($adminDocsBlob.Length - 1)])

$lines = $adminDocsText -split "`n"
for ($i = 35; $i -lt 55; $i++) {
    Write-Host "$($i + 1): $($lines[$i])"
}
