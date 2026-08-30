(() => {
  "use strict";
  const API = window.APP_CONFIG.studentApi;
  const $ = s => document.querySelector(s);
  let current = null;

  function show(el, text, type = "info") {
    if (!el) return;
    el.textContent = text || "";
    el.className = `alert ${type}${text ? "" : " hidden"}`;
  }

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  async function post(body) {
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) {
      throw new Error(d.message || "تعذر تنفيذ العملية.");
    }
    return d;
  }

  // Check Portal Lock State
  async function checkPortalLock() {
    let isLocked = localStorage.getItem("transfer_portal_locked") === "true";
    
    // Apply immediate local state first
    applyLockUI(isLocked);

    // Asynchronously fetch centralized state (syncs with Mobile & all devices in real-time)
    try {
      const res = await fetch("/api/portal-status").then(r => r.json());
      if (res && typeof res.locked === "boolean") {
        isLocked = res.locked;
        localStorage.setItem("transfer_portal_locked", isLocked ? "true" : "false");
        applyLockUI(isLocked);
      }
    } catch (e) {}
  }

  function applyLockUI(isLocked) {
    const lockView = $("#lockView");
    const newView = $("#newView");
    const livePill = document.querySelector(".live-pill");
    const isNewTabActive = document.querySelector('.portal-tab[data-tab="new"]')?.classList.contains("active");

    if (isLocked) {
      if (isNewTabActive) {
        lockView?.classList.remove("hidden");
        newView?.classList.add("hidden");
      }
      if (livePill) {
        livePill.innerHTML = `<span class="live-dot" style="background:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,0.25)"></span> الخدمة مغلقة مؤقتاً`;
        livePill.style.borderColor = "rgba(239, 68, 68, 0.4)";
      }
    } else {
      lockView?.classList.add("hidden");
      if (isNewTabActive) {
        newView?.classList.remove("hidden");
      }
      if (livePill) {
        livePill.innerHTML = `<span class="live-dot"></span> الخدمة متاحة`;
        livePill.style.borderColor = "rgba(255, 255, 255, 0.15)";
      }
    }
  }

  checkPortalLock();

  // Lock button -> switch to track
  $("#lockTrackBtn")?.addEventListener("click", () => {
    document.querySelectorAll(".portal-tab").forEach(x => x.classList.toggle("active", x.dataset.tab === "track"));
    $("#lockView")?.classList.add("hidden");
    $("#newView")?.classList.add("hidden");
    $("#trackView")?.classList.remove("hidden");
    $("#trackId")?.focus();
  });

  // Tabs
  document.querySelectorAll(".portal-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".portal-tab").forEach(x => x.classList.toggle("active", x === btn));
      const isLocked = localStorage.getItem("transfer_portal_locked") === "true";
      
      if (btn.dataset.tab === "new") {
        $("#trackView")?.classList.add("hidden");
        if (isLocked) {
          $("#lockView")?.classList.remove("hidden");
          $("#newView")?.classList.add("hidden");
        } else {
          $("#lockView")?.classList.add("hidden");
          $("#newView")?.classList.remove("hidden");
        }
      } else {
        $("#lockView")?.classList.add("hidden");
        $("#newView")?.classList.add("hidden");
        $("#trackView")?.classList.remove("hidden");
      }
    });
  });

  // Lookup Student
  async function lookup() {
    const id = $("#studentId").value.trim();
    if (!id) {
      show($("#lookupMsg"), "يرجى إدخال رقم الطالب / الهوية الوطنية.", "error");
      return;
    }
    
    $("#lookupBtn").disabled = true;
    show($("#lookupMsg"), "جاري التحقق من بيانات وسجل الطالب...", "info");
    
    try {
      // Fetch student data and request history in parallel
      const [lookupRes, statusRes] = await Promise.all([
        post({ action: "lookup", studentId: id }),
        post({ action: "status", studentId: id }).catch(() => ({ requests: [] }))
      ]);

      current = lookupRes.student;
      const history = statusRes.requests || [];
      
      $("#studentName").textContent = current.name;
      $("#studentGrade").textContent = current.grade;
      $("#studentClass").textContent = `الفصل ${current.class}`;

      const activePending = history.find(r => r.status === "قيد المراجعة");
      const approvedReq = history.find(r => r.status === "مقبول");
      const rejectedReq = history.find(r => r.status === "مرفوض");

      const noticeArea = $("#studentNoticeArea");
      const transferForm = $("#transferForm");
      noticeArea.innerHTML = "";

      if (activePending) {
        // CASE A: Existing Pending Request -> Block form and show pending card
        transferForm.classList.add("hidden");
        noticeArea.innerHTML = `
          <div class="status-notice-card pending">
            <div class="notice-header">
              <div class="notice-icon-box">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <h3>يوجد لديك طلب نقل قيد المعالجة والمراجعة حالياً</h3>
                <small style="color:#b45309;font-weight:700">رقم الطلب: #${esc(activePending.requestId)}</small>
              </div>
            </div>
            <div class="notice-body">
              تم استلام طلب سابق لنقل الطالب من <b>الفصل ${esc(activePending.fromClass)}</b> إلى <b>الفصل ${esc(activePending.toClass)}</b> بتاريخ <b>${esc(activePending.date)}</b> لسبب (${esc(activePending.reason)}).
            </div>
            <div class="notice-meta-grid">
              <div class="notice-meta-pill">الفصل الحالي: <b>الفصل ${esc(activePending.fromClass)}</b></div>
              <div class="notice-meta-pill">الفصل المطلوب: <b style="color:var(--primary)">الفصل ${esc(activePending.toClass)}</b></div>
              <div class="notice-meta-pill">حالة الطلب: <b style="color:#d97706">تحت دراسة اللجنة</b></div>
            </div>
            <div class="notice-footer-hint">
              لا يمكن تقديم طلب نقل جديد حتى تصدر الإدارة قرارها النهائي. يمكنك متابعة حالة الطلب من تبويب «متابعة حالة الطلبات».
            </div>
          </div>
        `;
        show($("#lookupMsg"), "تم التحقق من بيانات الطالب (لديه طلب نقل قائم قيد المعالجة).", "warning");

      } else if (approvedReq) {
        // CASE B: Already Approved -> Block form and show apologize notice
        transferForm.classList.add("hidden");
        noticeArea.innerHTML = `
          <div class="status-notice-card approved">
            <div class="notice-header">
              <div class="notice-icon-box">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <h3>تمت الاستفادة من خدمة النقل سابقاً لهذا العام</h3>
                <small style="color:#047857;font-weight:700">طلب معتمد برقم: #${esc(approvedReq.requestId)}</small>
              </div>
            </div>
            <div class="notice-body">
              نعتذر، لقد تم قبول واعتماد نقل الطالب مسبقاً لهذا العام الدراسي من <b>الفصل ${esc(approvedReq.fromClass)}</b> إلى <b>الفصل ${esc(approvedReq.toClass)}</b> بتاريخ <b>${esc(approvedReq.decisionDate || approvedReq.date)}</b>.
            </div>
            <div class="notice-footer-hint">
              تمنح إدارة المدرسة فرصة نقل واحدة معتمدة لكل طالب خلال العام لضمان استقرار الشعب والموازنة التعليمية.
            </div>
          </div>
        `;
        show($("#lookupMsg"), "تمت الاستفادة من خدمة النقل مسبقاً لهذا الطالب.", "info");

      } else {
        // CASE C & D: Can submit new request (First time or previously rejected)
        transferForm.classList.remove("hidden");

        if (rejectedReq) {
          noticeArea.innerHTML = `
            <div class="alert info" style="margin-bottom:18px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>تنبيه: تم رفض طلبك السابق رقم (<b>#${esc(rejectedReq.requestId)}</b>). يُتاح لك الآن اختيار فصل متاح آخر وإعادة تقديم طلب جديد.</span>
            </div>
          `;
        }

        const arr = current.availableClasses || [];
        $("#targetClass").innerHTML = arr.length
          ? `<option value="">اختر الفصل المطلوب</option>${arr.map(c => `<option value="${esc(c)}">الفصل ${esc(c)}</option>`).join("")}`
          : `<option value="">لا توجد فصول متاحة للنقل حالياً</option>`;
        
        $("#targetClass").disabled = !arr.length;
        $("#submitBtn").disabled = !arr.length;

        show(
          $("#lookupMsg"),
          arr.length
            ? "تم التحقق من بيانات الطالب بنجاح. يمكنك الآن اختيار الفصل المطلوب."
            : "بيانات الطالب صحيحة، ولكن جميع الفصول الأخرى مكتملة أو مغلقة حالياً.",
          arr.length ? "success" : "warning"
        );
      }

      $("#studentPanel").classList.remove("hidden");
      $("#successView").classList.add("hidden");

    } catch (e) {
      current = null;
      $("#studentPanel").classList.add("hidden");

      if (e.message && (e.message.includes("مغلقة") || e.message.includes("قريباً"))) {
        localStorage.setItem("transfer_portal_locked", "true");
        checkPortalLock();
      } else {
        show($("#lookupMsg"), e.message, "error");
      }
    } finally {
      $("#lookupBtn").disabled = false;
    }
  }

  $("#lookupBtn").addEventListener("click", lookup);
  $("#studentId").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookup();
    }
  });

  // Submit Transfer Form
  $("#transferForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!current) return;

    const targetClass = $("#targetClass").value;
    const reason = $("#reason").value;
    const note = $("#studentNote").value.trim();

    if (!targetClass || !reason) {
      show($("#submitMsg"), "يرجى تحديد الفصل المطلوب وسبب طلب النقل.", "error");
      return;
    }

    $("#submitBtn").disabled = true;
    show($("#submitMsg"), "جاري إرسال الطلب وحساب أثر الموازنة...", "info");

    try {
      const d = await post({
        action: "submit",
        studentId: current.studentId,
        targetClass,
        reason,
        note
      });

      $("#requestId").textContent = d.requestId || "تم التسجيل";
      $("#studentPanel").classList.add("hidden");
      $("#successView").classList.remove("hidden");
      show($("#lookupMsg"), "", "info");
    } catch (e) {
      show($("#submitMsg"), e.message, "error");
    } finally {
      $("#submitBtn").disabled = false;
    }
  });

  // Reset
  $("#resetBtn").addEventListener("click", () => {
    current = null;
    $("#successView").classList.add("hidden");
    $("#studentPanel").classList.add("hidden");
    $("#studentId").value = "";
    $("#studentId").focus();
  });

  // Track Requests
  $("#trackBtn").addEventListener("click", async () => {
    const id = $("#trackId").value.trim();
    if (!id) {
      show($("#trackMsg"), "يرجى إدخال رقم الطالب / الهوية.", "error");
      return;
    }

    $("#trackBtn").disabled = true;
    show($("#trackMsg"), "جاري جلب سجل الطلبات...", "info");

    try {
      const d = await post({ action: "status", studentId: id });
      show($("#trackMsg"), "", "info");
      
      const rows = d.requests || [];
      if (!rows.length) {
        $("#trackResults").innerHTML = `
          <div style="text-align:center;padding:24px;background:#f8fafc;border-radius:16px;border:1px solid #e2e8f0;color:#64748b">
            لا توجد طلبات نقل مسجلة لهذا الطالب حتى الآن.
          </div>
        `;
        return;
      }

      $("#trackResults").innerHTML = rows.map(r => `
        <article class="request-card">
          <div class="request-card-head">
            <div>
              <b style="font-size:15px;color:var(--navy-950)">طلب رقم: ${esc(r.requestId)}</b>
              <div style="font-size:11px;color:#64748b;margin-top:2px">تاريخ التقديم: ${esc(r.date)}</div>
            </div>
            <span class="request-badge ${r.status === "مقبول" ? "approved" : r.status === "مرفوض" ? "rejected" : "pending"}">
              ${esc(r.status)}
            </span>
          </div>
          
          <div class="request-meta-grid">
            <div class="request-meta-item">
              الفصل الحالي
              <b>الفصل ${esc(r.fromClass)}</b>
            </div>
            <div class="request-meta-item">
              الفصل المطلوب
              <b style="color:var(--primary)">الفصل ${esc(r.toClass)}</b>
            </div>
            <div class="request-meta-item">
              سبب النقل
              <b>${esc(r.reason)}</b>
            </div>
          </div>

          ${r.managementNote ? `
            <div class="admin-note-box">
              <strong>ملاحظة الإدارة:</strong> ${esc(r.managementNote)}
            </div>
          ` : ""}
        </article>
      `).join("");
    } catch (e) {
      $("#trackResults").innerHTML = "";
      show($("#trackMsg"), e.message, "error");
    } finally {
      $("#trackBtn").disabled = false;
    }
  });

})();