#!/usr/bin/env bash
# =====================================================================
# Redis Cache Hit Ratio + عمق الطوابير + استهلاك الذاكرة — قياس فعلي
# =====================================================================
# الغرض: كلا التقريرين السابقين استنتجا أن "معدّل نجاح الكاش هو العامل
# الحاكم الحقيقي" لكن لم يقيساه لأنه غير موجود أصلاً كمقياس — هذا السكربت
# يقيسه مباشرة من نفس خادم Redis الذي يخدم CACHE_STORE وQUEUE_CONNECTION.
#
# الاستخدام:
#   ./cache-hit-ratio.sh                     # قراءة لحظية واحدة
#   ./cache-hit-ratio.sh --watch 5           # تحديث كل 5 ثوانٍ (مثل top)
#   REDIS_HOST=x REDIS_PORT=y REDIS_PASSWORD=z ./cache-hit-ratio.sh
#
# المتطلبات: redis-cli (على نفس شبكة خادم Redis الإنتاجي؛ شغّله من داخل
# الشبكة الداخلية لـ Coolify أو عبر SSH tunnel — لا تعرّض Redis للإنترنت).

set -euo pipefail

REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
REDIS_DB="${REDIS_DB:-0}"

AUTH_ARGS=()
if [[ -n "$REDIS_PASSWORD" && "$REDIS_PASSWORD" != "null" ]]; then
  AUTH_ARGS=(-a "$REDIS_PASSWORD" --no-auth-warning)
fi

RCLI=(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" "${AUTH_ARGS[@]}")

snapshot() {
  local info
  info=$("${RCLI[@]}" INFO stats)
  local hits misses evicted expired
  hits=$(echo "$info" | grep -oP 'keyspace_hits:\K[0-9]+')
  misses=$(echo "$info" | grep -oP 'keyspace_misses:\K[0-9]+')
  evicted=$(echo "$info" | grep -oP 'evicted_keys:\K[0-9]+')
  expired=$(echo "$info" | grep -oP 'expired_keys:\K[0-9]+')

  local total=$((hits + misses))
  local ratio="n/a"
  if [[ "$total" -gt 0 ]]; then
    ratio=$(awk -v h="$hits" -v t="$total" 'BEGIN { printf "%.2f", (h/t)*100 }')
  fi

  local mem_info used_mem max_mem policy
  mem_info=$("${RCLI[@]}" INFO memory)
  used_mem=$(echo "$mem_info" | grep -oP 'used_memory_human:\K.+' | tr -d '\r')
  max_mem=$(echo "$mem_info" | grep -oP 'maxmemory_human:\K.+' | tr -d '\r')
  policy=$(echo "$mem_info" | grep -oP 'maxmemory_policy:\K.+' | tr -d '\r')

  local clients_info connected blocked
  clients_info=$("${RCLI[@]}" INFO clients)
  connected=$(echo "$clients_info" | grep -oP 'connected_clients:\K[0-9]+')
  blocked=$(echo "$clients_info" | grep -oP 'blocked_clients:\K[0-9]+')

  echo "──────────────────────────────────────────────────────────"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "──────────────────────────────────────────────────────────"
  echo "  Cache Hit Ratio      : ${ratio}%   (hits=${hits}, misses=${misses})"
  echo "  Evicted keys (total) : ${evicted}   ⚠️ أي رقم أعلى من صفر يعني أن"
  echo "                          maxmemory ممتلئ ويُسقط بيانات فعلياً"
  echo "  Expired keys (total) : ${expired}"
  echo "  Used memory           : ${used_mem}"
  echo "  Max memory (0=غير محدد): ${max_mem:-0}"
  echo "  Eviction policy       : ${policy:-غير معروف}"
  echo "  Connected clients     : ${connected}"
  echo "  Blocked clients       : ${blocked}   ⚠️ >0 يعني عمليات تنتظر قفل Redis"
  echo ""

  # عمق طابور Laravel الفعلي لكل طابور مُسمّى — يكشف تراكماً حقيقياً بدل الافتراض.
  echo "  عمق الطوابير (Redis lists — قد تختلف تسمية المفاتيح حسب بادئة CACHE_PREFIX):"
  for q in default notifications mail search sitemap ai analytics media cdn-purge; do
    local key="queues:${q}"
    local len
    len=$("${RCLI[@]}" -n "$REDIS_DB" LLEN "$key" 2>/dev/null || echo "0")
    printf "    %-16s %s\n" "$q" "$len"
  done
  echo ""
}

if [[ "${1:-}" == "--watch" ]]; then
  interval="${2:-5}"
  while true; do
    clear
    snapshot
    sleep "$interval"
  done
else
  snapshot
fi

# =====================================================================
# تفسير النتائج:
#  - Cache Hit Ratio < 85-90% على مسار قراءة عام يستحق تحقيقاً: يعني
#    نسبة كبيرة من الطلبات تدفع تكلفة الحساب الكاملة (بما فيها COUNT
#    المحتمل 1.4 ثانية) بدل الاستفادة من CachedRead.php.
#  - evicted_keys > 0 يعني Redis يحذف مفاتيحاً قسراً لأن maxmemory ممتلئ —
#    هذا قد يُفسّر تدهوراً في الأداء لم يذكره أي تقرير سابق لأنه غير مرئي
#    من الكود إطلاقاً (سلوك وقت التشغيل فقط).
#  - عمق طابور > بضع مئات في أي طابور يعني تراكماً فعلياً يؤكد أو ينفي
#    فينding "عامل طابور واحد يخدم 7 طوابير" من التقرير الأول بالأرقام.
# =====================================================================
