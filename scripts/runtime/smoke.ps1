param([int]$BackendPort=8080,[int]$FrontendPort=3200,[int]$ServicePort=8000)
. (Join-Path $PSScriptRoot 'common.ps1')
$backendBase = "http://localhost:$BackendPort"
Wait-DemoHttp "http://localhost:$FrontendPort/login" 15
$health = Invoke-RestMethod -Uri "$backendBase/api/health"
$service = Invoke-RestMethod -Uri "http://127.0.0.1:$ServicePort/health"
$login = Invoke-RestMethod -Uri "$backendBase/api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='admin@xisnd.com';password='test1234'}|ConvertTo-Json)
$headers = @{Authorization='Bearer '+$login.token}
$projects = Invoke-RestMethod -Uri "$backendBase/api/projects" -Headers $headers
$project = $projects | Where-Object projectCode -EQ 'WALLPAD-DEMO' | Select-Object -First 1
if (-not $project) { throw 'Seeded WALLPAD-DEMO project missing.' }
$projectBase = "$backendBase/api/projects/$($project.id)"
$until = [DateTime]::UtcNow.AddSeconds(30)
do {
    $analysis = Invoke-RestMethod -Uri "$projectBase/analysis/latest" -Headers $headers
    if ($analysis.status -eq 'COMPLETED') { break }
    if ($analysis.status -eq 'FAILED') { throw 'Seeded analysis failed.' }
    Start-Sleep -Milliseconds 500
} while ([DateTime]::UtcNow -lt $until)
if ($analysis.status -ne 'COMPLETED' -or @($analysis.result.findings).Count -eq 0) { throw 'Seeded analysis must finish with evidence-based findings.' }
$agents = @(Invoke-RestMethod -Uri "$projectBase/agents" -Headers $headers)
if ($agents.Count -eq 1 -and $agents[0] -is [Array]) { $agents = @($agents[0]) }
if ($agents.Count -ne 1 -or $agents[0].state -ne 'ONLINE' -or $agents[0].agentVersion -ne '1.0.0-demo') { throw 'Expected the one seeded Agent to be ONLINE through the C# sender.' }
$metrics = Invoke-RestMethod -Uri "$projectBase/metrics" -Headers $headers
$logs = Invoke-RestMethod -Uri "$projectBase/log-entries" -Headers $headers
$system = Invoke-RestMethod -Uri "$backendBase/api/system/status" -Headers $headers
if (@($system.services | Where-Object status -NE 'UP').Count -gt 0) { throw 'One or more system services is not UP.' }
$pointCount = 0
foreach ($series in $metrics.series) { $pointCount += @($series.points).Count }
if ($pointCount -eq 0 -or @($logs).Count -eq 0) { throw 'Telemetry is empty.' }
# Return only a sanitized summary; never return login headers, tokens, or complete Agent DTOs.
[pscustomobject]@{
    frontend = "http://localhost:$FrontendPort/login"; backendHealth=$health.status; serviceHealth=$service.status
    systemStatuses=@($system.services | ForEach-Object { "$($_.key):$($_.status)" })
    projectId=$project.id; agentCount=$agents.Count; agentState=$agents[0].state; agentVersion=$agents[0].agentVersion
    metricPoints=$pointCount; logEntries=@($logs).Count; analysisStatus=$analysis.status; score=$analysis.score; findings=@($analysis.result.findings).Count
} | ConvertTo-Json -Depth 4
