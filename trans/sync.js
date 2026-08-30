(() => {
  "use strict";
  const A = window.AdminApp;
  const $ = A.qs;
  const all = A.qsa;
  
  const S = A.require();
  if (!S) return;

  A.shell("sync", "مزامنة ومدقق نظام نور (Excel)");

  let SYSTEM_STUDENTS = [];
  let SYSTEM_REQUESTS = [];
  let DIFF_RESULTS = [];
  let CURRENT_FILTER = "all";
  let SEARCH_QUERY = "";

  const dropZone = $("#dropZone");
  const fileInput = $("#fileInput");
  const diffDashboard = $("#diffDashboard");

  init();

  async function init() {
    setupEventListeners();
    await loadSystemData();
  }

  async function loadSystemData() {
    A.alert($("#pageMsg"), "جاري تحميل بيانات وقرارات النظام الحالية...", "info");
    try {
      const data = await A.api({ action: "dashboard" });
      SYSTEM_REQUESTS = data.requests || [];
      
      const approvedCount = SYSTEM_REQUESTS.filter(r => r.status === "مقبول").length;
      const totalStudents = data.summary?.totalStudents || 0;

      $("#systemRosterInfo").textContent = `المسجل بالنظام: ${A.num(totalStudents)} طالب · (${A.num(approvedCount)} قرار نقل معتمد)`;
      $("#systemRosterInfo").className = "badge good";
      
      A.alert($("#pageMsg"), `تم الاتصال بالنظام بنجاح · ${data.generatedAt || ""}`, "success");
    } catch (e) {
      A.alert($("#pageMsg"), "تعذر جلب بيانات النظام الحالية: " + e.message, "error");
      $("#systemRosterInfo").textContent = "تعذر الاتصال بالنظام";
      $("#systemRosterInfo").className = "badge bad";
    }
  }

  function setupEventListeners() {
    $("#reloadSystemBtn")?.addEventListener("click", loadSystemData);
    $("#templateBtn")?.addEventListener("click", downloadSampleTemplate);
    $("#exportNoorActionBtn")?.addEventListener("click", exportNoorActionList);
    $("#exportNoorPendingBtn")?.addEventListener("click", exportPendingInNoor);
    $("#exportDiffBtn")?.addEventListener("click", exportDiffReport);
    $("#exportMasterBtn")?.addEventListener("click", exportMasterSheet);

    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", e => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    });

    dropZone.addEventListener("dragover", e => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

    dropZone.addEventListener("drop", e => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    all(".diff-filter-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        all(".diff-filter-pill").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        CURRENT_FILTER = btn.dataset.filter;
        renderDiffTable();
      });
    });

    $("#searchDiffInput")?.addEventListener("input", e => {
      SEARCH_QUERY = e.target.value.trim().toLowerCase();
      renderDiffTable();
    });
  }

  function norm(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .trim()
      .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
      .replace(/\s+/g, " ");
  }

  function resolveGrade(raw) {
    const s = norm(raw);
    if (s.includes("730") || s.includes("اول") || s.includes("الأول")) return { code: "730", name: "الأول متوسط" };
    if (s.includes("830") || s.includes("ثاني") || s.includes("الثاني")) return { code: "830", name: "الثاني متوسط" };
    if (s.includes("930") || s.includes("ثالث") || s.includes("الثالث")) return { code: "930", name: "الثالث متوسط" };
    return { code: s || "730", name: s || "الأول متوسط" };
  }

  function handleFile(file) {
    A.alert($("#pageMsg"), `جاري قراءة وتحليل كشف نظام نور: ${file.name}...`, "info");

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!rows || !rows.length) {
          throw new Error("الملف المرفوع فارغ أو لا يحتوي على صفوف بيانات صالحة.");
        }

        processUploadedRows(rows, file.name);
      } catch (err) {
        A.alert($("#pageMsg"), "خطأ في قراءة ملف الإكسل: " + err.message, "error");
      }
    };
    reader.onerror = () => A.alert($("#pageMsg"), "تعذر قراءة الملف المرفوع.", "error");
    reader.readAsArrayBuffer(file);
  }

  function detectColumns(sampleRow) {
    const keys = Object.keys(sampleRow);
    const idKey = keys.find(k => /(هوية|رقم.*طالب|سجل|مدني|id|national)/i.test(k)) || keys[0];
    const nameKey = keys.find(k => /(اسم.*طالب|اسم|name)/i.test(k)) || keys[1];
    const gradeKey = keys.find(k => /(صف|مرحلة|grade)/i.test(k)) || keys[2];
    const classKey = keys.find(k => /(فصل|شعبة|class|section)/i.test(k)) || keys[3];
    return { idKey, nameKey, gradeKey, classKey };
  }

  function processUploadedRows(rows, fileName) {
    const { idKey, nameKey, gradeKey, classKey } = detectColumns(rows[0] || {});
    
    // Parse uploaded Noor sheet
    const uploadedMap = new Map();
    rows.forEach((r, idx) => {
      const id = norm(r[idKey]);
      if (!id) return;
      
      const name = norm(r[nameKey]) || `طالب ${idx + 1}`;
      const gradeInfo = resolveGrade(r[gradeKey]);
      const noorClass = norm(r[classKey]).replace(/[^\d]/g, "") || "1";

      uploadedMap.set(id, {
        studentId: id,
        name,
        gradeCode: gradeInfo.code,
        gradeName: gradeInfo.name,
        noorClass,
        raw: r
      });
    });

    // Map system requests
    const approvedMap = new Map();
    const pendingMap = new Map();

    SYSTEM_REQUESTS.forEach(req => {
      const id = norm(req.studentId);
      if (req.status === "مقبول") {
        approvedMap.set(id, req);
      } else if (req.status === "قيد المراجعة") {
        pendingMap.set(id, req);
      }
    });

    const diffs = [];
    let noorPendingCount = 0;
    let noorAppliedCount = 0;
    let noorExternalCount = 0;
    let unchangedCount = 0;
    let newCount = 0;
    let conflictCount = 0;

    uploadedMap.forEach((up, id) => {
      const approvedReq = approvedMap.get(id);
      const pendingReq = pendingMap.get(id);

      let status = "unchanged";
      let systemApprovedClass = approvedReq ? norm(approvedReq.toClass) : up.noorClass;
      let prevClass = approvedReq ? norm(approvedReq.fromClass) : up.noorClass;
      let note = "متطابق في النظام ونظام نور";

      if (approvedReq) {
        // There is an approved transfer in our system!
        const targetClass = norm(approvedReq.toClass);
        const originalClass = norm(approvedReq.fromClass);

        if (up.noorClass === targetClass) {
          // Noor already reflects the transfer!
          status = "noor-applied";
          noorAppliedCount++;
          note = `✓ تم تعديله في نظام نور بنجاح إلى الفصل ${targetClass}`;
        } else {
          // Noor STILL has the student in old class!
          status = "noor-pending";
          noorPendingCount++;
          note = `🔴 معتمد نقله إلى الفصل ${targetClass}، لكنه لا يزال في الفصل ${up.noorClass} بنظام نور (يجب تعديله في نور)`;
        }
      } else if (pendingReq) {
        status = "conflict";
        conflictCount++;
        note = `⚠️ لديه طلب نقل معلق لم يُعتمد بعد (إلى الفصل ${pendingReq.toClass})`;
      } else {
        // No system request for this student
        const knownHistory = SYSTEM_REQUESTS.find(r => norm(r.studentId) === id);
        if (knownHistory && knownHistory.fromClass !== up.noorClass) {
          status = "noor-external";
          noorExternalCount++;
          note = `🟡 تم تغيير الفصل في نظام نور مباشرة من ${knownHistory.fromClass} إلى ${up.noorClass}`;
        } else if (!knownHistory && SYSTEM_REQUESTS.length > 0) {
          status = "new";
          newCount++;
          note = "طالب جديد مضاف في كشف نور";
        } else {
          unchangedCount++;
        }
      }

      diffs.push({
        studentId: up.studentId,
        name: up.name,
        gradeCode: up.gradeCode,
        gradeName: up.gradeName,
        prevClass: approvedReq ? approvedReq.fromClass : up.noorClass,
        noorClass: up.noorClass,
        systemApprovedClass: approvedReq ? approvedReq.toClass : up.noorClass,
        status,
        note,
        approvedReq,
        pendingReq
      });
    });

    // Check for students who were previously in system requests but are missing in the new Noor sheet (Departed/Transferred out)
    let missingCount = 0;
    const knownSysMap = new Map();
    SYSTEM_REQUESTS.forEach(r => {
      const id = norm(r.studentId);
      if (id && !knownSysMap.has(id)) {
        knownSysMap.set(id, r);
      }
    });

    knownSysMap.forEach((r, id) => {
      if (!uploadedMap.has(id)) {
        missingCount++;
        diffs.push({
          studentId: id,
          name: r.name,
          gradeCode: r.gradeCode || "730",
          gradeName: r.grade || "الصف",
          prevClass: r.fromClass || "1",
          noorClass: "غير مسجل",
          systemApprovedClass: "منقول خارجياً",
          status: "missing",
          note: `🔴 منقول خارج المدرسة / لم يعد مسجلاً في كشف نور (كان في الفصل ${r.fromClass})`,
          approvedReq: null,
          pendingReq: null
        });
      }
    });

    DIFF_RESULTS = diffs;

    // Update KPI counters
    $("#kpiTotal").textContent = A.num(uploadedMap.size);
    $("#kpiNoorPending").textContent = A.num(noorPendingCount);
    $("#kpiNoorApplied").textContent = A.num(noorAppliedCount);
    $("#kpiNoorExternal").textContent = A.num(noorExternalCount);
    $("#kpiMissing").textContent = A.num(missingCount);

    $("#countAll").textContent = diffs.length;
    $("#countNoorPending").textContent = noorPendingCount;
    $("#countNoorApplied").textContent = noorAppliedCount;
    $("#countNoorExternal").textContent = noorExternalCount;
    $("#countNew").textContent = newCount;
    $("#countConflicts").textContent = conflictCount;
    $("#countMissing").textContent = missingCount;
    $("#countUnchanged").textContent = unchangedCount;

    diffDashboard.classList.remove("hidden");
    
    // If there are pending changes in Noor, activate the filter automatically to focus on them!
    if (noorPendingCount > 0) {
      all(".diff-filter-pill").forEach(b => b.classList.toggle("active", b.dataset.filter === "noor-pending"));
      CURRENT_FILTER = "noor-pending";
    }

    renderDiffTable();

    if (noorPendingCount > 0) {
      A.alert($("#pageMsg"), `تنبيه: تم رصد ${A.num(noorPendingCount)} طالب تم اعتماد نقلهم في النظام ولكن لم يتم تغيير فصولهم في نظام نور بعد.`, "warning");
    } else {
      A.alert($("#pageMsg"), `ممتاز! جميع القرارات المعتمدة تم تطبيقها ومطابقتها في نظام نور بنجاح 100%.`, "success");
    }
  }

  function renderDiffTable() {
    const tbody = $("#diffTableBody");
    if (!tbody) return;

    const filtered = DIFF_RESULTS.filter(item => {
      if (CURRENT_FILTER === "noor-pending" && item.status !== "noor-pending") return false;
      if (CURRENT_FILTER === "noor-applied" && item.status !== "noor-applied") return false;
      if (CURRENT_FILTER === "noor-external" && item.status !== "noor-external") return false;
      if (CURRENT_FILTER === "missing" && item.status !== "missing") return false;
      if (CURRENT_FILTER === "new" && item.status !== "new") return false;
      if (CURRENT_FILTER === "conflicts" && item.status !== "conflict") return false;
      if (CURRENT_FILTER === "unchanged" && item.status !== "unchanged") return false;
      
      if (SEARCH_QUERY) {
        const str = `${item.name} ${item.studentId} ${item.gradeName} ${item.noorClass} ${item.systemApprovedClass} ${item.note}`.toLowerCase();
        if (!str.includes(SEARCH_QUERY)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">لا توجد سجلات مطابقة للفلتر المحدد.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(row => {
      let badgeHtml = "";
      let rowBg = "";

      if (row.status === "noor-pending") {
        badgeHtml = `<span class="diff-tag noor-pending">🔴 لم يُعدل في نور بعد</span>`;
        rowBg = "background:#fff5f5;";
      } else if (row.status === "noor-applied") {
        badgeHtml = `<span class="diff-tag noor-applied">✓ تم التطبيق في نور</span>`;
        rowBg = "background:#f0fdf4;";
      } else if (row.status === "noor-external") {
        badgeHtml = `<span class="diff-tag noor-external">🟡 تعديل خارجي بنور</span>`;
      } else if (row.status === "missing") {
        badgeHtml = `<span class="diff-tag missing" style="background:#ffedd5;color:#c2410c;border-color:#fdba74">🔴 غادر المدرسة</span>`;
        rowBg = "background:#fff7ed;";
      } else if (row.status === "conflict") {
        badgeHtml = `<span class="diff-tag conflict">⚠️ طلب نقل معلق</span>`;
      } else if (row.status === "new") {
        badgeHtml = `<span class="diff-tag new">طالب جديد</span>`;
      } else {
        badgeHtml = `<span class="diff-tag unchanged">مطابق</span>`;
      }

      return `
        <tr style="${rowBg}">
          <td><b style="font-family:monospace;letter-spacing:0.5px">${A.esc(row.studentId)}</b></td>
          <td><b>${A.esc(row.name)}</b></td>
          <td>${A.esc(row.gradeName)}</td>
          <td><span class="badge neutral">الفصل ${A.esc(row.prevClass)}</span></td>
          <td><span class="badge ${row.status === "noor-pending" ? "bad" : "neutral"}">الفصل ${A.esc(row.noorClass)}</span></td>
          <td><b style="color:var(--primary)">الفصل ${A.esc(row.systemApprovedClass)}</b></td>
          <td>${badgeHtml}</td>
          <td><small style="font-weight:700;color:${row.status === "noor-pending" ? "#b91c1c" : row.status === "noor-applied" ? "#047857" : "inherit"}">${A.esc(row.note)}</small></td>
        </tr>
      `;
    }).join("");
  }

  // 1. Export Action Sheet for Noor (Approved Transfers)
  function exportNoorActionList() {
    const approved = SYSTEM_REQUESTS.filter(r => r.status === "مقبول");
    if (!approved.length) {
      alert("لا توجد طلبات نقل مقبولة في النظام حالياً للتعديل في نظام نور.");
      return;
    }

    const rows = approved.map(r => ({
      "رقم الهوية / الطالب": r.studentId,
      "اسم الطالب": r.name,
      "الصف الدراسي": r.grade,
      "الفصل السابق في نور": r.fromClass,
      "الفصل الجديد المعتمد (يُعدل في نور إلى)": r.toClass,
      "تاريخ الاعتماد": r.decisionDate || r.date,
      "معتمد من": r.approvedBy || "الإدارة"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف_تعديلات_نظام_نور");
    XLSX.writeFile(wb, `كشف_تعديل_الطلاب_المطلوبة_في_نظام_نور_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // 2. Export Pending in Noor (Discrepancy List)
  function exportPendingInNoor() {
    const pendingList = DIFF_RESULTS.filter(r => r.status === "noor-pending");
    if (!pendingList.length) {
      alert("لا يوجد طلاب معتمدين لم يتم تعديلهم في نظام نور.");
      return;
    }

    const rows = pendingList.map(r => ({
      "رقم الهوية / الطالب": r.studentId,
      "اسم الطالب": r.name,
      "الصف": r.gradeName,
      "الفصل الحالي بنظام نور": r.noorClass,
      "الفصل المعتمد بالنظام (المطلوب نقله إليه)": r.systemApprovedClass,
      "الملاحظة": r.note
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المتبقي_للتعديل_في_نور");
    XLSX.writeFile(wb, `الطلاب_المتبقي_تعديلهم_في_نور_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // 3. Export Comprehensive Audit Diff Report
  function exportDiffReport() {
    if (!DIFF_RESULTS.length) {
      alert("يرجى رفع كشف نظام نور أولاً للمقارنة والتدقيق.");
      return;
    }

    const exportRows = DIFF_RESULTS.map(r => ({
      "رقم الطالب / الهوية": r.studentId,
      "اسم الطالب": r.name,
      "الصف": r.gradeName,
      "الفصل السابق": r.prevClass,
      "فصل كشف نور المرفوع": r.noorClass,
      "الفصل المعتمد بالنظام": r.systemApprovedClass,
      "حالة المطابقة مع نور": r.status === "noor-applied" ? "تم التطبيق في نور" : r.status === "noor-pending" ? "لم يُعدل في نور بعد ⚠️" : r.status === "noor-external" ? "تعديل خارجي في نور" : r.status === "conflict" ? "طلب نقل معلق" : "مطابق",
      "الملاحظات": r.note
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير_تدقيق_نظام_نور");
    XLSX.writeFile(wb, `تقرير_مطابقة_وتدقيق_نور_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // 4. Export Clean Master Sheet
  function exportMasterSheet() {
    if (!DIFF_RESULTS.length) {
      alert("يرجى رفع ملف أولاً لتصدير الكشف المعتمد.");
      return;
    }

    const masterRows = DIFF_RESULTS.map(r => ({
      "رقم الطالب": r.studentId,
      "اسم الطالب": r.name,
      "رقم الصف": r.gradeCode,
      "الصف": r.gradeName,
      "الفصل": r.systemApprovedClass || r.noorClass
    }));

    const ws = XLSX.utils.json_to_sheet(masterRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الورقة1");
    XLSX.writeFile(wb, `كشف_الطلاب_المحدث_المعتمد_1448.xlsx`);
  }

  function downloadSampleTemplate() {
    const sampleData = [
      { "رقم الطالب": "1174196801", "اسم الطالب": "محمد عبدالله القحطاني", "الصف": "الأول متوسط", "الفصل": "1" },
      { "رقم الطالب": "1174196802", "اسم الطالب": "سعد خالد الدوسري", "الصف": "الأول متوسط", "الفصل": "2" },
      { "رقم الطالب": "1174196803", "اسم الطالب": "فيصل فهد العتيبي", "الصف": "الثاني متوسط", "الفصل": "1" },
      { "رقم الطالب": "1174196804", "اسم الطالب": "عمر عبدالعزيز الشهري", "الصف": "الثاني متوسط", "الفصل": "3" },
      { "رقم الطالب": "1174196805", "اسم الطالب": "ريان إبراهيم الغامدي", "الصف": "الثالث متوسط", "الفصل": "2" },
      { "رقم الطالب": "1174196806", "اسم الطالب": "سلطان بدر المطيري", "الصف": "الثالث متوسط", "الفصل": "4" }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الورقة1");
    XLSX.writeFile(wb, "قالب_كشف_الطلاب_1448.xlsx");
  }

})();
