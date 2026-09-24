#!/usr/bin/env bash
# Raise or lower the capacity ceiling on one of Sallie's Azure OpenAI deployments.
# This is the throttle: requests beyond it get HTTP 429 instead of spending more.
# For chat, 1 unit = 1,000 tokens per minute and Sallie replies with her "busy"
# message. Defaults to the chat deployment; point it at a voice one via env.
#
#   scripts/azure-openai-capacity.sh        # show current capacity
#   scripts/azure-openai-capacity.sh 1      # clamp chat to 1K TPM (emergency brake)
#   scripts/azure-openai-capacity.sh 5      # back to the normal ceiling
#   AZURE_OPENAI_ACCOUNT=knowall-website-voice AZURE_OPENAI_DEPLOYMENT=gpt-realtime \
#     scripts/azure-openai-capacity.sh 2    # realtime voice: 1 unit = 20 req + 10K tokens/min
#
# Voice deployments are already at the minimum of 1. To brake voice harder, set
# the App Service setting SALLIE_VOICE_ENGINE=tts (cheaper model) or lower
# SALLIE_BUDGET_SPEAK_PER_DAY, or delete the deployment (voice then falls silent).
set -euo pipefail

RG=${AZURE_RESOURCE_GROUP:-KnowAllAIRG}
ACCOUNT=${AZURE_OPENAI_ACCOUNT:-knowall-website-ai}
DEPLOYMENT=${AZURE_OPENAI_DEPLOYMENT:-gpt-5.6-sol}

if [[ $# -eq 0 ]]; then
  az cognitiveservices account deployment show -n "$ACCOUNT" -g "$RG" --deployment-name "$DEPLOYMENT" \
    --query "{deployment:name,sku:sku.name,thousandTPM:sku.capacity}" -o table
  exit 0
fi

# The CLI has no `deployment update`; `create` is an ARM PUT, so re-running it
# with the deployment's current model and a new capacity is the supported way.
# Here-string (not process substitution) so `read` sees a terminating newline
# and returns 0 under `set -e`.
CURRENT=$(az cognitiveservices account deployment show -n "$ACCOUNT" -g "$RG" \
  --deployment-name "$DEPLOYMENT" --query "[properties.model.name, properties.model.version]" -o tsv | tr '\n' ' ')
read -r MODEL_NAME MODEL_VERSION <<< "$CURRENT"
az cognitiveservices account deployment create -n "$ACCOUNT" -g "$RG" --deployment-name "$DEPLOYMENT" \
  --model-name "$MODEL_NAME" --model-version "$MODEL_VERSION" --model-format OpenAI \
  --sku-name GlobalStandard --sku-capacity "$1" \
  --query "{deployment:name,sku:sku.name,thousandTPM:sku.capacity}" -o table
