(()=>{"use strict";
const C=window.APP_CONFIG,SESSION_KEY="transKey",STAFF_KEY="transStaff";
window.AdminApp={
 qs:s=>document.querySelector(s),qsa:s=>[...document.querySelectorAll(s)],
 session(){return{key:sessionStorage.getItem(SESSION_KEY)||"",staff:sessionStorage.getItem(STAFF_KEY)||""}},
 saveSession(key,staff){sessionStorage.setItem(SESSION_KEY,key);sessionStorage.setItem(STAFF_KEY,staff)},
 clearSession(){sessionStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(STAFF_KEY)},
 async api(body,key){const k=key??this.session().key;const r=await fetch(C.adminApi,{method:"POST",headers:{"Content-Type":"application/json","X-Trans-Key":k},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.message||"تعذر تنفيذ العملية.");return d},
 esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))},
 num(v){return new Intl.NumberFormat("ar-SA").format(Number(v)||0)},
 alert(el,text,type="info"){if(!el)return;el.textContent=text||"";el.className=`alert ${type}${text?"":" hidden"}`},
 statusClass(s){return s==="مقبول"?"approved":s==="مرفوض"?"rejected":"pending"},
 balanceClass(s){return s==="يحسن الموازنة"?"good":s==="يزيد التفاوت"?"bad":"neutral"},
 require(){const s=this.session();if(!s.key){location.replace("/trans/index.html");return null}return s},
 logout(){this.clearSession();location.replace("/trans/index.html")},
 icon(name){const paths={home:'<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',classes:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11M16 9v11"/>',report:'<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5L9 6a7 7 0 0 0-1.7 1L5 6 3 9.5 5.1 11A7 7 0 0 0 5 12c0 .3 0 .7.1 1L3 14.5 5 18l2.3-1a7 7 0 0 0 1.7 1l.5 3h5l.5-3a7 7 0 0 0 1.7-1l2.3 1 2-3.5-2.1-1.5c.1-.3.1-.7.1-1z"/>',refresh:'<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18 9a7 7 0 0 0-12-2M6 15a7 7 0 0 0 12 2"/>',print:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',download:'<path d="M12 3v12M8 11l4 4 4-4"/><path d="M4 20h16"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',requests:'<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',x:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>'};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${paths[name]||""}</svg>`},
 shell(active,title,subtitle){
  const s=this.session(),main=document.querySelector("#appShell"); if(!main)return;
  const links=[["dashboard","/trans/index.html","الرئيسية","home"],["classes","/trans/classes.html","إدارة الفصول","classes"],["report","/trans/report.html","التقرير النهائي","report"],["settings","/trans/settings.html","الإعدادات","settings"]];
  const nav=links.map(([k,h,t,i])=>`<a class="side-link ${active===k?"active":""}" href="${h}">${this.icon(i)}<span>${t}</span></a>`).join("");
  const mobile=links.map(([k,h,t,i])=>`<a class="${active===k?"active":""}" href="${h}">${this.icon(i)}<span>${t}</span></a>`).join("");
  main.insertAdjacentHTML("afterbegin",`<aside class="sidebar"><div class="side-brand"><img src="/assets/moe-logo.png" alt="وزارة التعليم"><div><strong>${C.schoolName}</strong><span>لوحة trans · ${C.academicYear}</span></div></div><div class="side-label">الإدارة</div><nav class="side-nav">${nav}</nav><div class="side-user"><small>المستخدم الحالي</small><b>${this.esc(s.staff||"—")}</b><button class="logout-btn" id="logoutBtn">تسجيل الخروج</button></div></aside>`);
  const mainCol=main.querySelector(".main");mainCol.insertAdjacentHTML("afterbegin",`<header class="topbar"><div class="topbar-inner"><div class="breadcrumb"><small>نظام نقل الطلاب</small><h1>${title}</h1></div><div class="top-actions"><a class="btn btn-soft" href="/"><span>موقع الطالب</span></a></div></div></header>`);
  mainCol.insertAdjacentHTML("beforeend",`<nav class="mobile-nav">${mobile}</nav>`);
  document.querySelector("#logoutBtn")?.addEventListener("click",()=>this.logout());
 }
};
})();