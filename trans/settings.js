(() => {
  "use strict";
  const A = window.AdminApp;
  const $ = A.qs;

  const S = A.require();
  if (!S) return;

  A.shell("settings", "إعدادات النظام والسياسات");

  $("#staffName").textContent = S.staff;
  $("#healthBtn").addEventListener("click", health);
  
  // Portal Lock Switch handler
  const lockSwitch = $("#portalLockSwitch");
  const statusBadge = $("#portalStatusBadge");

  function initPortalLockUI() {
    const isLocked = localStorage.getItem("transfer_portal_locked") === "true";
    if (lockSwitch) lockSwitch.checked = isLocked;
    updateBadge(isLocked);
  }

  function updateBadge(isLocked) {
    if (!statusBadge) return;
    if (isLocked) {
      statusBadge.textContent = "🔴 البوابة مغلقة مؤقتاً (شاشة الانتظار معروضة للطلاب)";
      statusBadge.className = "badge bad";
    } else {
      statusBadge.textContent = "🟢 البوابة مفتوحة لاستقبال طلبات الطلاب";
      statusBadge.className = "badge good";
    }
  }

  lockSwitch?.addEventListener("change", () => {
    const isLocked = lockSwitch.checked;
    localStorage.setItem("transfer_portal_locked", isLocked ? "true" : "false");
    updateBadge(isLocked);
    
    if (isLocked) {
      A.alert($("#settingsMsg"), "تم إغلاق بوابة الطالب مؤقتاً بنجاح. ستظهر للطلاب شاشة بلورية عائمة بعبارة «سوف يُتاح الموقع قريباً للنقل».", "warning");
    } else {
      A.alert($("#settingsMsg"), "تم فتح وتفعيل بوابة الطالب لاستقبال طلبات النقل بنجاح.", "success");
    }
  });

  initPortalLockUI();
  health();

  function kpi(t, v) {
    return `
      <article class="kpi" style="padding:14px 18px">
        <span style="font-size:11px;color:var(--text-muted)">${t}</span>
        <strong style="font-size:24px;margin-top:4px">${A.num(v)}</strong>
      </article>
    `;
  }

  async function health() {
    A.alert($("#settingsMsg"), "جاري فحص الاتصال وقراءة حالة السجلات...", "info");
    try {
      const d = await A.api({ action: "dashboard" });
      const s = d.summary || {};
      
      $("#healthKpis").innerHTML = 
        kpi("إجمالي الطلاب", s.totalStudents) +
        kpi("طلبات النقل", s.totalRequests) +
        kpi("قيد المراجعة", s.pending) +
        kpi("فصول مغلقة", s.closedClasses) +
        kpi("فصول مستبعدة", s.excludedClasses);

      A.alert($("#settingsMsg"), `الاتصال بجميع الخدمات وقواعد البيانات يعمل بنجاح تام · ${d.generatedAt || ""}`, "success");
    } catch (e) {
      A.alert($("#settingsMsg"), e.message, "error");
    }
  }

})();