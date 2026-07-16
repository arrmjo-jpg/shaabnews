#!/usr/bin/env bash
# =====================================================================
# مراقبة php-fpm الحيّة — شغّله أثناء k6-load-test.js لربط VUs برقم
# "active processes" الفعلي، وحسم سؤال "هل نصل فعلاً لسقف 30؟" بالأرقام.
# =====================================================================
# المتطلبات: صفحة الحالة مفعّلة (انظر 01-enable-status-page.md)، وjq مثبّت.
#
# الاستخدام:
#   ./monitor-fpm.sh http://127.0.0.1/fpm-status 2
#   (رابط، ثم فترة التحديث بالثواني)

set -euo pipefail

STATUS_URL="${1:-http://127.0.0.1/fpm-status}"
INTERVAL="${2:-2}"
LOG_FILE="${3:-fpm-monitor-$(date +%Y%m%d-%H%M%S).csv}"

echo "timestamp,active_processes,idle_processes,total_processes,listen_queue,max_children,max_listen_queue,slow_requests" > "$LOG_FILE"
echo "يسجّل في: $LOG_FILE — افتحه لاحقاً في أي أداة رسم بياني (حتى Excel/Sheets يكفي)."
echo ""

while true; do
  raw=$(curl -s "${STATUS_URL}?json&full" || echo "{}")

  active=$(echo "$raw" | jq -r '."active processes" // "n/a"')
  idle=$(echo "$raw" | jq -r '."idle processes" // "n/a"')
  total=$(echo "$raw" | jq -r '."total processes" // "n/a"')
  listen_queue=$(echo "$raw" | jq -r '."listen queue" // "n/a"')
  max_children=$(echo "$raw" | jq -r '."max children reached" // "n/a"')
  max_listen_queue=$(echo "$raw" | jq -r '."max listen queue" // "n/a"')
  slow=$(echo "$raw" | jq -r '."slow requests" // "n/a"')

  ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "${ts},${active},${idle},${total},${listen_queue},${max_children},${max_listen_queue},${slow}" >> "$LOG_FILE"

  # تنبيه فوري على الشاشة إن اقتربنا فعلاً من السقف 30 (لا نظرياً):
  warn=""
  if [[ "$active" != "n/a" && "$active" -ge 27 ]]; then
    warn="  ⚠️  اقتراب فعلي من سقف pm.max_children=30 — هذا دليل قياس حقيقي الآن"
  fi

  printf "%s | active=%-4s idle=%-4s listen_queue=%-4s max_children_reached=%-4s%s\n" \
    "$ts" "$active" "$idle" "$listen_queue" "$max_children" "$warn"

  sleep "$INTERVAL"
done

# =====================================================================
# تفسير النتائج:
#  - "max children reached" > 0 هو **الدليل القاطع** (لا الاستنتاج) على أن
#    الخادم فعلاً اصطدم بسقف 30 عملية في مرحلة ما منذ آخر إعادة تشغيل —
#    هذا الرقم تراكمي، فراقب تغيّره أثناء اختبار الحمل تحديداً لعزل السبب.
#  - "listen queue" > 0 يعني طلبات تنتظر خارج أي عملية FPM — علامة تشبّع
#    حقيقية إضافية حتى لو "active" لم يصل بعد لـ30.
#  - قارن توقيت ظهور هذه التنبيهات مع مرحلة k6 (100/1000/10000 VU) لتحديد
#    نقطة الانهيار الفعلية بدقة، لا تقديرها بصيغة Little's Law النظرية.
# =====================================================================
