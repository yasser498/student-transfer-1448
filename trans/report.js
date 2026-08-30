(() => {
  "use strict";
  const A = window.AdminApp;
  const $ = A.qs;

  const S = A.require();
  if (!S) return;

  A.shell("report", "التقرير النهائي المعتمد");

  $("#preparedBy").textContent = S.staff;
  $("#signName").textContent = S.staff;

  let DATA = null;
  load();

  $("#refreshBtn").addEventListener("click", load);
  $("#printBtn").addEventListener("click", () => window.print());

  async function load() {
    A.alert($("#reportMsg"), "جاري تجميع بيانات التقرير...", "info");
    try {
      DATA = await A.api({ action: "dashboard" });
      render();
      A.alert($("#reportMsg"), "تم تحديث التقرير بنجاح.", "success");
    } catch (e) {
      A.alert($("#reportMsg"), e.message, "error");
    }
  }

  function kpi(t, v) {
    return `
      <article class="kpi" style="padding:14px 18px">
        <span style="font-size:11px;color:var(--text-muted)">${t}</span>
        <strong style="font-size:24px;margin-top:4px">${A.num(v)}</strong>
      </article>
    `;
  }

  function render() {
    if (!DATA) return;
    const s = DATA.summary || {};
    
    $("#generatedAt").textContent = DATA.generatedAt || new Date().toLocaleString("ar-SA");
    $("#reportKpis").innerHTML = 
      kpi("إجمالي الطلاب المسجلين", s.totalStudents) +
      kpi("إجمالي طلبات النقل", s.totalRequests) +
      kpi("طلبات قيد المراجعة", s.pending) +
      kpi("طلبات مقبولة", s.approved) +
      kpi("طلبات مرفوضة", s.rejected);

    $("#classReports").innerHTML = Object.entries(DATA.classManagement || {}).map(([grade, g]) => `
      <div class="report-grade" style="margin-bottom:18px;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
        <div class="report-grade-title" style="background:#f8fafc;padding:12px 16px;font-weight:900;color:var(--navy-950);border-bottom:1px solid #e2e8f0">
          ${A.esc(grade)} · إجمالي طلاب الصف: ${A.num(g.total)} طالب
        </div>
        <div class="table-wrap">
          <table class="table" style="min-width:720px">
            <thead>
              <tr>
                <th>الفصل</th>
                <th>العدد الحالي</th>
                <th>الهدف المقترح</th>
                <th>الهدف المعتمد</th>
                <th>الاحتياج / الفائض</th>
                <th>استقبال النقل</th>
                <th>الموازنة</th>
                <th>الملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(g.classes).sort((a, b) => Number(a.classNo) - Number(b.classNo)).map(c => `
                <tr>
                  <td><b>الفصل ${c.classNo}</b></td>
                  <td><b>${A.num(c.count)}</b></td>
                  <td>${A.num(c.recommendedTarget)}</td>
                  <td><b style="color:var(--primary)">${A.num(c.target)}</b></td>
                  <td>
                    <span class="delta ${c.excluded ? "ok" : c.delta > 0 ? "need" : c.delta < 0 ? "extra" : "ok"}">
                      ${c.excluded ? "مستبعد" : c.delta > 0 ? `يحتاج ${A.num(c.delta)}` : c.delta < 0 ? `فائض ${A.num(Math.abs(c.delta))}` : "متوازن"}
                    </span>
                  </td>
                  <td>${c.available ? '<span style="color:#059669">متاح</span>' : '<span style="color:#dc2626">مغلق</span>'}</td>
                  <td>${c.excluded ? '<span style="color:#d97706">مستبعد</span>' : "داخل في الحساب"}</td>
                  <td><small>${A.esc(c.note || "—")}</small></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `).join("");

    renderPlan();

    const rows = DATA.requests || [];
    $("#reportRows").innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td><b style="font-family:monospace">${A.esc(r.requestId)}</b></td>
        <td>
          <b>${A.esc(r.name)}</b>
          <div style="font-size:11px;color:var(--text-muted)">${A.esc(r.studentId)}</div>
        </td>
        <td>${A.esc(r.grade)}</td>
        <td><b>الفصل ${A.esc(r.fromClass)}</b> ← <b>الفصل ${A.esc(r.toClass)}</b></td>
        <td><small>${A.esc(r.reason)}</small></td>
        <td><span class="badge ${A.balanceClass(r.balanceLabel)}">${A.esc(r.balanceLabel)}</span></td>
        <td><span class="badge ${A.statusClass(r.status)}">${A.esc(r.status)}</span></td>
        <td><small>${A.esc(r.decisionDate || "—")}</small></td>
        <td><small>${A.esc(r.approvedBy || "—")}</small></td>
      </tr>
    `).join("") : `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">لا توجد طلبات مسجلة.</td></tr>`;
  }

  function renderPlan() {
    const plan = [];
    for (const [grade, g] of Object.entries(DATA.classManagement || {})) {
      let donors = Object.values(g.classes).filter(c => !c.excluded && c.count > c.target).map(c => ({ c: c.classNo, n: c.count - c.target }));
      let needs = Object.values(g.classes).filter(c => !c.excluded && c.available && c.count < c.target).map(c => ({ c: c.classNo, n: c.target - c.count }));
      
      let i = 0, j = 0;
      while (i < donors.length && j < needs.length) {
        const n = Math.min(donors[i].n, needs[j].n);
        if (n > 0) plan.push({ grade, from: donors[i].c, to: needs[j].c, n });
        donors[i].n -= n;
        needs[j].n -= n;
        if (!donors[i].n) i++;
        if (!needs[j].n) j++;
      }
    }

    $("#planList").innerHTML = plan.length ? plan.map(x => `
      <div class="plan-item" style="padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;font-size:13px">
        <b>${A.esc(x.grade)}</b>: يُقترح نقل عدد <b>${A.num(x.n)}</b> طالب من <b>الفصل ${x.from}</b> إلى <b>الفصل ${x.to}</b> لتحقيق التوازن الأمثل.
      </div>
    `).join("") : `
      <div class="plan-item" style="padding:12px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;color:#047857;font-size:13px">
        ✓ الفصول متوازنة حالياً وفق الأهداف المحددة ولا تتطلب أي حركة نقل إضافية.
      </div>
    `;
  }

  $("#csvBtn").addEventListener("click", () => {
    if (!DATA) return;
    const rows = [
      ["رقم الطلب", "رقم الطالب", "اسم الطالب", "الصف", "الفصل الحالي", "الفصل المطلوب", "السبب", "الحالة", "تقييم الموازنة", "ملاحظة الإدارة", "تاريخ القرار", "اعتمد بواسطة"],
      ...(DATA.requests || []).map(r => [
        r.requestId, r.studentId, r.name, r.grade, r.fromClass, r.toClass, r.reason, r.status, r.balanceLabel, r.managementNote, r.decisionDate, r.approvedBy
      ])
    ];

    const csv = "\ufeff" + rows.map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `تقرير_طلبات_النقل_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $("#noorActionBtn")?.addEventListener("click", () => {
    if (!DATA) return;
    const approved = (DATA.requests || []).filter(r => r.status === "مقبول");
    if (!approved.length) {
      alert("لا توجد طلبات نقل مقبولة في النظام حالياً للتعديل في نظام نور.");
      return;
    }

    const rows = [
      ["رقم الهوية / الطالب", "اسم الطالب", "الصف الدراسي", "الفصل السابق في نور", "الفصل الجديد المعتمد (يُنقل إليه بنور)", "تاريخ الاعتماد", "معتمد من"],
      ...approved.map(r => [
        r.studentId, r.name, r.grade, r.fromClass, r.toClass, r.decisionDate || r.date, r.approvedBy || "الإدارة"
      ])
    ];

    const csv = "\ufeff" + rows.map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `كشف_تعديلات_الطلاب_المطلوبة_في_نظام_نور_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

})();