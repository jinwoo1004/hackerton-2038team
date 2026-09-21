param([string]$GradleCache=(Join-Path $env:USERPROFILE '.gradle/caches/modules-2/files-2.1'))
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskJars=@('com.fasterxml.jackson.core','org.springframework/spring-beans','org.springframework/spring-context') | ForEach-Object {
    Get-ChildItem -LiteralPath (Join-Path $GradleCache $_) -Recurse -Filter '*.jar' | ForEach-Object FullName
}
Push-Location $taskRoot
try {
    $taskClasspath=(@('backend/build/classes/java/main') + @($taskJars)) -join [IO.Path]::PathSeparator
    & java --class-path $taskClasspath scripts/verification/LlmBoundaryVerification.java
    if($LASTEXITCODE -ne 0){throw 'OpenAI local transport boundary verification failed.'}
} finally {Pop-Location}
