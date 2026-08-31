(() => {
  "use strict";
  const A = window.AdminApp;
  const $ = A.qs;
  const all = A.qsa;
  
  let DATA = null;
  let GRADE = null;
  let selected = null;

  const login = $("#loginOverlay");
  const cached = A.session();

  if (cached.key && cached.staff) {
    $("#keyInput").value = cached.key;
    $("#staffInput").value = cached.staff;
    loginNow(cached.key, cached.staff);
  }

  $("#loginForm").addEventListener("submit", e => {
    e.preventDefault();
    loginNow($("#keyInput").value.trim(), $("#staffInput").value.trim());
  });

  async function loginNow(key, staff) {
    if (!key || !staff) {
      A.alert($("#loginMsg"), "يرجى إدخال مفتاح الوصول واسم الموظف.", "error");
      return;
    }
    A.alert($("#loginMsg"), "جاري التحقق من الصلاحيات والاتصال...", "info");
    try {
      DATA = await A.api({ action: "dashboard" }, key);
      A.saveSession(key, staff);
      login.classList.add("hidden");
      A.shell("dashboard", "لوحة التحكم المركزية");
      render();
    } catch (e) {
      A.alert($("#loginMsg"), e.message, "error");
    }
  }

  $("#refreshBtn").addEventListener("click", load);

  async function load() {
    A.alert($("#pageMsg"), "جاري تحديث البيانات من السجلات...", "info");
    try {
      DATA = await A.api({ action: "dashboard" });
      render();
      A.alert($("#pageMsg"), `تم تحديث البيانات بنجاح · ${DATA.generatedAt || ""}`, "success");
    } catch (e) {
      A.alert($("#pageMsg"), e.message, "error");
    }
  }

  function kpi(title, value, icon, bg = "") {
    return `
      <article class="kpi">
        <div class="kpi-top">
          <span>${title}</span>
          <div class="kpi-icon" style="${bg ? `background:${bg}` : ""}">
            ${A.icon(icon)}
          </div>
        </div>
        <strong>${A.num(value)}</strong>
      </article>
    `;
  }

  // Detect mutual swap pairs (e.g. Student A: 1->4 and Student B: 4->1)
  function detectMutualSwaps(requests) {
    const swapMap = new Map();
    const pendingList = requests.filter(r => r.status === "قيد المراجعة");

    for (let i = 0; i < pendingList.length; i++) {
      const a = pendingList[i];
      for (let j = i + 1; j < pendingList.length; j++) {
        const b = pendingList[j];
        if (
          a.grade === b.grade &&
          a.fromClass === b.toClass &&
          a.toClass === b.fromClass
        ) {
          swapMap.set(a.requestId, b);
          swapMap.set(b.requestId, a);
        }
      }
    }
    return swapMap;
  }

  function render() {
    if (!DATA) return;
    const s = DATA.summary || {};
    
    $("#kpis").innerHTML = 
      kpi("إجمالي الطلاب", s.totalStudents, "users") +
      kpi("طلبات النقل", s.totalRequests, "requests") +
      kpi("قيد المراجعة", s.pending, "clock", "#fffbeb;color:#d97706") +
      kpi("مقبول", s.approved, "check", "#ecfdf5;color:#059669") +
      kpi("مرفوض", s.rejected, "x", "#fef2f2;color:#dc2626");

    const gs = ["الكل", ...Object.keys(DATA.classManagement || {})];
    GRADE = gs.includes(GRADE) ? GRADE : "الكل";

    $("#gradeTabs").innerHTML = gs.map(g => `
      <button class="grade-tab ${g === GRADE ? "active" : ""}" data-grade="${A.esc(g)}">${A.esc(g)}</button>
    `).join("");

    all(".grade-tab").forEach(b => {
      b.addEventListener("click", () => {
        GRADE = b.dataset.grade;
        renderBalance();
        renderRequests();
        all(".grade-tab").forEach(x => x.classList.toggle("active", x === b));
      });
    });

    renderBalance();
    renderRequests();
  }

  function renderBalance() {
    if (!DATA || !DATA.classManagement) return;

    if (GRADE === "الكل") {
      const allCards = [];
      for (const [gradeName, g] of Object.entries(DATA.classManagement)) {
        const max = Math.max(...Object.values(g.classes).map(c => c.count), 1);
        const cards = Object.values(g.classes)
          .sort((a, b) => Number(a.classNo) - Number(b.classNo))
          .map(c => {
            const d = Number(c.delta);
            return `
              <div class="class-stat" style="${!c.available ? "opacity:0.65;border-style:dashed" : ""}">
                <div class="class-stat-head">
                  <div>
                    <small style="color:var(--primary);font-weight:800">${A.esc(gradeName)}</small>
                    <strong style="display:block">الفصل ${c.classNo}</strong>
                  </div>
                  <div style="text-align:left">
                    <span style="font-size:17px;font-weight:900;color:var(--navy-950)">${A.num(c.count)}</span>
                    <span class="delta ${c.excluded ? "ok" : d > 0 ? "need" : d < 0 ? "extra" : "ok"}" style="display:block;margin-top:2px">
                      ${c.excluded ? "مستبعد" : d > 0 ? `يحتاج ${A.num(d)}` : d < 0 ? `فائض ${A.num(Math.abs(d))}` : "متوازن"}
                    </span>
                  </div>
                </div>
                <div class="progress">
                  <i style="width:${Math.min(100, (c.count / max) * 100)}%"></i>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text-muted);margin-top:4px">
                  <span>الهدف: <b>${A.num(c.target)}</b></span>
                  <span>${!c.available ? "مغلق للنقل" : "متاح للنقل"}</span>
                </div>
              </div>
            `;
          }).join("");
        allCards.push(cards);
      }
      $("#balanceGrid").innerHTML = allCards.join("");
      return;
    }

    const g = DATA.classManagement?.[GRADE];
    if (!g) return;
    
    const max = Math.max(...Object.values(g.classes).map(c => c.count), 1);
    
    $("#balanceGrid").innerHTML = Object.values(g.classes)
      .sort((a, b) => Number(a.classNo) - Number(b.classNo))
      .map(c => {
        const d = Number(c.delta);
        return `
          <div class="class-stat" style="${!c.available ? "opacity:0.65;border-style:dashed" : ""}">
            <div class="class-stat-head">
              <div>
                <small>الشعبة / الفصل</small>
                <strong>${c.classNo}</strong>
              </div>
              <div style="text-align:left">
                <span style="font-size:18px;font-weight:900;color:var(--navy-950)">${A.num(c.count)}</span>
                <span class="delta ${c.excluded ? "ok" : d > 0 ? "need" : d < 0 ? "extra" : "ok"}" style="display:block;margin-top:2px">
                  ${c.excluded ? "مستبعد" : d > 0 ? `يحتاج ${A.num(d)}` : d < 0 ? `فائض ${A.num(Math.abs(d))}` : "متوازن"}
                </span>
              </div>
            </div>
            <div class="progress">
              <i style="width:${Math.min(100, (c.count / max) * 100)}%"></i>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text-muted);margin-top:4px">
              <span>الهدف: <b>${A.num(c.target)}</b></span>
              <span>${!c.available ? "مغلق للنقل" : "متاح للنقل"}</span>
            </div>
          </div>
        `;
      }).join("");
  }

  $("#statusFilter").addEventListener("change", renderRequests);
  $("#searchInput").addEventListener("input", renderRequests);

  function renderRequests() {
    if (!DATA) return;
    const f = $("#statusFilter").value;
    const t = $("#searchInput").value.trim().toLowerCase();

    const swapMap = detectMutualSwaps(DATA.requests || []);

    const rows = (DATA.requests || []).filter(r => {
      const matchGrade = (GRADE === "الكل" || r.grade === GRADE || (DATA.classManagement?.[GRADE] && r.gradeCode === DATA.classManagement[GRADE].code));
      const matchStatus = (f === "الكل" || r.status === f);
      const matchSearch = (!t || `${r.name} ${r.studentId} ${r.requestId}`.toLowerCase().includes(t));
      return matchGrade && matchStatus && matchSearch;
    });

    if (!rows.length) {
      $("#requestsBody").innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">لا توجد طلبات مطابقة لمعايير البحث الحالية.</td></tr>`;
      return;
    }

    $("#requestsBody").innerHTML = rows.map(r => {
      const mutualPartner = swapMap.get(r.requestId);
      return `
        <tr style="${mutualPartner ? "background:#fdfaf2" : ""}">
          <td>
            <b style="font-family:monospace">${A.esc(r.requestId)}</b>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${A.esc(r.date)}</div>
          </td>
          <td>
            <b>${A.esc(r.name)}</b>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${A.esc(r.studentId)}</div>
          </td>
          <td>${A.esc(r.grade)}</td>
          <td>
            <span style="font-weight:700">الفصل ${A.esc(r.fromClass)}</span>
            <span style="color:var(--primary);margin:0 4px">←</span>
            <span style="font-weight:800;color:var(--primary)">الفصل ${A.esc(r.toClass)}</span>
            
            ${mutualPartner ? `
              <div style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:800;margin-top:4px;border:1px solid #fde68a">
                🔄 تبادل مقاعد مباشر مع: ${A.esc(mutualPartner.name)}
              </div>
            ` : ""}

            ${!mutualPartner && r.suggestedClass && r.suggestedClass !== r.toClass ? `
              <div style="font-size:10px;color:#d97706;margin-top:2px">المقترح للموازنة: الفصل ${A.esc(r.suggestedClass)}</div>
            ` : ""}
          </td>
          <td><small>${A.esc(r.reason)}</small></td>
          <td>
            <span class="badge ${mutualPartner ? "good" : A.balanceClass(r.balanceLabel)}">
              ${mutualPartner ? "متوازن (تبادل مباشر)" : A.esc(r.balanceLabel)}
            </span>
          </td>
          <td><span class="badge ${A.statusClass(r.status)}">${A.esc(r.status)}</span></td>
          <td>
            ${r.status === "قيد المراجعة" ? `
              <div class="action-row">
                <button class="mini approve" data-id="${A.esc(r.requestId)}">اعتماد</button>
                <button class="mini reject" data-id="${A.esc(r.requestId)}">رفض</button>
              </div>
            ` : `
              <small style="color:var(--text-muted)">${A.esc(r.approvedBy || "—")}</small>
            `}
          </td>
        </tr>
      `;
    }).join("");

    all(".mini").forEach(b => {
      b.addEventListener("click", () => openDecision(b.dataset.id, b.classList.contains("approve") ? "approve" : "reject"));
    });
  }

  function openDecision(id, decision) {
    selected = { id, decision };
    const r = DATA.requests.find(x => x.requestId === id);
    if (!r) return;

    const swapMap = detectMutualSwaps(DATA.requests || []);
    const partner = swapMap.get(id);

    $("#decisionTitle").textContent = decision === "approve" ? "اعتماد طلب النقل وتحديث الفصل" : "رفض طلب النقل";
    
    let swapNotice = "";
    if (partner && decision === "approve") {
      $("#approvePairBtn")?.classList.remove("hidden");
      $("#approvePairBtn").textContent = `🔄 اعتماد التبادل مع ${partner.name} معاً`;
      swapNotice = `
        <div style="margin-top:12px;padding:12px;background:#fef3c7;border:1.5px solid #fde68a;border-radius:12px;color:#92400e;font-size:12px;font-weight:700">
          🔄 تنبيه التبادل المباشر: هذا الطالب لديه طلب تبادلي متطابق مع الطالب <b>${A.esc(partner.name)}</b> (من ${partner.fromClass} إلى ${partner.toClass}).
          يمكنك الضغط على زر «اعتماد التبادل للطالبين معاً» ليقوم النظام بتحديث فصلي الطالبين معاً في Google Sheets فوراً والحفاظ على توازن الشعب 100%!
        </div>
      `;
    } else {
      $("#approvePairBtn")?.classList.add("hidden");
    }

    const g = DATA.classManagement ? DATA.classManagement[r.grade] : null;
    const fromClassObj = g && g.classes ? g.classes[r.fromClass] : null;
    const toClassObj = g && g.classes ? g.classes[r.toClass] : null;

    const fromCountCurrent = fromClassObj ? fromClassObj.count : (Number(r.fromClassCount) || 0);
    const toCountCurrent = toClassObj ? toClassObj.count : (Number(r.toClassCount) || 0);

    const fromCountAfter = Math.max(0, fromCountCurrent - 1);
    const toCountAfter = toCountCurrent + 1;

    const fromTarget = fromClassObj ? fromClassObj.target : "—";
    const toTarget = toClassObj ? toClassObj.target : "—";

    $("#decisionInfo").innerHTML = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-size:15px;color:var(--navy-950)">${A.esc(r.name)}</strong>
          <span class="badge ${partner ? "good" : A.balanceClass(r.balanceLabel)}">${partner ? "متوازن (تبادل مباشر)" : A.esc(r.balanceLabel)}</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted)">
          الصف: <b>${A.esc(r.grade)}</b> · من الفصل <b>${A.esc(r.fromClass)}</b> إلى الفصل <b style="color:var(--primary)">${A.esc(r.toClass)}</b>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px">
          سبب الطلب: ${A.esc(r.reason)} ${r.note ? `(${A.esc(r.note)})` : ""}
        </div>

        <div style="background:#f0fdf4;border:1.5px solid #a7f3d0;border-radius:12px;padding:12px 14px;margin-top:12px">
          <div style="font-size:12px;font-weight:900;color:#065f46;margin-bottom:8px">
            📊 أثر الاعتماد اللحظي على أعداد الفصول (وفق أحدث البيانات):
          </div>
          <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center">
            <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;text-align:center">
              <div style="font-size:11px;color:var(--text-muted);font-weight:700">الفصل السابق (${A.esc(r.fromClass)})</div>
              <div style="font-size:13px;font-weight:900;color:#1e293b;margin-top:2px">
                <span>${A.num(fromCountCurrent)}</span> ← <b style="color:#b91c1c">${A.num(fromCountAfter)} طالب</b>
              </div>
              <small style="font-size:10px;color:#64748b">الهدف: ${A.num(fromTarget)}</small>
            </div>
            <div style="font-size:16px;font-weight:900;color:var(--primary)">←</div>
            <div style="background:#ffffff;border:1.5px solid #86efac;border-radius:8px;padding:8px 10px;text-align:center">
              <div style="font-size:11px;color:#047857;font-weight:700">الفصل المطلوب (${A.esc(r.toClass)})</div>
              <div style="font-size:13px;font-weight:900;color:#047857;margin-top:2px">
                <span>${A.num(toCountCurrent)}</span> ← <b style="color:#047857;font-size:14.5px">${A.num(toCountAfter)} طالب</b>
              </div>
              <small style="font-size:10px;color:#047857">الهدف: ${A.num(toTarget)}</small>
            </div>
          </div>
        </div>

        ${swapNotice}
      </div>
    `;
    $("#decisionNote").value = "";
    A.alert($("#decisionMsg"), "", "info");
    $("#decisionModal").classList.remove("hidden");
  }

  $("#cancelDecision").addEventListener("click", () => $("#decisionModal").classList.add("hidden"));
  $("#approveDecision").addEventListener("click", () => decide("approve"));
  $("#rejectDecision").addEventListener("click", () => decide("reject"));
  $("#approvePairBtn")?.addEventListener("click", () => decidePaired());

  async function decide(decision) {
    if (!selected) return;
    
    $("#approveDecision").disabled = $("#rejectDecision").disabled = $("#approvePairBtn").disabled = true;
    A.alert($("#decisionMsg"), "جاري تسجيل القرار في السجلات وتحديث الفصل...", "info");
    
    try {
      const s = A.session();
      await A.api({
        action: "decision",
        requestId: selected.id,
        decision,
        note: $("#decisionNote").value.trim(),
        staffName: s.staff
      });
      $("#decisionModal").classList.add("hidden");
      await load();
    } catch (e) {
      A.alert($("#decisionMsg"), e.message, "error");
    } finally {
      $("#approveDecision").disabled = $("#rejectDecision").disabled = $("#approvePairBtn").disabled = false;
    }
  }

  async function decidePaired() {
    if (!selected) return;
    const swapMap = detectMutualSwaps(DATA.requests || []);
    const partner = swapMap.get(selected.id);
    if (!partner) return decide("approve");

    $("#approveDecision").disabled = $("#rejectDecision").disabled = $("#approvePairBtn").disabled = true;
    A.alert($("#decisionMsg"), "جاري اعتماد ونقل الطالبين معاً وتحديث فصولهما...", "info");

    try {
      const s = A.session();
      const userNote = $("#decisionNote").value.trim();
      
      // Step 1: Approve Student A
      await A.api({
        action: "decision",
        requestId: selected.id,
        decision: "approve",
        note: userNote || "اعتماد بالتبادل المباشر",
        staffName: s.staff
      });

      // Step 2: Approve Student B (Paired partner)
      await A.api({
        action: "decision",
        requestId: partner.requestId,
        decision: "approve",
        note: userNote || "اعتماد بالتبادل المباشر",
        staffName: s.staff
      });

      $("#decisionModal").classList.add("hidden");
      A.alert($("#pageMsg"), `تم بنجاح اعتماد التبادل للطالبين (${selected.id} و ${partner.requestId}) وتحديث فصليهما معاً دون أي اختلال في الموازنة!`, "success");
      await load();
    } catch (e) {
      A.alert($("#decisionMsg"), "خطأ أثناء الاعتماد المزدوج: " + e.message, "error");
    } finally {
      $("#approveDecision").disabled = $("#rejectDecision").disabled = $("#approvePairBtn").disabled = false;
    }
  }

})();