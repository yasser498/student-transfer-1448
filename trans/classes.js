(() => {
  "use strict";
  const A = window.AdminApp;
  const $ = A.qs;
  const all = A.qsa;

  const S = A.require();
  if (!S) return;

  A.shell("classes", "إدارة الفصول والموازنة");

  let DATA = null;
  let GRADE = null;
  let dirty = new Set();

  load();

  async function load() {
    A.alert($("#pageMsg"), "جاري جلب إعدادات الفصول وأعداد الطلاب...", "info");
    try {
      DATA = await A.api({ action: "dashboard" });
      const gs = Object.keys(DATA.classManagement || {});
      GRADE = gs.includes(GRADE) ? GRADE : gs[0];
      dirty.clear();
      render();
      A.alert($("#pageMsg"), `تم تحميل بيانات الفصول بنجاح · ${DATA.generatedAt || ""}`, "success");
    } catch (e) {
      A.alert($("#pageMsg"), e.message, "error");
    }
  }

  function kpi(t, v) {
    return `
      <article class="kpi" style="padding:14px 18px">
        <span style="font-size:11px;color:var(--text-muted)">${t}</span>
        <strong style="font-size:22px;margin-top:4px">${A.num(v)}</strong>
      </article>
    `;
  }

  function render() {
    const gs = Object.keys(DATA.classManagement || {});
    $("#gradeTabs").innerHTML = gs.map(g => `
      <button class="grade-tab ${g === GRADE ? "active" : ""}" data-g="${A.esc(g)}">${A.esc(g)}</button>
    `).join("");

    all(".grade-tab").forEach(b => {
      b.addEventListener("click", () => {
        GRADE = b.dataset.g;
        render();
      });
    });

    const g = DATA.classManagement[GRADE];
    const cs = Object.values(g.classes);
    const movement = cs.filter(c => !c.excluded && c.delta > 0).reduce((s, c) => s + c.delta, 0);

    $("#summary").innerHTML = 
      kpi("إجمالي طلاب الصف", g.total) +
      kpi("فصول متاحة للنقل", g.availableClasses) +
      kpi("فصول مستبعدة", g.excludedClasses) +
      kpi("فصول داخلة بالموازنة", g.activeClasses) +
      kpi("حركة المقاعد المطلوبة", movement);

    renderCards(g);
  }

  function renderCards(g) {
    $("#classGrid").innerHTML = Object.values(g.classes)
      .sort((a, b) => Number(a.classNo) - Number(b.classNo))
      .map(c => `
        <article class="class-card ${!c.available ? "closed" : ""} ${c.excluded ? "excluded" : ""}" 
                 data-key="${c.key}" 
                 data-grade="${g.code}" 
                 data-class="${c.classNo}" 
                 data-rec="${c.recommendedTarget}" 
                 data-count="${c.count}">
          
          <div class="class-card-head">
            <div class="class-no">
              الشعبة
              <b>الفصل ${c.classNo}</b>
            </div>
            <div class="count-box">
              <strong>${A.num(c.count)}</strong>
              <small> طالب مسجل</small>
            </div>
          </div>

          <div class="class-card-body">
            <div class="balance-row">
              <div>
                <span>العدد الحالي</span>
                <b>${A.num(c.count)}</b>
              </div>
              <div>
                <span>المقترح آلياً</span>
                <b>${A.num(c.recommendedTarget)}</b>
              </div>
              <div>
                <span>الهدف الفعلي</span>
                <b class="effective" style="color:var(--primary)">${A.num(c.target)}</b>
              </div>
            </div>

            <div class="switch-row">
              <div class="switch-copy">
                <b>متاح لاستقبال النقل</b>
                <small>إيقافه يخفي هذا الفصل فوراً من خيارات الطلاب</small>
              </div>
              <label class="switch">
                <input class="available" type="checkbox" ${c.available ? "checked" : ""}>
                <i></i>
              </label>
            </div>

            <div class="switch-row">
              <div class="switch-copy">
                <b>مستبعد من الموازنة</b>
                <small>لا يدخل ضمن حساب الطاقة الاستيعابية الآلية</small>
              </div>
              <label class="switch">
                <input class="excluded" type="checkbox" ${c.excluded ? "checked" : ""}>
                <i></i>
              </label>
            </div>

            <div class="field" style="margin-top:4px">
              <label>العدد المستهدف (يدوي)</label>
              <input class="target control" inputmode="numeric" value="${c.customTarget ?? ""}" placeholder="المقترح آلياً: ${c.recommendedTarget}">
              <small style="color:var(--text-muted);font-size:10px">اتركه فارغاً للاعتماد على الحساب الآلي الذكي.</small>
            </div>

            <div class="field" style="margin-top:2px">
              <label>ملاحظة الإدارة</label>
              <input class="note control" value="${A.esc(c.note || "")}" placeholder="مثال: شعبة موهوبين / فصل خاص">
            </div>
          </div>

          <div class="class-card-foot">
            <span class="save-state">${c.updatedAt ? `آخر تعديل: ${A.esc(c.updatedAt)}` : "الإعداد الافتراضي"}</span>
            <button class="btn btn-soft save-one" style="padding:6px 12px;font-size:11px">
              حفظ هذا الفصل
            </button>
          </div>
        </article>
      `).join("");

    all(".class-card").forEach(card => {
      card.querySelectorAll("input").forEach(x => x.addEventListener("input", () => changed(card)));
      card.querySelector(".save-one").addEventListener("click", () => saveCard(card));
      preview(card);
    });
  }

  function changed(card) {
    dirty.add(card.dataset.key);
    card.classList.add("dirty");
    card.querySelector(".save-state").textContent = "تعديل غير محفوظ ⚠️";
    preview(card);
  }

  function preview(card) {
    const rec = Number(card.dataset.rec);
    const raw = card.querySelector(".target").value.trim();
    const target = raw === "" ? rec : Number(raw);
    
    card.querySelector(".effective").textContent = Number.isFinite(target) ? A.num(target) : "—";
    card.classList.toggle("closed", !card.querySelector(".available").checked);
    card.classList.toggle("excluded", card.querySelector(".excluded").checked);
  }

  async function saveCard(card, silent = false) {
    const s = A.session();
    const b = card.querySelector(".save-one");
    b.disabled = true;
    
    try {
      await A.api({
        action: "saveClassSettings",
        gradeCode: card.dataset.grade,
        classNo: card.dataset.class,
        available: card.querySelector(".available").checked,
        excluded: card.querySelector(".excluded").checked,
        targetCount: card.querySelector(".target").value.trim(),
        classNote: card.querySelector(".note").value.trim(),
        staffName: s.staff
      });

      dirty.delete(card.dataset.key);
      card.classList.remove("dirty");
      card.querySelector(".save-state").textContent = "تم الحفظ بنجاح ✓";
      
      if (!silent) {
        A.alert($("#pageMsg"), `تم حفظ إعدادات الفصل ${card.dataset.class} بنجاح. سيتم تطبيق التحديث على استعلامات الطلاب مباشرة.`, "success");
      }
      return true;
    } catch (e) {
      A.alert($("#pageMsg"), e.message, "error");
      return false;
    } finally {
      b.disabled = false;
    }
  }

  $("#autoBtn").addEventListener("click", () => {
    all(".class-card").forEach(card => {
      if (card.querySelector(".excluded").checked) return;
      card.querySelector(".target").value = card.dataset.rec;
      changed(card);
    });
    A.alert($("#pageMsg"), "تم ضبط الأهداف المقترحة آلياً لفصول هذا الصف. اضغط «حفظ فصول هذا الصف» لتثبيتها.", "info");
  });

  $("#saveAllBtn").addEventListener("click", async () => {
    const cards = all(".class-card");
    if (!cards.length) return;

    $("#saveAllBtn").disabled = true;
    A.alert($("#pageMsg"), `جاري حفظ وتثبيت إعدادات فصول (${GRADE}) في Google Sheets...`, "info");
    
    let ok = 0;
    for (const c of cards) {
      if (await saveCard(c, true)) ok++;
    }
    $("#saveAllBtn").disabled = false;

    if (ok === cards.length) {
      A.alert($("#pageMsg"), `تم حفظ وتثبيت جميع فصول (${GRADE}) الـ ${ok} بنجاح في Google Sheets ✓`, "success");
      await load();
    } else {
      A.alert($("#pageMsg"), `تم حفظ ${ok} من أصل ${cards.length} فصل.`, "warning");
    }
  });

  // Save ALL 18 Classes for the Whole School to Google Sheets in one click!
  $("#saveSchoolAllBtn").addEventListener("click", async () => {
    if (!DATA || !DATA.classManagement) return;

    const btn = $("#saveSchoolAllBtn");
    btn.disabled = true;
    A.alert($("#pageMsg"), "جاري تثبيت وحفظ جميع فصول المدرسة بالكامل (18 فصلاً) في جدول Google Sheets السحابي...", "info");

    const s = A.session();
    let totalSaved = 0;
    let errors = 0;

    for (const [gradeName, g] of Object.entries(DATA.classManagement)) {
      for (const c of Object.values(g.classes)) {
        try {
          const targetToSave = c.customTarget ?? c.recommendedTarget;
          await A.api({
            action: "saveClassSettings",
            gradeCode: g.code,
            classNo: c.classNo,
            available: c.available,
            excluded: c.excluded,
            targetCount: String(targetToSave),
            classNote: c.note || (c.excluded ? "فصل مستبعد" : ""),
            staffName: s.staff
          });
          totalSaved++;
        } catch (e) {
          errors++;
        }
      }
    }

    btn.disabled = false;

    if (errors === 0) {
      A.alert($("#pageMsg"), `تم بنجاح تثبيت وتعبئة كافة فصول المدرسة الـ ${totalSaved} فصلاً في جدول Google Sheets بالكامل! 🌟`, "success");
      await load();
    } else {
      A.alert($("#pageMsg"), `تم حفظ ${totalSaved} فصلاً، وحدث خطأ في ${errors} فصول.`, "warning");
      await load();
    }
  });

})();