#!/usr/bin/env bash
set -euo pipefail

# ينشر Coolify Application واحد عبر الـAPI (لا webhook بلا تتبّع حالة) وينتظر تأكيدًا فعليًّا
# لنجاح النشر — لا يكتفي بأن HTTP endpoint يُرجِع 200، لأن نسخة قديمة لا تزال تعمل يمكن أن تُرجِع
# 200 بينما فشل النشر الجديد فعليًّا وبقيت القديمة قائمة (بالضبط ما نريد تجنّب الخلط معه).
#
# ⚠️ TODO (يجب تنفيذه قبل ربط أي Secret حقيقيّ بهذا الملف — لا يزال Phase D، بلا أسرار فعلية بعد):
# شكل الـendpoints وأسماء الحقول أدناه (`/deploy?uuid=`, `/deployments/{uuid}`, `.status`,
# `.deployments[0].deployment_uuid`) مبنيّة على التوثيق العامّ المعروف لـCoolify v4 REST API —
# لم تُؤكَّد بعد مقابل توثيق API الفعليّ لهذه النسخة تحديدًا لأن Phase D يمنع صراحةً أي وصول إلى
# Coolify. راجع https://<coolify-host>/docs/api على السيرفر الفعليّ وصحِّح هذا الملف إن اختلف
# الشكل الفعليّ، قبل تفعيله بأي Secret حقيقيّ.

app_uuid="$1"
coolify_api="${COOLIFY_API_URL:?COOLIFY_API_URL is required}"
token="${COOLIFY_API_TOKEN:?COOLIFY_API_TOKEN is required}"

echo "Triggering deploy for Coolify Application ${app_uuid} ..."
response=$(curl -fsS -X POST "${coolify_api}/deploy?uuid=${app_uuid}" \
  -H "Authorization: Bearer ${token}")
deployment_uuid=$(echo "$response" | jq -r '.deployments[0].deployment_uuid // empty')

if [ -z "$deployment_uuid" ]; then
  echo "Failed to obtain a deployment_uuid from Coolify's response: $response" >&2
  exit 1
fi

echo "Tracking deployment ${deployment_uuid} ..."
for _ in $(seq 1 60); do
  status=$(curl -fsS "${coolify_api}/deployments/${deployment_uuid}" \
    -H "Authorization: Bearer ${token}" | jq -r '.status // empty')
  case "$status" in
    finished)
      echo "Deployment ${deployment_uuid} finished successfully."
      exit 0
      ;;
    failed | cancelled)
      echo "Deployment ${deployment_uuid} ended with status: ${status}" >&2
      exit 1
      ;;
    *)
      sleep 10
      ;;
  esac
done

echo "Timed out waiting for deployment ${deployment_uuid} to reach a final status." >&2
exit 1
