#!/usr/bin/env bash
# Provision (or re-apply) the Azure OpenAI resource that backs Sallie's chat,
# with the cost controls described in docs/AZURE-OPENAI.adoc:
#   1. an Azure AI Services account in the website's resource group
#   2. a GlobalStandard model deployment with a capped tokens-per-minute capacity
#   3. a monthly Cost Management budget scoped to that one resource, with alerts
#   4. (optional, --set-secrets) the endpoint + key pushed into the GitHub
#      "Production - Azure" environment for the deploy workflow to pick up
#
# Every step is idempotent, so re-running is safe. Override any default via env:
#   AZURE_OPENAI_TPM_THOUSANDS=10 scripts/azure-openai-setup.sh --set-secrets
set -euo pipefail

RG=${AZURE_RESOURCE_GROUP:-KnowAllAIRG}
LOCATION=${AZURE_LOCATION:-uksouth}
ACCOUNT=${AZURE_OPENAI_ACCOUNT:-knowall-website-ai}
MODEL=${AZURE_OPENAI_MODEL:-gpt-5.6-sol}
MODEL_VERSION=${AZURE_OPENAI_MODEL_VERSION:-2026-07-09}
DEPLOYMENT=${AZURE_OPENAI_DEPLOYMENT:-$MODEL}
# GlobalStandard capacity is in units of 1,000 tokens per minute. This is the
# hard ceiling on throughput, and therefore on how fast money can be spent.
CAPACITY=${AZURE_OPENAI_TPM_THOUSANDS:-5}
BUDGET_AMOUNT=${AZURE_OPENAI_BUDGET:-50}
BUDGET_EMAIL=${AZURE_OPENAI_BUDGET_EMAIL:-ben.weeks@knowall.ai}
GH_ENV=${GH_ENVIRONMENT:-"Production - Azure"}

SUB=$(az account show --query id -o tsv)
RES_ID="/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.CognitiveServices/accounts/$ACCOUNT"

echo "==> 1/4 AI Services account $ACCOUNT ($RG, $LOCATION)"
if ! az cognitiveservices account show -n "$ACCOUNT" -g "$RG" >/dev/null 2>&1; then
  az cognitiveservices account create -n "$ACCOUNT" -g "$RG" -l "$LOCATION" \
    --kind AIServices --sku S0 --custom-domain "$ACCOUNT" --yes -o none
fi

echo "==> 2/4 Deployment $DEPLOYMENT = $MODEL $MODEL_VERSION @ ${CAPACITY}K TPM"
# The CLI has no `deployment update`; `create` is an ARM PUT, so re-running it
# on an existing deployment is the supported way to change its capacity.
az cognitiveservices account deployment create -n "$ACCOUNT" -g "$RG" --deployment-name "$DEPLOYMENT" \
  --model-name "$MODEL" --model-version "$MODEL_VERSION" --model-format OpenAI \
  --sku-name GlobalStandard --sku-capacity "$CAPACITY" -o none

echo "==> 3/4 Budget $ACCOUNT-monthly = $BUDGET_AMOUNT/month, alerts to $BUDGET_EMAIL"
START=$(date -u +%Y-%m-01T00:00:00Z)
END=$(date -u -d "+2 years" +%Y-%m-01T00:00:00Z)
BODY=$(cat <<JSON
{"properties":{"category":"Cost","amount":$BUDGET_AMOUNT,"timeGrain":"Monthly",
 "timePeriod":{"startDate":"$START","endDate":"$END"},
 "filter":{"dimensions":{"name":"ResourceId","operator":"In","values":["$RES_ID"]}},
 "notifications":{
  "actual50":{"enabled":true,"operator":"GreaterThan","threshold":50,"thresholdType":"Actual","contactEmails":["$BUDGET_EMAIL"]},
  "actual80":{"enabled":true,"operator":"GreaterThan","threshold":80,"thresholdType":"Actual","contactEmails":["$BUDGET_EMAIL"]},
  "actual100":{"enabled":true,"operator":"GreaterThan","threshold":100,"thresholdType":"Actual","contactEmails":["$BUDGET_EMAIL"]},
  "forecast100":{"enabled":true,"operator":"GreaterThan","threshold":100,"thresholdType":"Forecasted","contactEmails":["$BUDGET_EMAIL"]}}}}
JSON
)
az rest --method put -o none \
  --url "https://management.azure.com/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.Consumption/budgets/$ACCOUNT-monthly?api-version=2023-05-01" \
  --body "$BODY"

# Read the OpenAI endpoint the account actually exposes rather than assuming a
# hostname: an AIServices account advertises several, and the app's v1 base URL
# must sit on the OpenAI one.
ENDPOINT=$(az cognitiveservices account show -n "$ACCOUNT" -g "$RG" \
  --query 'properties.endpoints."OpenAI Language Model Instance API"' -o tsv)
ENDPOINT=${ENDPOINT:-https://$ACCOUNT.openai.azure.com/}
if [[ "${1:-}" == "--set-secrets" ]]; then
  echo "==> 4/4 GitHub environment secrets + deployment variable ($GH_ENV)"
  az cognitiveservices account keys list -n "$ACCOUNT" -g "$RG" --query key1 -o tsv \
    | gh secret set AZURE_OPENAI_API_KEY --env "$GH_ENV"
  printf '%s' "$ENDPOINT" | gh secret set AZURE_OPENAI_ENDPOINT --env "$GH_ENV"
  gh variable set AZURE_OPENAI_DEPLOYMENT --env "$GH_ENV" --body "$DEPLOYMENT"
else
  echo "==> 4/4 Skipped GitHub secrets (pass --set-secrets to push them)"
fi

cat <<MSG

Done.
  AZURE_OPENAI_ENDPOINT   = $ENDPOINT
  AZURE_OPENAI_DEPLOYMENT = $DEPLOYMENT
  Throughput ceiling      = ${CAPACITY}000 tokens/minute (change with scripts/azure-openai-capacity.sh N)
  Budget                  = $BUDGET_AMOUNT/month on $ACCOUNT only
For local dev, put the endpoint and a key (az cognitiveservices account keys list -n $ACCOUNT -g $RG) in .env.local.
MSG
