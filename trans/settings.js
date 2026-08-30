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
    
    A.alert($("#settingsMsg"), "جاري تحديث وتعميم حالة البوابة على السحابة وقواعد البيانات...", "info");
    lockSwitch.disabled = true;

    try {
      // Persist to Google Sheets so ALL mobile phones, tablets and PCs receive the lock!
      await A.api({
        action: "class_setting",
        gradeCode: "PORTAL",
        classNo: "STATUS",
        available: !isLocked,
        staffName: S.staff,
        classNote: isLocked ? "PORTAL_LOCKED" : "PORTAL_OPEN"
      });

      if (isLocked) {
        A.alert($("#settingsMsg"), "تم إغلاق بوابة الطالب بنجاح وتعميم الإغلاق سحابياً على جميع الأجهزة والجوالات.", "warning");
      } else {
        A.alert($("#settingsMsg"), "تم فتح بوابة الطالب وتعميم الإتاحة سحابياً على جميع الأجهزة والجوالات.", "success");
      }
    } catch (err) {
      A.alert($("#settingsMsg"), "تحذير: تم الحفظ محلياً ولكن تعذر التحديث السحابي: " + err.message, "error");
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
      const s = d.summary || {};
      
      // If backend has portalLocked property, sync with it!
      if (typeof s.portalLocked === "boolean") {
        localStorage.setItem("transfer_portal_locked", s.portalLocked ? "true" : "false");
        if (lockSwitch) lockSwitch.checked = s.portalLocked;
        updateBadge(s.portalLocked);
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