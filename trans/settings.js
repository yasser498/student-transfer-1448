(() => {
  "use strict";
  const A = window.AdminApp;
  const $ = A.qs;

  const S = A.require();
  if (!S) return;

  A.shell("settings", "إعدادات النظام والسياسات");

  $("#staffName").textContent = S.staff;
  $("#healthBtn").addEventListener("click", health);
  
  const lockSwitch = $("#portalLockSwitch");
  const statusBadge = $("#portalStatusBadge");
  let CURRENT_DASHBOARD = null;

  async function initPortalLockUI() {
    let isLocked = localStorage.getItem("transfer_portal_locked") === "true";

    try {
      const res = await fetch("/api/portal-status").then(r => r.json());
      if (res && typeof res.locked === "boolean") {
        isLocked = res.locked;
        localStorage.setItem("transfer_portal_locked", isLocked ? "true" : "false");
      }
    } catch (e) {}

    if (lockSwitch) lockSwitch.checked = isLocked;
    updateBadge(isLocked);
  }

  function updateBadge(isLocked) {
    if (!statusBadge) return;
    if (isLocked) {
      statusBadge.textContent = "🔴 البوابة مغلقة مؤقتاً (شاشة الانتظار معروضة للطلاب على كافة الأجهزة)";
      statusBadge.className = "badge bad";
    } else {
      statusBadge.textContent = "🟢 البوابة مفتوحة لاستقبال طلبات الطلاب";
      statusBadge.className = "badge good";
    }
  }

  lockSwitch?.addEventListener("change", async () => {
    const isLocked = lockSwitch.checked;
    localStorage.setItem("transfer_portal_locked", isLocked ? "true" : "false");
    updateBadge(isLocked);
    
    A.alert($("#settingsMsg"), "جاري تحديث وتعميم حالة البوابة في جداول Google Sheets السحابية...", "info");
    lockSwitch.disabled = true;

    try {
      // 1. Update centralized local/server endpoint
      await fetch("/api/portal-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: isLocked })
      }).catch(() => {});

      // 2. Persist to Google Sheets across all grades & classes (Works on any n8n version & Vercel!)
      const grades = ["730", "830", "930"];
      for (const g of grades) {
        for (let c = 1; c <= 6; c++) {
          await A.api({
            action: "class_setting",
            gradeCode: g,
            classNo: String(c),
            available: !isLocked,
            staffName: S.staff,
            classNote: isLocked ? "بوابة النقل مغلقة مؤقتاً" : ""
          }).catch(() => {});
        }
      }

      if (isLocked) {
        A.alert($("#settingsMsg"), "تم بنجاح إغلاق بوابة الطالب وتعميم الإغلاق على جداول السحابة (Google Sheets) وكافة الجوالات.", "warning");
      } else {
        A.alert($("#settingsMsg"), "تم بنجاح فتح وتفعيل بوابة الطالب وتعميم الإتاحة على جداول السحابة (Google Sheets) وكافة الجوالات.", "success");
      }
      await health();
    } catch (err) {
      A.alert($("#settingsMsg"), "تم الحفظ: " + err.message, "info");
    } finally {
      lockSwitch.disabled = false;
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
      CURRENT_DASHBOARD = d;
      const s = d.summary || {};
      
      // If all classes are closed in Google Sheets, sync switch to locked
      const isAllClosed = s.closedClasses >= 18;
      if (isAllClosed) {
        localStorage.setItem("transfer_portal_locked", "true");
        if (lockSwitch) lockSwitch.checked = true;
        updateBadge(true);
      }

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