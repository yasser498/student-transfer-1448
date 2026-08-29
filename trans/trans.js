const API = "https://n8n.yasergrid.online/webhook/student-transfer-1448-trans-v1";
const state = { data:null, grade:null, filter:"قيد المراجعة", selected:null, key:"", staffName:"" };
const $ = id => document.getElementById(id);

function show(el,msg,type="info"){el.textContent=msg;el.className=`status ${type}`;el.hidden=false}
function hide(el){el.hidden=true}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
async function api(payload){
  const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","X-Trans-Key":state.key},body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({}));
  if(res.status===401){sessionStorage.removeItem("transKey");$("loginLayer").classList.remove("hidden");throw new Error("مفتاح الوصول غير صحيح.")}
  if(!res.ok) throw new Error(data.message||"تعذر تنفيذ العملية.");
  return data;
}
function setBtn(btn,loading,text){if(!btn.dataset.o)btn.dataset.o=btn.textContent.trim();btn.disabled=loading;btn.textContent=loading?text:btn.dataset.o}

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); state.key=$("transKey").value.trim(); state.staffName=$("staffName").value.trim();
  const btn=e.currentTarget.querySelector('button[type="submit"]'); setBtn(btn,true,"جاري الدخول...");
  try{const d=await api({action:"dashboard"});sessionStorage.setItem("transKey",state.key);sessionStorage.setItem("transStaff",state.staffName);$("loginLayer").classList.add("hidden");state.data=d;renderAll();}
  catch(err){show($("loginStatus"),err.message,"error")}finally{setBtn(btn,false)}
});
$("logoutBtn").addEventListener("click",()=>{sessionStorage.clear();location.reload()});
$("refreshBtn").addEventListener("click",()=>loadDashboard());
document.querySelectorAll(".filter-btn").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".filter-btn").forEach(x=>x.classList.remove("is-active"));b.classList.add("is-active");state.filter=b.dataset.filter;renderRequests()}));
$("searchRequests").addEventListener("input",renderRequests);

