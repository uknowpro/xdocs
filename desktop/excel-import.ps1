$ErrorActionPreference = 'Stop'
$excel = $null; $books = $null; $book = $null; $worksheets = $null
function Release-Com($value) { if ($null -ne $value -and [Runtime.InteropServices.Marshal]::IsComObject($value)) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($value) } }
try {
  # The dedicated instance leaves existing Excel windows and security policies alone.
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $true
  $excel.EnableEvents = $false
  $excel.AutomationSecurity = 3
  $excel.AskToUpdateLinks = $false
  $books = $excel.Workbooks
  $book = $books.Open($env:XDOCS_EXCEL_SOURCE, 0, $true)
  $permission = $null
  try { $permission = $book.Permission; if ($permission.Enabled) { throw 'Document permissions restrict direct extraction. Export only through an authorized Excel workflow.' } } finally { Release-Com $permission }
  $worksheets = $book.Worksheets
  $sheets = [Collections.Generic.List[object]]::new()
  $total = 0
  for ($i=1; $i -le $worksheets.Count; $i++) {
    $sheet = $null; $cells = $null; $lastRow = $null; $lastCol = $null
    try {
      $sheet = $worksheets.Item($i)
      if ($sheet.Visible -ne -1) { continue }
      if ($sheets.Count -ge 50) { throw 'Sheet limit exceeded.' }
      $cells = $sheet.Cells
      $lastRow = $cells.Find('*', [Type]::Missing, -4123, 2, 1, 2, $false, $false, $false)
      $lastCol = $cells.Find('*', [Type]::Missing, -4123, 2, 2, 2, $false, $false, $false)
      $rows = [Collections.Generic.List[object]]::new()
      if ($null -ne $lastRow) {
        $height = $lastRow.Row; $width = $lastCol.Column
        $total += $height * $width
        if ($height -gt 10000 -or $width -gt 256 -or $total -gt 100000) { throw 'Cell limit exceeded.' }
        for ($r=1; $r -le $height; $r++) {
          $row = [Collections.Generic.List[string]]::new()
          for ($c=1; $c -le $width; $c++) {
            $cell = $null
            try { $cell = $cells.Item($r,$c); $row.Add([string]$cell.Text) } finally { Release-Com $cell }
          }
          $rows.Add($row.ToArray())
        }
      }
      $sheets.Add(@{id=[Guid]::NewGuid().ToString();name=[string]$sheet.Name;rows=$rows.ToArray()})
    } finally { Release-Com $lastRow; Release-Com $lastCol; Release-Com $cells; Release-Com $sheet }
  }
  if ($sheets.Count -eq 0) { throw 'No visible worksheets.' }
  $json = @{version=1;sheets=$sheets.ToArray()} | ConvertTo-Json -Depth 10 -Compress
  if ([Text.Encoding]::UTF8.GetByteCount($json) -gt 4000000) { throw 'Workbook text limit exceeded.' }
  [IO.File]::WriteAllText($env:XDOCS_EXCEL_RESULT,$json,[Text.UTF8Encoding]::new($false))
} finally {
  Release-Com $worksheets
  if ($null -ne $book) { try { $book.Close($false) } catch { Write-Warning $_ } finally { Release-Com $book } }
  Release-Com $books
  if ($null -ne $excel) { try { $excel.Quit() } catch { Write-Warning $_ } finally { Release-Com $excel } }
}
