#!/usr/bin/env bash
# Provision (or re-apply) the Azure OpenAI resources behind Sallie, with the cost
# controls described in docs/AZURE-OPENAI.adoc. Two resources, because the voice
# models are not offered in the chat resource's region:
#
#   chat   knowall-website-ai     (uksouth)  gpt-5.6-sol
#   voice  knowall-website-voice  (eastus2)  gpt-realtime, gpt-4o-mini-tts, gpt-4o-mini-transcribe
#
# For each: an AI Services account, GlobalStandard deployments with capped
# capacity (the hard ceiling on spend rate), and a monthly Cost Management budget
# scoped to that one resource with email alerts. With --set-secrets, endpoints and
# keys are pushed into the GitHub "Production - Azure" environment for the deploy
# workflow. Every step is idempotent, so re-running is safe.
#
#   scripts/azure-openai-setup.sh [--set-secrets]
#   AZURE_OPENAI_TPM_THOUSANDS=10 scripts/azure-openai-setup.sh   # override a default
set -euo pipefail

RG=${AZURE_RESOURCE_GROUP:-KnowAllAIRG}
BUDGET_EMAIL=${AZURE_OPENAI_BUDGET_EMAIL:-ben.weeks@knowall.ai}
GH_ENV=${GH_ENVIRONMENT:-"Production - Azure"}

# Chat
CHAT_ACCOUNT=${AZURE_OPENAI_ACCOUNT:-knowall-website-ai}
CHAT_LOCATION=${AZURE_LOCATION:-uksouth}
CHAT_MODEL=${AZURE_OPENAI_MODEL:-gpt-5.6-sol}
CHAT_MODEL_VERSION=${AZURE_OPENAI_MODEL_VERSION:-2026-07-09}
CHAT_DEPLOYMENT=${AZURE_OPENAI_DEPLOYMENT:-$CHAT_MODEL}
CHAT_CAPACITY=${AZURE_OPENAI_TPM_THOUSANDS:-5} # units of 1,000 tokens/minute
CHAT_BUDGET=${AZURE_OPENAI_BUDGET:-50}

# Voice. Deployments are named after their models: lib/voice-provider.ts relies on it.
VOICE_ACCOUNT=${AZURE_OPENAI_VOICE_ACCOUNT:-knowall-website-voice}
VOICE_LOCATION=${AZURE_OPENAI_VOICE_LOCATION:-eastus2}
VOICE_BUDGET=${AZURE_OPENAI_VOICE_BUDGET:-50}
# model version capacity. Capacity 1 = realtime 20 req + 10K tokens/min;
# TTS and transcribe 100 req + 1K tokens/min each.
VOICE_DEPLOYMENTS=(
  "gpt-realtime 2025-08-28 ${AZURE_OPENAI_REALTIME_CAPACITY:-1}"
  "gpt-4o-mini-tts 2025-12-15 ${AZURE_OPENAI_TTS_CAPACITY:-1}"
  "gpt-4o-mini-transcribe 2025-12-15 ${AZURE_OPENAI_TRANSCRIBE_CAPACITY:-1}"
)

SUB=$(az account show --query id -o tsv)

ensure_account() { # account location
  if ! az cognitiveservices account show -n "$1" -g "$RG" >/dev/null 2>&1; then
    az cognitiveservices account create -n "$1" -g "$RG" -l "$2" \
      --kind AIServices --sku S0 --custom-domain "$1" --yes -o none
  fi
}

deploy() { # account deployment model version capacity
  # The CLI has no `deployment update`; `create` is an ARM PUT, so re-running it
  # on an existing deployment is the supported way to change its capacity.
  az cognitiveservices account deployment create -n "$1" -g "$RG" --deployment-name "$2" \
    --model-name "$3" --model-version "$4" --model-format OpenAI \
    --sku-name GlobalStandard --sku-capacity "$5" -o none
}