async function loadDashboard(){
  try{const d=await api({action:"dashboard"});state.data=d;renderAll()}catch(err){alert(err.message)}
}
function renderAll(){
  if(!state.data?.success)return;
  renderSummary(); renderGradeTabs(); renderBalance(); renderRequests();
}
function renderSummary(){
  const s=state.data.summary||{};
  $("summaryGrid").innerHTML=[
    ["قيد المراجعة",s.pending||0],["مقبول",s.approved||0],["مرفوض",s.rejected||0]
  ].map(x=>`<div class="summary-card"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
}
function renderGradeTabs(){
  const grades=Object.keys(state.data.grades||{});
  if(!state.grade||!grades.includes(state.grade))state.grade=grades[0]||null;
  $("gradeTabs").innerHTML=grades.map(g=>`<button class="grade-tab ${g===state.grade?"is-active":""}" data-grade="${esc(g)}">${esc(g)}</button>`).join("");
  $("gradeTabs").querySelectorAll(".grade-tab").forEach(b=>b.addEventListener("click",()=>{state.grade=b.dataset.grade;renderGradeTabs();renderBalance()}));
}
function renderBalance(){
  const g=state.data.grades?.[state.grade]; if(!g) return $("classBalance").innerHTML="";
  const counts=Object.values(g.classes); const avg=counts.length?counts.reduce((a,b)=>a+b,0)/counts.length:0;
  $("classBalance").innerHTML=Object.entries(g.classes).map(([c,n])=>{
    const diff=n-avg; const tone=diff>=2?"high":diff<=-2?"low":"balanced";
    const label=diff>=2?"مرتفع":diff<=-2?"متاح":"متوازن";
    return `<div class="class-card ${tone}"><div class="class-no"><span>الفصل ${c}</span><span>${label}</span></div><strong>${n}</strong><small>طالب</small></div>`;
  }).join("");
}
function renderRequests(){
  if(!state.data)return;
  const q=$("searchRequests").value.trim().toLowerCase();
  let arr=[...(state.data.requests||[])];
  if(state.filter!=="الكل")arr=arr.filter(r=>r.status===state.filter);
  if(q)arr=arr.filter(r=>`${r.name} ${r.requestId} ${r.studentId}`.toLowerCase().includes(q));
  if(state.filter==="قيد المراجعة")arr.sort((a,b)=>(b.balanceScore||0)-(a.balanceScore||0));
  $("emptyRequests").hidden=arr.length>0;
  $("requestsList").innerHTML=arr.map(requestCard).join("");
  $("requestsList").querySelectorAll("[data-open-request]").forEach(b=>b.addEventListener("click",()=>openDecision(b.dataset.openRequest)));
}
function requestCard(r){
  const assessClass=r.balanceScore>0?"good":r.balanceScore<0?"bad":"neutral";
  const st=r.status==="مقبول"?"approved":r.status==="مرفوض"?"rejected":"pending";
  return `<article class="request-card">
    <div class="request-student"><small>${esc(r.requestId)}</small><h3>${esc(r.name)}</h3><p>${esc(r.grade)} • السبب: ${esc(r.reason)}</p></div>
    <div>
      <div class="movement">
        <div class="class-chip"><span>الحالي</span><strong>فصل ${esc(r.fromClass)}</strong></div>
        <div class="move-arrow"><svg viewBox="0 0 24 24" fill="none"><path d="M19 12H5M10 7l-5 5 5 5"/></svg></div>
        <div class="class-chip"><span>المطلوب</span><strong>فصل ${esc(r.toClass)}</strong></div>
      </div>
      <div class="balance-assessment"><span class="assessment ${assessClass}">${esc(r.balanceLabel)}</span><span class="score">درجة ${r.balanceScore>0?"+":""}${r.balanceScore||0}</span>${r.suggestedClass?`<span class="score">الأنسب: فصل ${r.suggestedClass}</span>`:""}</div>
    </div>
    <div class="request-action">${r.status==="قيد المراجعة"?`<button class="btn btn-review btn-small" data-open-request="${esc(r.requestId)}">مراجعة الطلب</button>`:`<span class="status-label ${st}">${esc(r.status)}</span>`}</div>
  </article>`;
}
function openDecision(id){
  const r=(state.data.requests||[]).find(x=>x.requestId===id);if(!r)return;state.selected=r;
  $("dialogTitle").textContent=r.name;
  $("dialogInfo").innerHTML=`رقم الطلب: <strong>${esc(r.requestId)}</strong><br>من الفصل <strong>${esc(r.fromClass)}</strong> إلى الفصل <strong>${esc(r.toClass)}</strong><br>تقييم الموازنة: <strong>${esc(r.balanceLabel)}</strong>`;
  $("decisionNote").value="";hide($("decisionStatus"));$("decisionDialog").showModal();
}
$("approveBtn").addEventListener("click",()=>decision("approve",$("approveBtn")));
$("rejectBtn").addEventListener("click",()=>decision("reject",$("rejectBtn")));
async function decision(decision,btn){
  if(!state.selected)return;setBtn(btn,true,decision==="approve"?"جاري الاعتماد...":"جاري الرفض...");
  try{
    const d=await api({action:"decision",decision,requestId:state.selected.requestId,note:$("decisionNote").value.trim(),staffName:state.staffName});
    if(!d.success)throw new Error(d.message||"تعذر تنفيذ القرار.");
    show($("decisionStatus"),d.message,"success");setTimeout(async()=>{$("decisionDialog").close();await loadDashboard()},650);
  }catch(err){show($("decisionStatus"),err.message,"error")}finally{setBtn(btn,false)}
}

(function restore(){
  const k=sessionStorage.getItem("transKey"),s=sessionStorage.getItem("transStaff");
  if(k&&s){state.key=k;state.staffName=s;$("transKey").value=k;$("staffName").value=s;api({action:"dashboard"}).then(d=>{$("loginLayer").classList.add("hidden");state.data=d;renderAll()}).catch(()=>{})}
})();
