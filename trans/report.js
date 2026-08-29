const API="https://n8n.yasergrid.online/webhook/student-transfer-1448-trans-v1";
const key=sessionStorage.getItem("transKey")||"";
const staff=sessionStorage.getItem("transStaff")||"";

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");

function formatDate(){
  return new Intl.DateTimeFormat("ar-SA",{dateStyle:"long",timeStyle:"short",timeZone:"Asia/Riyadh"}).format(new Date());
}
async function load(){
  $("reportDate").textContent="التاريخ: "+formatDate();
  $("preparedBy").textContent=staff||"________________";
  if(!key){
    $("reportMessage").innerHTML='لا توجد جلسة دخول فعالة. <a href="index.html">افتح صفحة trans وسجل الدخول أولًا.</a>';
    return;
  }
  try{
    const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","X-Trans-Key":key},body:JSON.stringify({action:"dashboard"})});
    const data=await res.json();
    if(!res.ok||!data.success) throw new Error(data.message||"تعذر إعداد التقرير.");
    render(data);
  }catch(err){
    $("reportMessage").textContent=err.message;
  }
}
function render(data){
  const totalStudents=Object.values(data.grades||{}).reduce((s,g)=>s+(g.total||0),0);
  const totalRequests=(data.requests||[]).length;
  const s=data.summary||{};
  $("summaryCards").innerHTML=[
    ["إجمالي الطلاب",totalStudents],
    ["إجمالي الطلبات",totalRequests],
    ["قيد المراجعة",s.pending||0],
    ["المقبولة",s.approved||0]
  ].map(([l,v])=>`<div class="summary-card"><span>${l}</span><strong>${v}</strong></div>`).join("");

  $("gradeTables").innerHTML=Object.entries(data.grades||{}).map(([grade,g])=>`
    <div class="grade-block">
      <h3>${esc(grade)} — الإجمالي: ${g.total||0} طالب</h3>
      <div class="class-grid">
        ${Object.entries(g.classes||{}).map(([c,n])=>`<div class="class-box"><span>الفصل ${esc(c)}</span><strong>${n}</strong></div>`).join("")}
      </div>
    </div>`).join("");

  const rows=[...(data.requests||[])].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  $("requestsBody").innerHTML=rows.length?rows.map((r,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${esc(r.requestId)}</td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.grade)}</td>
      <td>${esc(r.fromClass)}</td>
      <td>${esc(r.toClass)}</td>
      <td>${esc(r.reason)}</td>
      <td>${esc(r.balanceLabel)}</td>
      <td>${esc(r.status)}</td>
    </tr>`).join(""):`<tr><td colspan="9">لا توجد طلبات نقل مسجلة.</td></tr>`;

  $("reportMessage").hidden=true;
  $("reportContent").hidden=false;
}
$("printBtn").addEventListener("click",()=>window.print());
load();
