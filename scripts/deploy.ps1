# Deploy OmniOps AI to Cloud Run (README → Setup on Google Cloud, step 8).
# Usage (PowerShell, from the omniops-ai folder):  .\scripts\deploy.ps1 -ProjectId <PROJECT_ID>
# Add -Tag final for the submission build; -Vertex to use Gemini on Vertex AI instead of the Developer API.
# TODO(setup): before the first deploy, complete README → Setup on Google Cloud, steps 1–6.
param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [string]$Region = "us-central1",
  [string]$Model = "gemini-3.8-flash",   # TODO(setup): change it if the model name in AI Studio differs (or pass -Model <name>)
  [string]$Bucket = "",   # defaults to <ProjectId>-docs; pass -Bucket <name> if you used a different name in README → Setup, step 3
  [string]$Tag = "",
  [switch]$Vertex
)

$bucketName = if ($Bucket) { $Bucket } else { "$ProjectId-docs" }
$envVars = "GEMINI_MODEL=$Model,GOOGLE_CLOUD_PROJECT=$ProjectId,GCS_BUCKET=$bucketName"
if ($Vertex) { $envVars += ",GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_LOCATION=$Region" }

$gcloudArgs = @(
  "run", "deploy", "omniops", "--source", ".", "--project", $ProjectId, "--region", $Region,
  "--allow-unauthenticated", "--timeout", "300", "--memory", "1Gi", "--cpu", "1",
  "--min-instances", "0", "--max-instances", "2",
  "--set-env-vars", $envVars
)
if (-not $Vertex) { $gcloudArgs += @("--set-secrets", "GEMINI_API_KEY=gemini-api-key:latest") }
if ($Tag) { $gcloudArgs += @("--tag", $Tag) }

# Call gcloud.cmd directly when available (the gcloud.ps1 wrapper can drop --x style arguments passed as an array)
$cmd = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
if ($cmd) { $exe = $cmd.Source } else { $exe = "gcloud" }

Write-Host "gcloud $($gcloudArgs -join ' ')"
& $exe @gcloudArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error "Deploy failed (exit code $LASTEXITCODE). Logs: gcloud run services logs read omniops --region $Region --limit 50"
  exit $LASTEXITCODE
}