budget() { # account amount
  local res_id="/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.CognitiveServices/accounts/$1"
  local url="https://management.azure.com/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.Consumption/budgets/$1-monthly?api-version=2023-05-01"
  # An existing budget's start date cannot be changed, so keep it on re-runs and
  # only default to the current month when creating the budget for the first time.
  local start end
  start=$(az rest --method get --url "$url" --query properties.timePeriod.startDate -o tsv 2>/dev/null || true)
  start=${start:-$(date -u +%Y-%m-01T00:00:00Z)}
  end=$(date -u -d "+2 years" +%Y-%m-01T00:00:00Z)
  local alerts="" t kind
  for t in actual50 actual80 actual100 forecast100; do
    kind=Actual; [[ $t == forecast* ]] && kind=Forecasted
    alerts+="\"$t\":{\"enabled\":true,\"operator\":\"GreaterThan\",\"threshold\":${t//[a-z]/},\"thresholdType\":\"$kind\",\"contactEmails\":[\"$BUDGET_EMAIL\"]},"
  done
  az rest --method put -o none --url "$url" --body "{\"properties\":{\"category\":\"Cost\",\"amount\":$2,\"timeGrain\":\"Monthly\",
    \"timePeriod\":{\"startDate\":\"$start\",\"endDate\":\"$end\"},
    \"filter\":{\"dimensions\":{\"name\":\"ResourceId\",\"operator\":\"In\",\"values\":[\"$res_id\"]}},
    \"notifications\":{${alerts%,}}}}"
}

endpoint_of() { # account
  # Read the OpenAI endpoint the account actually exposes rather than assuming a
  # hostname: an AIServices account advertises several.
  local e
  e=$(az cognitiveservices account show -n "$1" -g "$RG" \
    --query 'properties.endpoints."OpenAI Language Model Instance API"' -o tsv)
  printf '%s' "${e:-https://$1.openai.azure.com/}"
}

publish() { # account endpoint-secret key-secret
  az cognitiveservices account keys list -n "$1" -g "$RG" --query key1 -o tsv \
    | gh secret set "$3" --env "$GH_ENV"
  endpoint_of "$1" | gh secret set "$2" --env "$GH_ENV"
}

echo "==> Chat: $CHAT_ACCOUNT ($CHAT_LOCATION)"
ensure_account "$CHAT_ACCOUNT" "$CHAT_LOCATION"
deploy "$CHAT_ACCOUNT" "$CHAT_DEPLOYMENT" "$CHAT_MODEL" "$CHAT_MODEL_VERSION" "$CHAT_CAPACITY"
budget "$CHAT_ACCOUNT" "$CHAT_BUDGET"

echo "==> Voice: $VOICE_ACCOUNT ($VOICE_LOCATION)"
ensure_account "$VOICE_ACCOUNT" "$VOICE_LOCATION"
for d in "${VOICE_DEPLOYMENTS[@]}"; do
  read -r model version capacity <<< "$d"
  deploy "$VOICE_ACCOUNT" "$model" "$model" "$version" "$capacity"
done
budget "$VOICE_ACCOUNT" "$VOICE_BUDGET"

if [[ "${1:-}" == "--set-secrets" ]]; then
  echo "==> GitHub environment secrets + deployment variable ($GH_ENV)"
  publish "$CHAT_ACCOUNT" AZURE_OPENAI_ENDPOINT AZURE_OPENAI_API_KEY
  gh variable set AZURE_OPENAI_DEPLOYMENT --env "$GH_ENV" --body "$CHAT_DEPLOYMENT"
  publish "$VOICE_ACCOUNT" AZURE_OPENAI_VOICE_ENDPOINT AZURE_OPENAI_VOICE_API_KEY
else
  echo "==> Skipped GitHub secrets (pass --set-secrets to push them)"
fi

cat <<MSG

Done.
  Chat   $(endpoint_of "$CHAT_ACCOUNT")  $CHAT_DEPLOYMENT @ ${CHAT_CAPACITY}K TPM, budget $CHAT_BUDGET/month
  Voice  $(endpoint_of "$VOICE_ACCOUNT")  ${#VOICE_DEPLOYMENTS[@]} deployments, budget $VOICE_BUDGET/month
Change a ceiling with scripts/azure-openai-capacity.sh (see its header).
For local dev put the endpoints and keys (az cognitiveservices account keys list -n <account> -g $RG) in .env.local.
MSG
