const TRANS_API='https://n8n.yasergrid.online/webhook/student-transfer-1448-trans-v1';
const SESSION_KEY='transKey',SESSION_STAFF='transStaff';
const q=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];
function getSession(){return{key:sessionStorage.getItem(SESSION_KEY)||'',staff:sessionStorage.getItem(SESSION_STAFF)||''}}
function setSession(key,staff){sessionStorage.setItem(SESSION_KEY,key);sessionStorage.setItem(SESSION_STAFF,staff)}
function clearSession(){sessionStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_STAFF)}
async function transApi(body,key=getSession().key){
 const r=await fetch(TRANS_API,{method:'POST',headers:{'Content-Type':'application/json','X-Trans-Key':key},body:JSON.stringify(body)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.success===false)throw new Error(d.message||'تعذر تنفيذ العملية.');
 return d;
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function arNum(v){return new Intl.NumberFormat('ar-SA').format(Number(v)||0)}
function setStatus(el,text,type='info'){if(!el)return;el.hidden=!text;el.className=`status ${type}`;el.textContent=text||''}
function statusClass(s){return s==='مقبول'?'approved':s==='مرفوض'?'rejected':'pending'}
function balanceClass(label){return label==='يحسن الموازنة'?'good':label==='يزيد التفاوت'?'bad':'neutral'}
function logout(){clearSession();location.href='index.html'}
function requireSession(){const s=getSession();if(!s.key){location.href='index.html';return null}return s}
function navHtml(active){
 const items=[['dashboard','index.html','الرئيسية'],['classes','classes.html','إدارة الفصول'],['report','report.html','التقرير النهائي'],['settings','settings.html','الإعدادات']];
 return items.map(([k,h,t])=>`<a href="${h}" class="${active===k?'active':''}">${t}</a>`).join('')+`<button onclick="logout()">خروج</button>`;
}
function topbar(active){
 const el=q('#adminTop'); if(!el)return;
 el.innerHTML=`<div class="container admin-top-inner"><div class="admin-brand"><img src="../assets/moe-logo.png" alt="وزارة التعليم"><div><h1>مدرسة عماد الدين زنكي المتوسطة</h1><small>لوحة trans · إدارة نقل الطلاب</small></div></div><nav class="admin-nav">${navHtml(active)}</nav></div>`;
}