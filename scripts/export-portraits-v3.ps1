Add-Type -AssemblyName System.Drawing

$generated = 'C:\Users\Adrian\.codex\generated_images\01a13f0d-d0a8-7e72-99c9-3c081e674b3e'
$project = Split-Path -Parent $PSScriptRoot
$legacy = Join-Path $project 'public\portraits'
$output = Join-Path $legacy 'v3'

$portraits = @(
  @('S','jan-firlej','exec-e40e7587-e837-4f15-b54d-24a81aed901b.png'),
  @('S','marcin-komenda','exec-7ae484ee-c924-4a84-9eff-e11978f93d51.png'),
  @('S','miguel-tavares','exec-06e92fb8-6c10-4212-816c-a7c04188032c.png'),
  @('S','benjamin-toniutti','exec-98d5d897-e183-49eb-b771-1aa923acb4fd.png'),
  @('S','marcin-janusz','exec-50764917-7925-482a-8047-a2db66d8d67f.png'),
  @('S','luciano-de-cecco','exec-52c21bd0-38ff-4ff8-a445-1dba46ad2997.png'),
  @('S','fabian-drzyzga','exec-48633381-b71a-4426-ba76-dad0ed910fa9.png'),
  @('OPP','kewin-sasak','exec-4a64527e-125d-4215-9029-c46bfa031182.png'),
  @('OPP','patrik-indra','exec-a0bb44c8-5b1e-401c-a314-75ed17e28c88.png'),
  @('OPP','kamil-rychlicki','exec-1747c602-14df-4ccd-a151-8971c3e16bbf.png'),
  @('OPP','bartlomiej-boladz','exec-a836af0d-1a5c-4ab3-b2bc-061db106a111.png'),
  @('OPP','kyle-ensing','exec-ae5d5a4d-06df-4311-9fc9-60a1dba2277b.png'),
  @('OPP','yuri-romano','exec-30340695-12f4-4113-990c-735c9a3b3a59.png'),
  @('OPP','lukasz-kaczmarek','exec-d03f0bbf-195e-4fb6-a393-05bbbbbc6e02.png'),
  @('OH','wilfredo-leon','exec-e75cee21-7f35-45f6-9537-0ee76d8cebd3.png'),
  @('OH','bartosz-kwolek','exec-359d137e-0e5c-47cf-8f43-309f265afbe4.png'),
  @('OH','artur-szalpuk','exec-68dd1f8f-85ac-414d-89f8-3e6bf2622367.png'),
  @('OH','aaron-russell','MASTER'),
  @('OH','tomasz-fornal','exec-812b2666-734f-4e74-a99b-db107de95bb3.png'),
  @('OH','bartosz-bednorz','exec-a2cb5525-9f57-46a6-b93d-736078c08c74.png'),
  @('OH','hilir-henno','exec-42bb2680-bfa9-4369-a1bb-a557172bf7ae.png'),
  @('OH','kevin-tillie','exec-4658b788-f679-450e-91f2-ffd3655f7de0.png'),
  @('OH','yacine-louati','exec-063f1b1c-24e3-4854-b8c7-c7f14ff40043.png'),
  @('MB','mateusz-bieniek','exec-dc4b4da7-d7a6-4bd0-8b7b-739bbbbaa609.png'),
  @('MB','jurij-gladyr','exec-607f4da8-42b9-4ecb-b1a7-af3478f48e63.png'),
  @('MB','aleks-grozdanov','exec-d0f8527d-96b2-47bb-a803-860c88895174.png'),
  @('MB','mateusz-poreba','exec-282affbb-0172-4866-a4ed-4a211adf9054.png'),
  @('MB','jakub-kochanowski','exec-0e64027d-7e8e-4150-9c39-6891199662be.png'),
  @('MB','daenan-gyimah','exec-d245f4d0-ff54-4b0c-b7dd-3cf71fd782b9.png'),
  @('MB','jurij-semeniuk','exec-21f19099-1ab1-4b87-b28e-d2f222f9eaad.png'),
  @('MB','anton-brehme','exec-69c5b12a-2657-4544-a8c5-6e675641f9f0.png'),
  @('MB','szymon-jakubiszak','exec-03bba5b6-c3b4-41d4-b79d-1c62284477b5.png'),
  @('L','jakub-popiwczak','exec-dbf9eaf3-e690-4283-8659-75248c3c73d3.png'),
  @('L','thales-hoss','exec-f6b948d7-0160-439b-8e18-d2aa5c25a3f5.png'),
  @('L','pawel-zatorski','exec-2c6db12a-804f-48ca-9d16-b6c8048001b0.png'),
  @('L','erik-shoji','exec-97131cdb-1fde-4446-8cf7-c590dd89ae75.png'),
  @('L','sonae-kazuma','exec-4ca643dc-b984-48d2-8fe3-3f6782325b6f.png'),
  @('L','maksymilian-granieczny','exec-0a0da91c-3e63-44bf-986c-8860034660b3.png'),
  @('L','tomohiro-ogawa','exec-a2355409-dcc2-45b8-909a-2199d22a598a.png')
)

function Resize-Nearest([string]$sourcePath, [string]$destinationPath) {
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  $logical = New-Object System.Drawing.Bitmap 70, 90
  $logicalGraphics = [System.Drawing.Graphics]::FromImage($logical)
  $logicalGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $logicalGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $logicalGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $targetRatio = 7.0 / 9.0
  $sourceRatio = $source.Width / [double]$source.Height
  if ($sourceRatio -gt $targetRatio) {
    $cropHeight = $source.Height
    $cropWidth = [int][Math]::Round($cropHeight * $targetRatio)
    $cropX = [int][Math]::Floor(($source.Width - $cropWidth) / 2)
    $cropY = 0
  } else {
    $cropWidth = $source.Width
    $cropHeight = [int][Math]::Round($cropWidth / $targetRatio)
    $cropX = 0
    $cropY = [int][Math]::Floor(($source.Height - $cropHeight) / 2)
  }
  $destinationRectangle = New-Object System.Drawing.Rectangle 0, 0, 70, 90
  $sourceRectangle = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropWidth, $cropHeight
  $logicalGraphics.DrawImage($source, $destinationRectangle, $sourceRectangle, [System.Drawing.GraphicsUnit]::Pixel)

  $final = New-Object System.Drawing.Bitmap 350, 450
  $finalGraphics = [System.Drawing.Graphics]::FromImage($final)
  $finalGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $finalGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $finalGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $finalGraphics.DrawImage($logical, 0, 0, 350, 450)
  $final.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $finalGraphics.Dispose()
  $final.Dispose()
  $logicalGraphics.Dispose()
  $logical.Dispose()
  $source.Dispose()
}

foreach ($portrait in $portraits) {
  $position, $slug, $file = $portrait
  $destinationDirectory = Join-Path $output $position
  New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
  $sourcePath = if ($file -eq 'MASTER') { Join-Path $legacy 'OH\aaron-russell-pixel.png' } else { Join-Path $generated $file }
  $destinationPath = Join-Path $destinationDirectory "$slug-pixel.png"
  if (-not (Test-Path -LiteralPath $sourcePath)) { throw "Missing generated portrait: $sourcePath" }
  Resize-Nearest $sourcePath $destinationPath
}

Write-Output "Exported $($portraits.Count) portraits to $output"
