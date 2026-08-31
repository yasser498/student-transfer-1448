(() => {
  "use strict";
  const C = window.APP_CONFIG || {
    schoolName: "مدرسة عماد الدين زنكي المتوسطة",
    academicYear: "1448هـ",
    adminApi: "https://n8n.yasergrid.online/webhook/student-transfer-1448-trans-v1",
    studentApi: "https://n8n.yasergrid.online/webhook/student-transfer-1448-v1"
  };
  
  const SESSION_KEY = "transKey";
  const STAFF_KEY = "transStaff";

  window.AdminApp = {
    qs: (s, el = document) => el.querySelector(s),
    qsa: (s, el = document) => [...el.querySelectorAll(s)],
    
    session() {
      return {
        key: sessionStorage.getItem(SESSION_KEY) || "EMAD",
        staff: sessionStorage.getItem(STAFF_KEY) || "إدارة المدرسة"
      };
    },
    
    saveSession(key, staff) {
      sessionStorage.setItem(SESSION_KEY, key || "EMAD");
      sessionStorage.setItem(STAFF_KEY, staff || "إدارة المدرسة");
    },
    
    clearSession() {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(STAFF_KEY);
    },
    
    async api(body, key) {
      const k = key ?? this.session().key ?? "EMAD";
      const payload = Object.assign({ transKey: k, key: k }, body);
      const r = await fetch(C.adminApi, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Trans-Key": k,
          "x-trans-key": k
        },
        body: JSON.stringify(payload)
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) {
        throw new Error(d.message || "تعذر تنفيذ العملية.");
      }
      return d;
    },
    
    esc(v) {
      return String(v ?? "").replace(/[&<>"']/g, m => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
      }[m]));
    },
    
    num(v) {
      return new Intl.NumberFormat("ar-SA").format(Number(v) || 0);
    },
    
    alert(el, text, type = "info") {
      if (!el) return;
      el.textContent = text || "";
      el.className = `alert ${type}${text ? "" : " hidden"}`;
    },
    
    statusClass(s) {
      return s === "مقبول" ? "approved" : s === "مرفوض" ? "rejected" : "pending";
    },
    
    balanceClass(s) {
      return s === "يحسن الموازنة" ? "good" : s === "يزيد التفاوت" ? "bad" : "neutral";
    },
    
    require() {
      const s = this.session();
      if (!s.key) {
        location.replace("/trans/index.html");
        return null;
      }
      return s;
    },
    
    logout() {
      this.clearSession();
      location.replace("/trans/index.html");
    },
    
    icon(name) {
      const paths = {
        home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
        classes: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11M16 9v11"/>',
        sync: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
        report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        refresh: '<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>',
        print: '<polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
        users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
        requests: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>',
        clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
        check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
        x: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
        external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>'
      };
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ""}</svg>`;
    },
    
    shell(active, title) {
      const s = this.session();
      const main = document.querySelector("#appShell");
      if (!main) return;
      
      const links = [
        ["dashboard", "/trans/index.html", "الرئيسية", "home"],
        ["classes", "/trans/classes.html", "إدارة الفصول", "classes"],
        ["sync", "/trans/sync.html", "مزامنة إكسل", "sync"],
        ["report", "/trans/report.html", "التقرير النهائي", "report"],
        ["settings", "/trans/settings.html", "الإعدادات", "settings"]
      ];
      
      const nav = links.map(([k, h, t, i]) => 
        `<a class="side-link ${active === k ? "active" : ""}" href="${h}">${this.icon(i)}<span>${t}</span></a>`
      ).join("");
      
      const mobile = links.map(([k, h, t, i]) => 
        `<a class="${active === k ? "active" : ""}" href="${h}">${this.icon(i)}<span>${t}</span></a>`
      ).join("");
      
      main.insertAdjacentHTML("afterbegin", `
        <aside class="sidebar">
          <div class="side-brand">
            <img src="/assets/moe-logo.png" alt="وزارة التعليم">
            <div>
              <strong>${C.schoolName}</strong>
              <span>لوحة trans · ${C.academicYear}</span>
            </div>
          </div>
          <div class="side-label">القائمة الرئيسية</div>
          <nav class="side-nav">${nav}</nav>
          <div class="side-user">
            <small>المستخدم النشط</small>
            <b>${this.esc(s.staff || "مدير النظام")}</b>
            <button class="logout-btn" id="logoutBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              تسجيل الخروج
            </button>
          </div>
        </aside>
      `);
      
      const mainCol = main.querySelector(".main");
      if (mainCol) {
        mainCol.insertAdjacentHTML("afterbegin", `
          <header class="topbar">
            <div class="topbar-inner">
              <div class="breadcrumb">
                <small>نظام نقل الطلاب والموازنة</small>
                <h1>${title}</h1>
              </div>
              <div class="top-actions">
                <a class="btn btn-soft" href="/" target="_blank">
                  ${this.icon("external")}
                  <span>موقع الطالب</span>
                </a>
              </div>
            </div>
          </header>
        `);
        mainCol.insertAdjacentHTML("beforeend", `<nav class="mobile-nav">${mobile}</nav>`);
      }
      
      document.querySelector("#logoutBtn")?.addEventListener("click", () => this.logout());
    }
  };
})();