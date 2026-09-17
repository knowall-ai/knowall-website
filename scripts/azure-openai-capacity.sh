#!/usr/bin/env bash
# Raise or lower the tokens-per-minute ceiling on Sallie's Azure OpenAI deployment.
# This is the throttle: 1 unit = 1,000 tokens per minute. Requests beyond it get
# HTTP 429 and Sallie replies with her "busy" message instead of spending more.
#
#   scripts/azure-openai-capacity.sh        # show current capacity
#   scripts/azure-openai-capacity.sh 1      # clamp to 1K TPM (emergency brake)
#   scripts/azure-openai-capacity.sh 5      # back to the normal ceiling
set -euo pipefail

RG=${AZURE_RESOURCE_GROUP:-KnowAllAIRG}
ACCOUNT=${AZURE_OPENAI_ACCOUNT:-knowall-website-ai}
DEPLOYMENT=${AZURE_OPENAI_DEPLOYMENT:-gpt-5.6-sol}

if [[ $# -eq 0 ]]; then
  az cognitiveservices account deployment show -n "$ACCOUNT" -g "$RG" --deployment-name "$DEPLOYMENT" \
    --query "{deployment:name,sku:sku.name,thousandTPM:sku.capacity}" -o table
  exit 0
fi

az cognitiveservices account deployment update -n "$ACCOUNT" -g "$RG" --deployment-name "$DEPLOYMENT" \
  --sku-name GlobalStandard --sku-capacity "$1" \
  --query "{deployment:name,sku:sku.name,thousandTPM:sku.capacity}" -o table
