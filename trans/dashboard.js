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

  // ================= SMART MULTI-HOP BALANCING & CHAIN ENGINE =================
  function findOptimalChains(requests, classManagement, selectedGrade) {
    if (!requests || !classManagement) return { chains: [], studentChainMap: new Map() };

    const pending = requests.filter(r => r.status === "قيد المراجعة");
    const chains = [];
    const studentChainMap = new Map();

    // Group pending requests by grade
    const gradesToProcess = (selectedGrade === "الكل") 
      ? Object.keys(classManagement) 
      : [selectedGrade].filter(g => classManagement[g]);

    gradesToProcess.forEach(gradeName => {
      const gData = classManagement[gradeName];
      if (!gData || !gData.classes) return;

      const gradePending = pending.filter(r => r.grade === gradeName || r.gradeCode === gData.code);
      if (gradePending.length < 1) return;

      const classes = gData.classes;

      // Map from fromClass -> list of requests
      const fromMap = {};
      gradePending.forEach(r => {
        const fc = String(r.fromClass);
        if (!fromMap[fc]) fromMap[fc] = [];
        fromMap[fc].push(r);
      });

      // 1. DISCOVER 2-WAY DIRECT SWAPS (A -> B and B -> A)
      for (let i = 0; i < gradePending.length; i++) {
        const req1 = gradePending[i];
        for (let j = i + 1; j < gradePending.length; j++) {
          const req2 = gradePending[j];
          if (
            String(req1.fromClass) === String(req2.toClass) &&
            String(req1.toClass) === String(req2.fromClass)
          ) {
            const chain = {
              id: `swap-${req1.requestId}-${req2.requestId}`,
              type: "2way-swap",
              typeTitle: "🔄 تبادل مقاعد ثنائي مباشر",
              typeTagClass: "swap",
              grade: gradeName,
              requests: [req1, req2],
              route: [req1.fromClass, req1.toClass, req1.fromClass],
              routeText: `الفصل ${req1.fromClass} ⇄ الفصل ${req1.toClass}`,
              impact: `تلبية رغبة الطالبين (${req1.name} و ${req2.name}) مع ثبات تام لأعداد الفصلين دون أي إخلال بالموازنة!`,
              score: 20
            };
            chains.push(chain);
            studentChainMap.set(req1.requestId, chain);
            studentChainMap.set(req2.requestId, chain);
          }
        }
      }

      // 2. DISCOVER 3-WAY MULTI-HOP CHAINS & CYCLES (A -> B and B -> C)
      for (const req1 of gradePending) {
        const classA = String(req1.fromClass);
        const classB = String(req1.toClass);

        const possibleNext = fromMap[classB] || [];
        for (const req2 of possibleNext) {
          if (req2.requestId === req1.requestId) continue;
          const classC = String(req2.toClass);

          // Sub-case 2.1: Closed 3-Way Cycle (A -> B -> C -> A)
          const possibleCycleClose = (fromMap[classC] || []).filter(r3 => String(r3.toClass) === classA && r3.requestId !== req1.requestId && r3.requestId !== req2.requestId);
          for (const req3 of possibleCycleClose) {
            const chainKey = [req1.requestId, req2.requestId, req3.requestId].sort().join("-");
            if (!chains.some(c => c.key === chainKey)) {
              const chain = {
                id: `cycle3-${chainKey}`,
                key: chainKey,
                type: "3way-cycle",
                typeTitle: "🔄 حلقة تبادل ثلاثية مغلقة",
                typeTagClass: "golden",
                grade: gradeName,
                requests: [req1, req2, req3],
                route: [classA, classB, classC, classA],
                routeText: `الفصل ${classA} ➔ الفصل ${classB} ➔ الفصل ${classC} ➔ الفصل ${classA}`,
                impact: `تلبية رغبات 3 طلاب بنجاح (${req1.name}، ${req2.name}، ${req3.name}) مع بقاء كافة الفصول الثلاثة متوازنة 100%!`,
                score: 30
              };
              chains.push(chain);
              studentChainMap.set(req1.requestId, chain);
              studentChainMap.set(req2.requestId, chain);
              studentChainMap.set(req3.requestId, chain);
            }
          }

          // Sub-case 2.2: Open 3-Way Chain (A -> B -> C where A has surplus and C has deficit)
          if (classC !== classA) {
            const countA = Number(classes[classA]?.count || 0);
            const targetA = Number(classes[classA]?.target || 0);
            const countC = Number(classes[classC]?.count || 0);
            const targetC = Number(classes[classC]?.target || 0);

            const isSurplusA = countA >= targetA;
            const isDeficitC = countC <= targetC;

            if (isSurplusA || isDeficitC) {
              const chainKey = `chain3-${req1.requestId}-${req2.requestId}`;
              if (!chains.some(c => c.id === chainKey)) {
                const chain = {
                  id: chainKey,
                  type: "3way-chain",
                  typeTitle: "🌟 سلسلة موازنة ثلاثية ذهبية",
                  typeTagClass: "golden",
                  grade: gradeName,
                  requests: [req1, req2],
                  route: [classA, classB, classC],
                  routeText: `الفصل ${classA} ➔ الفصل ${classB} ➔ الفصل ${classC}`,
                  impact: `تخفيض فائض الفصل ${classA} (${countA} ➔ ${countA - 1}) وسد عجز الفصل ${classC} (${countC} ➔ ${countC + 1}) مع بقاء الفصل الوسيط ${classB} ثابتاً عند (${classes[classB]?.count || 0})!`,
                  score: 25 + (isSurplusA && isDeficitC ? 15 : 0)
                };
                chains.push(chain);
                if (!studentChainMap.has(req1.requestId)) studentChainMap.set(req1.requestId, chain);
                if (!studentChainMap.has(req2.requestId)) studentChainMap.set(req2.requestId, chain);
              }
            }
          }
        }
      }

      // 3. DISCOVER DIRECT SURPLUS-TO-DEFICIT TRANSFERS
      for (const req of gradePending) {
        const fc = String(req.fromClass);
        const tc = String(req.toClass);
        const countFrom = Number(classes[fc]?.count || 0);
        const targetFrom = Number(classes[fc]?.target || 0);
        const countTo = Number(classes[tc]?.count || 0);
        const targetTo = Number(classes[tc]?.target || 0);

        if (countFrom > targetFrom && countTo < targetTo) {
          const chainKey = `direct-${req.requestId}`;
          if (!chains.some(c => c.id === chainKey)) {
            const chain = {
              id: chainKey,
              type: "direct-golden",
              typeTitle: "🎯 نقل مباشر مثالي (سد عجز وتصريف فائض)",
              typeTagClass: "golden",
              grade: gradeName,
              requests: [req],
              route: [fc, tc],
              routeText: `الفصل ${fc} ➔ الفصل ${tc}`,
              impact: `ينقل الطالب ${req.name} من الفصل الفائض (${fc}: ${countFrom} ➔ ${countFrom - 1}) إلى الفصل المحتاج (${tc}: ${countTo} ➔ ${countTo + 1}) مباشرة!`,
              score: 20
            };
            chains.push(chain);
            if (!studentChainMap.has(req.requestId)) studentChainMap.set(req.requestId, chain);
          }
        }
      }
    });

    chains.sort((a, b) => b.score - a.score);
    return { chains, studentChainMap };
  }

  function renderRequests() {
    if (!DATA) return;
    const f = $("#statusFilter").value;
    const t = $("#searchInput").value.trim().toLowerCase();

    // 1. Run Optimal Chain Discovery
    const { chains, studentChainMap } = findOptimalChains(DATA.requests || [], DATA.classManagement || {}, GRADE);
    
    // Render Chain Suggestions Banner
    const chainSection = $("#chainSuggestionsSection");
    const chainList = $("#chainSuggestionsList");
    const chainBadge = $("#chainStatsBadge");

    if (chains.length > 0 && (f === "قيد المراجعة" || f === "الكل")) {
      chainSection?.classList.remove("hidden");
      if (chainBadge) {
        chainBadge.textContent = `🎯 تم اكتشاف ${A.num(chains.length)} حزم وسلاسل تبادلية ذكية`;
      }
      if (chainList) {
        chainList.innerHTML = chains.map((ch, idx) => `
          <article class="chain-card">
            <div>
              <div class="chain-card-head">
                <span class="chain-type-tag ${ch.typeTagClass}">${ch.typeTitle}</span>
                <small style="color:var(--text-muted);font-weight:700">${A.esc(ch.grade)}</small>
              </div>

              <div class="chain-route">
                ${ch.route.map((node, i) => `
                  <span class="node">الفصل ${node}</span>
                  ${i < ch.route.length - 1 ? `<span class="arrow">➔</span>` : ""}
                `).join("")}
              </div>

              <div class="chain-students-list">
                ${ch.requests.map(r => `
                  <div class="chain-student-row">
                    <span class="chain-student-name">👤 ${A.esc(r.name)}</span>
                    <span class="chain-student-move">من ${A.esc(r.fromClass)} ← إلى ${A.esc(r.toClass)}</span>
                  </div>
                `).join("")}
              </div>

              <div class="chain-impact-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>${ch.impact}</span>
              </div>
            </div>

            <div class="chain-actions">
              <button class="btn btn-primary approve-chain-btn" style="width:100%;font-size:12px;padding:8px 12px" data-chain-idx="${idx}">
                ⚡ اعتماد هذه السلسلة معاً (${A.num(ch.requests.length)} طلاب)
              </button>
            </div>
          </article>
        `).join("");

        all(".approve-chain-btn").forEach(b => {
          b.addEventListener("click", () => {
            const idx = Number(b.dataset.chainIdx);
            const chain = chains[idx];
            if (chain) decideChain(chain);
          });
        });
      }
    } else {
      chainSection?.classList.add("hidden");
    }

    // 2. Filter Table Rows
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
      const chain = studentChainMap.get(r.requestId);
      return `
        <tr style="${chain ? "background:#f0f9ff" : ""}">
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
            
            ${chain ? `
              <div class="chain-badge" style="display:block;margin-top:4px">
                🔗 ${chain.typeTitle}
                <small style="display:block;color:#0369a1;font-weight:700">مع: ${chain.requests.filter(x=>x.requestId!==r.requestId).map(x=>x.name).join(" + ") || "حركة موازنة"}</small>
              </div>
            ` : ""}

            ${!chain && r.suggestedClass && r.suggestedClass !== r.toClass ? `
              <div style="font-size:10px;color:#d97706;margin-top:2px">المقترح للموازنة: الفصل ${A.esc(r.suggestedClass)}</div>
            ` : ""}
          </td>
          <td><small>${A.esc(r.reason)}</small></td>
          <td>
            <span class="badge ${chain ? "good" : A.balanceClass(r.balanceLabel)}">
              ${chain ? "🌟 يحقق توازن السلسلة" : A.esc(r.balanceLabel)}
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

    const { studentChainMap } = findOptimalChains(DATA.requests || [], DATA.classManagement || {}, GRADE);
    const chain = studentChainMap.get(id);

    $("#decisionTitle").textContent = decision === "approve" ? "اعتماد طلب النقل وتحديث الفصل" : "رفض طلب النقل";
    
    let chainNotice = "";
    if (chain && decision === "approve") {
      $("#approvePairBtn")?.classList.remove("hidden");
      $("#approvePairBtn").textContent = `⚡ اعتماد السلسلة كاملة (${chain.requests.length} طلاب معاً)`;
      chainNotice = `
        <div style="margin-top:12px;padding:12px;background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:12px;color:#0369a1;font-size:12px">
          <div style="font-weight:800;display:flex;align-items:center;gap:4px;margin-bottom:4px">
            <span>⚡ ${chain.typeTitle} (${chain.routeText}):</span>
          </div>
          <div>${chain.impact}</div>
          <div style="margin-top:6px;font-weight:700;color:#0c4a6e">
            الطلاب في هذه السلسلة: ${chain.requests.map(x => `<b>${A.esc(x.name)}</b> (${x.fromClass} ➔ ${x.toClass})`).join(" · ")}
          </div>
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
          <span class="badge ${chain ? "good" : A.balanceClass(r.balanceLabel)}">${chain ? "🌟 سلسلة موازنة" : A.esc(r.balanceLabel)}</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted)">
          الصف: <b>${A.esc(r.grade)}</b> · من الفصل <b>${A.esc(r.fromClass)}</b> إلى الفصل <b style="color:var(--primary)">${A.esc(r.toClass)}</b>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px">
          سبب الطلب: ${A.esc(r.reason)} ${r.note ? `(${A.esc(r.note)})` : ""}
        </div>

        <div style="background:#f0fdf4;border:1.5px solid #a7f3d0;border-radius:12px;padding:12px 14px;margin-top:12px">
          <div style="font-size:12px;font-weight:900;color:#065f46;margin-bottom:8px">
            📊 أثر الاعتماد اللحظي على أعداد الفصول:
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

        ${chainNotice}
      </div>
    `;
    $("#decisionNote").value = "";
    A.alert($("#decisionMsg"), "", "info");
    $("#decisionModal").classList.remove("hidden");
  }

  $("#cancelDecision").addEventListener("click", () => $("#decisionModal").classList.add("hidden"));
  $("#approveDecision").addEventListener("click", () => decide("approve"));
  $("#rejectDecision").addEventListener("click", () => decide("reject"));
  $("#approvePairBtn")?.addEventListener("click", () => {
    if (!selected) return;
    const { studentChainMap } = findOptimalChains(DATA.requests || [], DATA.classManagement || {}, GRADE);
    const chain = studentChainMap.get(selected.id);
    if (chain) decideChain(chain);
    else decide("approve");
  });

  async function decide(decision) {
    if (!selected) return;
    
    $("#approveDecision").disabled = $("#rejectDecision").disabled = true;
    if ($("#approvePairBtn")) $("#approvePairBtn").disabled = true;
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
      $("#approveDecision").disabled = $("#rejectDecision").disabled = false;
      if ($("#approvePairBtn")) $("#approvePairBtn").disabled = false;
    }
  }

  async function decideChain(chain) {
    if (!chain || !chain.requests || !chain.requests.length) return;

    const names = chain.requests.map(r => r.name).join(" و ");
    const confirmMsg = `هل أنت متأكد من اعتماد السلسلة التبادلية (${chain.routeText}) لـ (${chain.requests.length}) طلاب (${names}) معاً؟`;
    
    if (!confirm(confirmMsg)) return;

    A.alert($("#pageMsg"), `جاري اعتماد السلسلة التبادلية ونقل ${chain.requests.length} طلاب وتحديث فصولهم في Google Sheets...`, "info");

    const s = A.session();
    let successCount = 0;
    const userNote = $("#decisionNote")?.value?.trim() || "";

    for (const req of chain.requests) {
      try {
        await A.api({
          action: "decision",
          requestId: req.requestId,
          decision: "approve",
          note: userNote || `معتمد ضمن ${chain.typeTitle}: ${chain.routeText}`,
          staffName: s.staff
        });
        successCount++;
      } catch (err) {
        console.error("Error approving student in chain:", req.requestId, err);
      }
    }

    $("#decisionModal")?.classList.add("hidden");

    if (successCount === chain.requests.length) {
      A.alert($("#pageMsg"), `🎉 تم بنجاح اعتماد السلسلة التبادلية بالكامل لجميع الطلاب الـ ${successCount} وتحديث فصولهم وتحقيق التوازن المثالي للشعب! 🌟`, "success");
    } else {
      A.alert($("#pageMsg"), `تم اعتماد ${successCount} من أصل ${chain.requests.length} طلاب في السلسلة.`, "warning");
    }

    await load();
  }

})();