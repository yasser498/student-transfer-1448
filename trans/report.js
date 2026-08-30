(() => {
  "use strict";
  const A = window.AdminApp;
  const $ = A.qs;

  const S = A.require();
  if (!S) return;

  A.shell("report", "التقرير النهائي المعتمد");

  $("#signName").textContent = S.staff;

  let DATA = null;
  load();

  $("#refreshBtn").addEventListener("click", load);
  $("#printBtn").addEventListener("click", () => {
    document.body.classList.remove("printing-noor");
    document.body.classList.remove("printing-requests");
    window.print();
  });

  // Noor Print Modal
  $("#printNoorSheetBtn").addEventListener("click", openNoorPrintModal);
  $("#triggerPrintNoor").addEventListener("click", () => {
    document.body.classList.remove("printing-requests");
    document.body.classList.add("printing-noor");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-noor"), 1000);
  });
  $("#closeNoorModal").addEventListener("click", () => $("#noorPrintModal").classList.add("hidden"));

  // Requests Register Print Modal
  $("#printRequestsSheetBtn").addEventListener("click", openRequestsPrintModal);
  $("#triggerPrintRequests").addEventListener("click", () => {
    document.body.classList.remove("printing-noor");
    document.body.classList.add("printing-requests");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-requests"), 1000);
  });
  $("#closeRequestsModal").addEventListener("click", () => $("#requestsPrintModal").classList.add("hidden"));

  async function load() {
    A.alert($("#reportMsg"), "جاري تجميع وإعداد التقرير الرسمي...", "info");
    try {
      DATA = await A.api({ action: "dashboard" });
      render();
      A.alert($("#reportMsg"), "تم تحديث بيانات التقرير بنجاح.", "success");
    } catch (e) {
      A.alert($("#reportMsg"), e.message, "error");
    }
  }

  function kpiBox(title, val) {
    return `
      <div class="report-kpi-box">
        <span>${title}</span>
        <strong>${A.num(val)}</strong>
      </div>
    `;
  }

  function render() {
    if (!DATA) return;
    const s = DATA.summary || {};
    
    const now = new Date();
    const dateStr = now.toLocaleDateString("ar-SA");
    const timeStr = now.toLocaleTimeString("ar-SA", { hour: '2-digit', minute: '2-digit' });

    $("#generatedAtDate").textContent = dateStr;
    $("#generatedAtTime").textContent = timeStr;

    // Render KPIs (Section 1)
    $("#reportKpis").innerHTML = 
      kpiBox("إجمالي الطلاب المسجلين", s.totalStudents) +
      kpiBox("إجمالي طلبات النقل", s.totalRequests) +
      kpiBox("طلبات قيد المراجعة", s.pending) +
      kpiBox("طلبات مقبولة معتمدة", s.approved) +
      kpiBox("طلبات مرفوضة", s.rejected);

    // Render Class Reports (Section 2) - Fitted 100% with no scroll
    $("#classReports").innerHTML = Object.entries(DATA.classManagement || {}).map(([grade, g]) => `
      <div class="report-grade" style="margin-bottom:14px;page-break-inside:avoid">
        <div style="background:#f1f5f9;padding:6px 10px;font-weight:900;font-size:12px;color:var(--navy-950);border:1px solid #cbd5e1;border-bottom:0;border-radius:4px 4px 0 0">
          ${A.esc(grade)} · إجمالي طلاب الصف: ${A.num(g.total)} طالب
        </div>
        <div class="table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th style="width:12%">الفصل</th>
                <th style="width:11%">العدد الحالي</th>
                <th style="width:11%">الهدف المقترح</th>
                <th style="width:11%">الهدف المعتمد</th>
                <th style="width:17%">الاحتياج / الفائض</th>
                <th style="width:12%">استقبال النقل</th>
                <th style="width:12%">الموازنة</th>
                <th style="width:14%">الملاحظات</th>
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
                  <td>${c.available ? '<span style="color:#059669;font-weight:800">متاح</span>' : '<span style="color:#dc2626;font-weight:800">مغلق</span>'}</td>
                  <td>${c.excluded ? '<span style="color:#d97706;font-weight:800">مستبعد</span>' : "داخل في الحساب"}</td>
                  <td><small style="font-size:10px">${A.esc(c.note || "—")}</small></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `).join("");

    renderPlan();

    // Render Requests Table (Section 4) - Fitted 100% with no scroll
    const rows = DATA.requests || [];
    $("#reportRows").innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td><b style="font-family:monospace;font-size:11px">${A.esc(r.requestId)}</b></td>
        <td style="text-align:right">
          <b>${A.esc(r.name)}</b>
          <div style="font-size:9.5px;color:var(--text-muted);font-family:monospace">${A.esc(r.studentId)}</div>
        </td>
        <td>${A.esc(r.grade)}</td>
        <td><b>فصل ${A.esc(r.fromClass)}</b> ← <b style="color:var(--primary)">فصل ${A.esc(r.toClass)}</b></td>
        <td><small style="font-size:10px">${A.esc(r.reason)}</small></td>
        <td><span class="badge ${A.balanceClass(r.balanceLabel)}">${A.esc(r.balanceLabel)}</span></td>
        <td><span class="badge ${A.statusClass(r.status)}">${A.esc(r.status)}</span></td>
        <td><small style="font-size:10px">${A.esc(r.decisionDate || "—")}</small></td>
        <td><small style="font-size:10px">${A.esc(r.approvedBy || "—")}</small></td>
      </tr>
    `).join("") : `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد طلبات مسجلة.</td></tr>`;
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
      <div style="padding:7px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:6px;font-size:11.5px">
        <b>${A.esc(x.grade)}</b>: يُقترح نقل عدد <b>${A.num(x.n)}</b> طالب من <b>الفصل ${x.from}</b> إلى <b>الفصل ${x.to}</b> لتحقيق التوازن الأمثل.
      </div>
    `).join("") : `
      <div style="padding:7px 12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;color:#047857;font-size:11.5px;font-weight:700">
        ✓ الفصول متوازنة حالياً وفق الأهداف المحددة ولا تتطلب أي حركة نقل إضافية.
      </div>
    `;
  }

  // Open Noor Printable Sheet Modal
  function openNoorPrintModal() {
    if (!DATA) return;
    const approved = (DATA.requests || []).filter(r => r.status === "مقبول");
    
    if (!approved.length) {
      alert("لا توجد طلبات نقل مقبولة في النظام حالياً للطباعة.");
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("ar-SA");

    $("#noorPrintContent").innerHTML = `
      <header class="official-letterhead">
        <div class="letterhead-side right">
          <div class="org-line">المملكة العربية السعودية</div>
          <div class="org-line">وزارة التعليم</div>
          <div class="org-line">الإدارة العامة للتعليم</div>
          <div class="org-line school-name">مدرسة عماد الدين زنكي المتوسطة</div>
        </div>
        <div class="letterhead-center">
          <img src="/assets/moe-logo.png" alt="وزارة التعليم" class="official-moe-logo">
          <h2 class="report-main-heading" style="font-size:16px">كشف تعديل فصول الطلاب المعتمد للتنفيذ في نظام نور</h2>
          <div class="report-year-badge">العام الدراسي 1448هـ · إجمالي المعتمدين: ${A.num(approved.length)} طالب</div>
        </div>
        <div class="letterhead-side left">
          <div class="meta-row"><span>الرقم:</span> <b>1448/نور/كشف</b></div>
          <div class="meta-row"><span>التاريخ:</span> <b>${dateStr}</b></div>
          <div class="meta-row"><span>المُعد:</span> <b>${A.esc(S.staff)}</b></div>
        </div>
      </header>
      <div class="official-rule"></div>

      <div style="margin-bottom:12px;font-size:11.5px;color:var(--text-muted)">
        توجيه: يتم نقل الطلاب الموضحين أدناه في نظام نور من فصولهم السابقة إلى فصولهم الجديدة المعتمدة بموجب قرارات لجنة الموازنة.
      </div>

      <div class="table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th style="width:35px">م</th>
              <th style="width:115px">رقم الهوية / السجل</th>
              <th>اسم الطالب الرباعي</th>
              <th style="width:95px">الصف</th>
              <th style="width:95px">الفصل السابق بنور</th>
              <th style="width:110px;background:#e0f2fe;color:#0369a1">الفصل الجديد بنور</th>
              <th style="width:85px">تاريخ الاعتماد</th>
              <th style="width:85px">المعتمد</th>
            </tr>
          </thead>
          <tbody>
            ${approved.map((r, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><b style="font-family:monospace">${A.esc(r.studentId)}</b></td>
                <td style="text-align:right"><b>${A.esc(r.name)}</b></td>
                <td>${A.esc(r.grade)}</td>
                <td>الفصل ${A.esc(r.fromClass)}</td>
                <td style="background:#f0fdf4"><b style="color:#047857;font-size:12px">الفصل ${A.esc(r.toClass)}</b></td>
                <td><small style="font-size:10px">${A.esc(r.decisionDate || r.date)}</small></td>
                <td><small style="font-size:10px">${A.esc(r.approvedBy || "الإدارة")}</small></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="official-signatures" style="margin-top:28px">
        <div class="sig-box">
          <span class="sig-role">مسؤول نظام نور بالمدرسة</span>
          <span class="sig-name">${A.esc(S.staff)}</span>
          <div class="sig-line">التوقيع: .................................</div>
        </div>
        <div class="sig-box">
          <span class="sig-role">وكيل شؤون الطلاب</span>
          <span class="sig-name">أ. .................................</span>
          <div class="sig-line">التوقيع: .................................</div>
        </div>
        <div class="sig-box">
          <span class="sig-role">مدير المدرسة</span>
          <span class="sig-name">أ. .................................</span>
          <div class="sig-line">الختم والتوقيع: ........................</div>
        </div>
      </div>
    `;

    $("#noorPrintModal").classList.remove("hidden");
  }

  // Open Transfer Requests Printable Register Modal
  function openRequestsPrintModal() {
    if (!DATA) return;
    const requests = DATA.requests || [];
    
    if (!requests.length) {
      alert("لا توجد طلبات نقل مسجلة للطباعة.");
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("ar-SA");

    $("#requestsPrintContent").innerHTML = `
      <header class="official-letterhead">
        <div class="letterhead-side right">
          <div class="org-line">المملكة العربية السعودية</div>
          <div class="org-line">وزارة التعليم</div>
          <div class="org-line">الإدارة العامة للتعليم</div>
          <div class="org-line school-name">مدرسة عماد الدين زنكي المتوسطة</div>
        </div>
        <div class="letterhead-center">
          <img src="/assets/moe-logo.png" alt="وزارة التعليم" class="official-moe-logo">
          <h2 class="report-main-heading" style="font-size:16px">السجل الشامل لطلبات نقل الطلاب والقرارات الصادرة</h2>
          <div class="report-year-badge">العام الدراسي 1448هـ · إجمالي الطلبات: ${A.num(requests.length)} طلب</div>
        </div>
        <div class="letterhead-side left">
          <div class="meta-row"><span>الرقم:</span> <b>1448/طلبات/سجل</b></div>
          <div class="meta-row"><span>التاريخ:</span> <b>${dateStr}</b></div>
          <div class="meta-row"><span>المُعد:</span> <b>${A.esc(S.staff)}</b></div>
        </div>
      </header>
      <div class="official-rule"></div>

      <div class="table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th style="width:40px">م</th>
              <th style="width:75px">رقم الطلب</th>
              <th style="width:110px">الهوية الوطنية</th>
              <th>اسم الطالب</th>
              <th style="width:85px">الصف</th>
              <th style="width:105px">المسار</th>
              <th>السبب</th>
              <th style="width:75px">الحالة</th>
              <th style="width:80px">تاريخ القرار</th>
              <th style="width:75px">المعتمد</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map((r, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><b style="font-family:monospace;font-size:10px">${A.esc(r.requestId)}</b></td>
                <td><b style="font-family:monospace;font-size:10px">${A.esc(r.studentId)}</b></td>
                <td style="text-align:right"><b>${A.esc(r.name)}</b></td>
                <td>${A.esc(r.grade)}</td>
                <td>فصل ${A.esc(r.fromClass)} ← <b>فصل ${A.esc(r.toClass)}</b></td>
                <td><small style="font-size:9.5px">${A.esc(r.reason)}</small></td>
                <td><span class="badge ${A.statusClass(r.status)}">${A.esc(r.status)}</span></td>
                <td><small style="font-size:9.5px">${A.esc(r.decisionDate || "—")}</small></td>
                <td><small style="font-size:9.5px">${A.esc(r.approvedBy || "—")}</small></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="official-signatures" style="margin-top:28px">
        <div class="sig-box">
          <span class="sig-role">مُعد السجل</span>
          <span class="sig-name">${A.esc(S.staff)}</span>
          <div class="sig-line">التوقيع: .................................</div>
        </div>
        <div class="sig-box">
          <span class="sig-role">وكيل شؤون الطلاب</span>
          <span class="sig-name">أ. .................................</span>
          <div class="sig-line">التوقيع: .................................</div>
        </div>
        <div class="sig-box">
          <span class="sig-role">مدير المدرسة</span>
          <span class="sig-name">أ. .................................</span>
          <div class="sig-line">الختم والتوقيع: ........................</div>
        </div>
      </div>
    `;

    $("#requestsPrintModal").classList.remove("hidden");
  }

  // Export CSV
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

  // Export Excel for Noor
  $("#noorActionBtn")?.addEventListener("click", () => {
    if (!DATA) return;
    const approved = (DATA.requests || []).filter(r => r.status === "مقبول");
    if (!approved.length) {
      alert("لا توجد طلبات نقل مقبولة في النظام حالياً للتعديل في نظام نور.");
      return;
    }

    const rows = approved.map(r => ({
      "رقم الهوية / الطالب": r.studentId,
      "اسم الطالب": r.name,
      "الصف الدراسي": r.grade,
      "الفصل السابق في نور": r.fromClass,
      "الفصل الجديد المعتمد (يُنقل إليه بنور)": r.toClass,
      "تاريخ الاعتماد": r.decisionDate || r.date,
      "معتمد من": r.approvedBy || "الإدارة"
    }));

    if (window.XLSX) {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "كشف_تعديلات_نظام_نور");
      XLSX.writeFile(wb, `كشف_تعديلات_الطلاب_المطلوبة_في_نظام_نور_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
      const csv = "\ufeff" + [Object.keys(rows[0]), ...rows.map(Object.values)].map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      a.download = `كشف_تعديلات_الطلاب_المطلوبة_في_نظام_نور_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  });

})();