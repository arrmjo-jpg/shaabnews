#!/usr/bin/env bash
set -euo pipefail

# ينشر Coolify Application واحد عبر الـAPI (لا webhook بلا تتبّع حالة) وينتظر تأكيدًا فعليًّا
# لنجاح النشر — لا يكتفي بأن HTTP endpoint يُرجِع 200، لأن نسخة قديمة لا تزال تعمل يمكن أن تُرجِع
# 200 بينما فشل النشر الجديد فعليًّا وبقيت القديمة قائمة (بالضبط ما نريد تجنّب الخلط معه).
#
# ✅ مؤكَّد فعليًا (Phase F، قراءة مباشرة من كود Coolify 4.1.2 المُشغَّل على السيرفر —
# app/Http/Controllers/Api/DeployController.php وapp/Enums/ApplicationDeploymentStatus.php،
# عبر `docker exec coolify cat ...`، بلا أي تعديل): شكل الـendpoints صحيح كما هو —
# `GET|POST /api/v1/deploy?uuid=<uuid>` يُرجِع `{"deployments":[{"deployment_uuid":...}]}`،
# و`GET /api/v1/deployments/{deployment_uuid}` يُرجِع كائن ApplicationDeploymentQueue الخام
# (يحوي `.status`). الاستيثاق: `Authorization: Bearer <token>` (Sanctum)؛ التوكن يحتاج صلاحيتَي
# `deploy` و`read` على الأقل (وسوم `api.ability:*` في routes/api.php). القيم الفعلية لـ.status
# (enum ApplicationDeploymentStatus): queued, in_progress, finished, failed, cancelled-by-user —
# **وليس** `cancelled` كما كان مكتوبًا هنا سابقًا؛ صُحِّح أدناه.

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
    failed | cancelled-by-user)
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
