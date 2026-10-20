param([Parameter(Mandatory=$true)][string]$Workbook,[Parameter(Mandatory=$true)][string]$Output)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($Workbook)
try {
  function Read-XmlEntry([string]$name) {
    $reader=[System.IO.StreamReader]::new($archive.GetEntry($name).Open())
    try { [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
  }
  $strings=Read-XmlEntry 'xl/sharedStrings.xml'
  $values=@($strings.sst.si | ForEach-Object { $_.InnerText })
  $sheet=Read-XmlEntry 'xl/worksheets/sheet1.xml'
  $records=@(foreach($row in $sheet.worksheet.sheetData.row) {
    if([int]$row.r -le 2){continue}
    $cells=@{}
    foreach($cell in $row.c){
      $column=$cell.r -replace '\d',''
      $cells[$column]=if($cell.t -eq 's'){$values[[int]$cell.v]}elseif($cell.t -eq 'inlineStr'){$cell.is.InnerText}else{[string]$cell.v}
    }
    if(!$cells['F'] -or !$cells['I']){continue}
    [pscustomobject]@{studentCode=$cells['F'].Trim();fullName=($cells['H']+$cells['I']+' '+$cells['J']).Trim();gradeLevel=$cells['D'].Trim();classroom=$cells['E'].Trim()}
  })
  $duplicates=@($records | Group-Object studentCode | Where-Object Count -gt 1)
  if($duplicates.Count){throw "Duplicate student codes: $($duplicates.Count). Import stopped."}
  [System.IO.File]::WriteAllText($Output, (ConvertTo-Json -InputObject $records -Depth 4), [System.Text.UTF8Encoding]::new($false))
  Write-Output "Extracted $($records.Count) students; duplicates: 0; retained only school code, name, grade, classroom."
} finally {$archive.Dispose()}
