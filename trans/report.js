(() => {
  "use strict";
  const A = window.AdminApp;
  const $ = A.qs;

  const S = A.require();
  if (!S) return;

  A.shell("report", "التقرير النهائي المعتمد");

  const DEFAULT_STAFF = "ياسر الحميدي";
  const DEPUTY_NAME = "أ. محمد علي الحجيلي";
  const PRINCIPAL_NAME = "أ. عابد عبيد الجدعاني";

  const staffName = S.staff && S.staff !== "admin" ? S.staff : DEFAULT_STAFF;
  $("#signName").textContent = staffName;

  let DATA = null;
  load();

  $("#refreshBtn").addEventListener("click", load);
  
  // 1. Print Comprehensive Report (Direct Native Print)
  $("#printBtn").addEventListener("click", () => {
    window.print();
  });

  // 2. Print Noor Sheet in Clean Dedicated Official Window
  $("#printNoorSheetBtn").addEventListener("click", printNoorSheetDirect);

  // 3. Print Requests Register in Clean Dedicated Official Window
  $("#printRequestsSheetBtn").addEventListener("click", printRequestsRegisterDirect);

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

    // Render Class Reports (Section 2)
    $("#classReports").innerHTML = Object.entries(DATA.classManagement || {}).map(([grade, g]) => `
      <div class="report-grade" style="margin-bottom:14px;page-break-inside:avoid">
        <div style="background:#f1f5f9;padding:6px 10px;font-weight:900;font-size:12px;color:var(--navy-950);border:1px solid #94a3b8;border-bottom:0;border-radius:4px 4px 0 0">
          ${A.esc(grade)} · إجمالي طلاب الصف: ${A.num(g.total)} طالب
        </div>
        <div class="table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th style="width:85px">الفصل</th>
                <th style="width:80px">العدد الحالي</th>
                <th style="width:80px">الهدف المقترح</th>
                <th style="width:80px">الهدف المعتمد</th>
                <th style="width:110px">الاحتياج / الفائض</th>
                <th style="width:85px">استقبال النقل</th>
                <th style="width:85px">الموازنة</th>
                <th class="col-reason">الملاحظات</th>
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
                  <td class="col-reason"><small style="font-size:10.5px">${A.esc(c.note || "—")}</small></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `).join("");

    renderPlan();

    // Render Requests Table (Section 4)
    const rows = DATA.requests || [];
    $("#reportRows").innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td style="font-family:monospace;font-size:10.5px"><b>${A.esc(r.requestId)}</b></td>
        <td class="col-name">
          <b>${A.esc(r.name)}</b>
          <div style="font-size:9.5px;color:var(--text-muted);font-family:monospace">${A.esc(r.studentId)}</div>
        </td>
        <td>${A.esc(r.grade)}</td>
        <td><b>فصل ${A.esc(r.fromClass)}</b> ← <b style="color:var(--primary)">فصل ${A.esc(r.toClass)}</b></td>
        <td class="col-reason"><small style="font-size:10.5px">${A.esc(r.reason || "—")}</small></td>
        <td><span class="badge ${A.balanceClass(r.balanceLabel)}">${A.esc(r.balanceLabel)}</span></td>
        <td><span class="badge ${A.statusClass(r.status)}">${A.esc(r.status)}</span></td>
        <td><small style="font-size:10px">${A.esc(r.decisionDate || r.date || "—")}</small></td>
        <td><small style="font-size:10.5px">${A.esc(r.approvedBy || "إدارة المدرسة")}</small></td>
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
      <div style="padding:6px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:5px;font-size:11.5px">
        <b>${A.esc(x.grade)}</b>: يُقترح نقل عدد <b>${A.num(x.n)}</b> طالب من <b>الفصل ${x.from}</b> إلى <b>الفصل ${x.to}</b> لتحقيق التوازن الأمثل.
      </div>
    `).join("") : `
      <div style="padding:6px 10px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;color:#047857;font-size:11.5px;font-weight:700">
        ✓ الفصول متوازنة حالياً وفق الأهداف المحددة ولا تتطلب أي حركة نقل إضافية.
      </div>
    `;
  }

  // Generic Function for Clean Dedicated Official Print Window
  function printOfficialDoc({ title, heading, badge, metaNumber, directive, tableContent, signatures }) {
    const printWin = window.open("", "_blank", "width=1000,height=850");
    if (!printWin) {
      alert("يرجى السماح بالنوافذ المنبثقة للطباعة المباشرة.");
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("ar-SA");

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          body {
            font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;
            color: #0f172a;
            background: #fff;
            padding: 12px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .letterhead {
            display: grid;
            grid-template-columns: 1fr 1.6fr 1fr;
            align-items: center;
            gap: 12px;
            margin-bottom: 10px;
          }
          .lh-right { text-align: right; font-size: 11px; line-height: 1.5; font-weight: 700; color: #1e293b; }
          .lh-right .school { color: #0284c7; font-weight: 900; font-size: 12.5px; }
          .lh-center { text-align: center; }
          .lh-center img { max-height: 52px; max-width: 120px; object-fit: contain; margin-bottom: 4px; }
          .lh-center h1 { font-size: 14.5px; font-weight: 900; color: #0f172a; margin-bottom: 3px; line-height: 1.3; }
          .lh-center .badge { display: inline-block; background: #0f172a; color: #fff; font-size: 10.5px; font-weight: 700; padding: 2px 12px; border-radius: 999px; }
          .lh-left { text-align: left; font-size: 11px; line-height: 1.5; color: #334155; }
          .lh-left b { font-family: monospace; font-size: 11.5px; }
          .rule { height: 2.5px; background: linear-gradient(90deg, #0284c7 0%, #059669 100%); margin: 8px 0 12px; }
          .directive { font-size: 11px; color: #475569; margin-bottom: 12px; font-weight: 600; line-height: 1.5; }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-bottom: 16px;
          }
          th {
            background: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 900;
            font-size: 10.5px;
            padding: 6px 4px;
            border: 1px solid #475569;
            text-align: center;
            vertical-align: middle;
            line-height: 1.3;
          }
          td {
            padding: 5px 4px;
            border: 1px solid #475569;
            font-size: 10.5px;
            font-weight: 600;
            text-align: center;
            vertical-align: middle;
            word-wrap: break-word;
            line-height: 1.3;
          }
          td.name {
            text-align: right;
            font-weight: 800;
            padding-right: 6px;
            line-height: 1.35;
          }
          td.reason {
            text-align: right;
            padding-right: 4px;
            font-size: 10px;
          }
          .signatures {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 24px;
            padding-top: 14px;
            border-top: 1.5px dashed #94a3b8;
            page-break-inside: avoid;
          }
          .sig-col { text-align: center; font-size: 11.5px; }
          .sig-col .role { font-weight: 900; font-size: 12.5px; display: block; margin-bottom: 4px; color: #0f172a; }
          .sig-col .name { font-weight: 800; color: #1e293b; display: block; min-height: 18px; font-size: 12px; }
          .sig-col .line { margin-top: 22px; font-size: 10.5px; color: #64748b; }
          
          @media screen {
            body { max-width: 960px; margin: 20px auto; padding: 24px 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.12); border-radius: 8px; border: 1px solid #cbd5e1; }
            .print-bar { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 10px 16px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px; }
            .print-bar button { padding: 8px 18px; font-family: inherit; font-weight: 800; font-size: 13px; border-radius: 6px; cursor: pointer; border: none; }
            .print-bar .btn-print { background: #0284c7; color: #fff; }
            .print-bar .btn-close { background: #e2e8f0; color: #334155; margin-right: 8px; }
          }
          @media print {
            .print-bar { display: none !important; }
            body { padding: 0 !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="print-bar">
          <div><strong>🖨️ معاينة الوثيقة الرسمية المعتمدة للطباعة</strong></div>
          <div>
            <button class="btn-print" onclick="window.print()">🖨️ بدء الطباعة الآن</button>
            <button class="btn-close" onclick="window.close()">إغلاق النافذة</button>
          </div>
        </div>

        <header class="letterhead">
          <div class="lh-right">
            <div>المملكة العربية السعودية</div>
            <div>وزارة التعليم</div>
            <div>الإدارة العامة للتعليم</div>
            <div class="school">مدرسة عماد الدين زنكي المتوسطة</div>
          </div>
          <div class="lh-center">
            <img src="/assets/moe-logo.png" alt="وزارة التعليم">
            <h1>${heading}</h1>
            <div class="badge">${badge}</div>
          </div>
          <div class="lh-left">
            <div>الرقم: <b>${metaNumber}</b></div>
            <div>التاريخ: <b>${dateStr}</b></div>
            <div>المُعد: <b>${staffName}</b></div>
          </div>
        </header>
        <div class="rule"></div>

        ${directive ? `<div class="directive">${directive}</div>` : ""}

        ${tableContent}

        <div class="signatures">
          ${signatures}
        </div>

        <script>
          window.addEventListener('load', () => {
            setTimeout(() => { window.print(); }, 400);
          });
        <\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  // 2. Direct Noor Sheet Printer
  function printNoorSheetDirect() {
    if (!DATA) return;
    const approved = (DATA.requests || []).filter(r => r.status === "مقبول");
    
    if (!approved.length) {
      alert("لا توجد طلبات نقل مقبولة في النظام حالياً للطباعة.");
      return;
    }

    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="width:4%">م</th>
            <th style="width:15%">رقم الهوية / السجل</th>
            <th style="width:28%">اسم الطالب الرباعي</th>
            <th style="width:13%">الصف</th>
            <th style="width:12%">الفصل السابق</th>
            <th style="width:14%;background:#e0f2fe;color:#0369a1">الفصل الجديد بنور</th>
            <th style="width:14%">تاريخ الاعتماد</th>
          </tr>
        </thead>
        <tbody>
          ${approved.map((r, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><b style="font-family:monospace">${A.esc(r.studentId)}</b></td>
              <td class="name"><b>${A.esc(r.name)}</b></td>
              <td>${A.esc(r.grade)}</td>
              <td>الفصل ${A.esc(r.fromClass)}</td>
              <td style="background:#f0fdf4"><b style="color:#047857">الفصل ${A.esc(r.toClass)}</b></td>
              <td><small>${A.esc(r.decisionDate || r.date)}</small></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    const signaturesHtml = `
      <div class="sig-col">
        <span class="role">مسؤول نظام نور بالمدرسة</span>
        <span class="name">${A.esc(staffName)}</span>
        <div class="line">التوقيع: .................................</div>
      </div>
      <div class="sig-col">
        <span class="role">وكيل شؤون الطلاب</span>
        <span class="name">${DEPUTY_NAME}</span>
        <div class="line">التوقيع: .................................</div>
      </div>
      <div class="sig-col">
        <span class="role">مدير المدرسة</span>
        <span class="name">${PRINCIPAL_NAME}</span>
        <div class="line">الختم والتوقيع: ........................</div>
      </div>
    `;

    printOfficialDoc({
      title: "كشف تعديل فصول الطلاب المعتمد لنظام نور - 1448هـ",
      heading: "كشف تعديل فصول الطلاب المعتمد للتنفيذ في نظام نور",
      badge: `العام الدراسي 1448هـ · إجمالي المعتمدين: ${A.num(approved.length)} طالب`,
      metaNumber: "1448/نور/كشف",
      directive: "توجيه: يتم نقل الطلاب الموضحين أدناه في نظام نور من فصولهم السابقة إلى فصولهم الجديدة المعتمدة بموجب قرارات لجنة الموازنة.",
      tableContent: tableHtml,
      signatures: signaturesHtml
    });
  }

  // 3. Direct Requests Register Printer
  function printRequestsRegisterDirect() {
    if (!DATA) return;
    const requests = DATA.requests || [];
    
    if (!requests.length) {
      alert("لا توجد طلبات نقل مسجلة للطباعة.");
      return;
    }

    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="width:4%">م</th>
            <th style="width:14%">رقم الطلب</th>
            <th style="width:13%">الهوية الوطنية</th>
            <th style="width:23%">اسم الطالب</th>
            <th style="width:11%">الصف</th>
            <th style="width:11%">المسار</th>
            <th style="width:12%">السبب</th>
            <th style="width:12%">الحالة والقرار</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map((r, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><b style="font-family:monospace;font-size:9.5px">${A.esc(r.requestId)}</b></td>
              <td><b style="font-family:monospace;font-size:10px">${A.esc(r.studentId)}</b></td>
              <td class="name"><b>${A.esc(r.name)}</b></td>
              <td>${A.esc(r.grade)}</td>
              <td>فصل ${A.esc(r.fromClass)} ← <b>فصل ${A.esc(r.toClass)}</b></td>
              <td class="reason">${A.esc(r.reason || "—")}</td>
              <td>
                <b style="color:${r.status === 'مقبول' ? '#047857' : r.status === 'مرفوض' ? '#b91c1c' : '#b45309'}">${A.esc(r.status)}</b>
                <div style="font-size:9px;color:#64748b">${A.esc(r.decisionDate || r.date || "")}</div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    const signaturesHtml = `
      <div class="sig-col">
        <span class="role">مُعد السجل</span>
        <span class="name">${A.esc(staffName)}</span>
        <div class="line">التوقيع: .................................</div>
      </div>
      <div class="sig-col">
        <span class="role">وكيل شؤون الطلاب</span>
        <span class="name">${DEPUTY_NAME}</span>
        <div class="line">التوقيع: .................................</div>
      </div>
      <div class="sig-col">
        <span class="role">مدير المدرسة</span>
        <span class="name">${PRINCIPAL_NAME}</span>
        <div class="line">الختم والتوقيع: ........................</div>
      </div>
    `;

    printOfficialDoc({
      title: "السجل الشامل لطلبات نقل الطلاب والقرارات - 1448هـ",
      heading: "السجل الشامل لطلبات نقل الطلاب والقرارات الصادرة",
      badge: `العام الدراسي 1448هـ · إجمالي الطلبات: ${A.num(requests.length)} طلب`,
      metaNumber: "1448/طلبات/سجل",
      directive: "",
      tableContent: tableHtml,
      signatures: signaturesHtml
    });
  }

  // Export CSV
  $("#csvBtn").addEventListener("click", () => {
    if (!DATA) return;
    const rows = [
      ["رقم الطلب", "رقم الطالب", "اسم الطالب", "الصف", "الفصل الحالي", "الفصل المطلوب", "السبب", "الحالة", "تقييم الموازنة", "ملاحظة الإدارة", "تاريخ القرار", "اعتمد بواسطة"],
      ...(DATA.requests || []).map(r => [
        r.requestId, r.studentId, r.name, r.grade, r.fromClass, r.toClass, r.reason, r.status, r.balanceLabel, r.managementNote, r.decisionDate || r.date, r.approvedBy || "إدارة المدرسة"
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
      "معتمد من": r.approvedBy || "إدارة المدرسة"
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