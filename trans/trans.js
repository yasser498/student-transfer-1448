topbar('dashboard');
let DATA=null,activeGrade=null,currentRequest=null;
const loginLayer=q('#loginLayer');
const cached=getSession();if(cached.key&&cached.staff){q('#loginKey').value=cached.key;q('#loginStaff').value=cached.staff;tryLogin(cached.key,cached.staff)}
q('#loginForm').onsubmit=e=>{e.preventDefault();tryLogin(q('#loginKey').value.trim(),q('#loginStaff').value.trim())};
async function tryLogin(key,staff){
 if(!key||!staff){setStatus(q('#loginStatus'),'أدخل مفتاح الوصول واسم الموظف.','error');return}
 setStatus(q('#loginStatus'),'جاري التحقق...','info');
 try{const d=await transApi({action:'dashboard'},key);setSession(key,staff);DATA=d;loginLayer.classList.add('hidden');render();setStatus(q('#loginStatus'),'','info')}
 catch(e){setStatus(q('#loginStatus'),e.message,'error')}
}
q('#refreshBtn').onclick=load;
async function load(){setStatus(q('#pageStatus'),'جاري تحديث البيانات...','info');try{DATA=await transApi({action:'dashboard'});render();setStatus(q('#pageStatus'),`تم التحديث: ${DATA.generatedAt||''}`,'ok')}catch(e){setStatus(q('#pageStatus'),e.message,'error')}}
function render(){
 if(!DATA)return;const s=DATA.summary||{};
 q('#kpis').innerHTML=[['إجمالي الطلاب',s.totalStudents],['الطلبات',s.totalRequests],['قيد المراجعة',s.pending],['مقبول',s.approved],['مرفوض',s.rejected]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${arNum(x[1])}</strong></div>`).join('');
 const grades=Object.keys(DATA.classManagement||{});activeGrade=grades.includes(activeGrade)?activeGrade:grades[0];
 q('#gradeTabs').innerHTML=grades.map(g=>`<button class="grade-tab ${g===activeGrade?'active':''}" data-g="${escapeHtml(g)}">${escapeHtml(g)}</button>`).join('');
 qa('.grade-tab').forEach(b=>b.onclick=()=>{activeGrade=b.dataset.g;renderClasses();qa('.grade-tab').forEach(x=>x.classList.toggle('active',x===b))});
 renderClasses();renderRequests();
}
function renderClasses(){
 const g=DATA.classManagement?.[activeGrade];if(!g)return;
 q('#classRow').innerHTML=Object.values(g.classes).sort((a,b)=>a.classNo-b.classNo).map(c=>{
  const delta=Number(c.delta);return `<div class="class-mini ${!c.available?'closed':''} ${delta>0?'need':delta<0?'extra':''}"><span>الفصل ${c.classNo}</span><strong>${arNum(c.count)}</strong><small>${c.excluded?'مستبعد من الموازنة':delta>0?`يحتاج ${arNum(delta)}`:delta<0?`فائض ${arNum(Math.abs(delta))}`:'متوازن'}</small></div>`
 }).join('');
}
q('#statusFilter').onchange=renderRequests;q('#requestSearch').oninput=renderRequests;
function renderRequests(){
 if(!DATA)return;const filter=q('#statusFilter').value,term=q('#requestSearch').value.trim();
 let rows=(DATA.requests||[]).filter(r=>(filter==='الكل'||r.status===filter)&&(!term||`${r.name} ${r.requestId} ${r.studentId}`.includes(term)));
 q('#requestsBody').innerHTML=rows.length?rows.map(r=>`<tr><td><b>${escapeHtml(r.requestId)}</b><br><small>${escapeHtml(r.date)}</small></td><td>${escapeHtml(r.name)}<br><small>${escapeHtml(r.studentId)}</small></td><td>${escapeHtml(r.grade)}</td><td>${escapeHtml(r.fromClass)} ← ${escapeHtml(r.toClass)}${r.suggestedClass&&r.suggestedClass!==r.toClass?`<br><small>المقترح: ${escapeHtml(r.suggestedClass)}</small>`:''}</td><td>${escapeHtml(r.reason)}</td><td><span class="badge ${balanceClass(r.balanceLabel)}">${escapeHtml(r.balanceLabel)}</span></td><td><span class="badge ${statusClass(r.status)}">${escapeHtml(r.status)}</span></td><td>${r.status==='قيد المراجعة'?`<div class="actions"><button class="mini-btn approve" data-id="${escapeHtml(r.requestId)}">اعتماد</button><button class="mini-btn reject" data-id="${escapeHtml(r.requestId)}">رفض</button></div>`:`<small>${escapeHtml(r.approvedBy||'')}</small>`}</td></tr>`).join(''):`<tr><td colspan="8">لا توجد طلبات مطابقة.</td></tr>`;
 qa('.mini-btn').forEach(b=>b.onclick=()=>openDecision(b.dataset.id,b.classList.contains('approve')?'approve':'reject'));
}
function openDecision(id,decision){currentRequest={id,decision};const r=DATA.requests.find(x=>x.requestId===id);q('#decisionTitle').textContent=decision==='approve'?'اعتماد طلب النقل':'رفض طلب النقل';q('#decisionInfo').innerHTML=`<p><b>${escapeHtml(r.name)}</b> · ${escapeHtml(r.grade)} · من الفصل ${escapeHtml(r.fromClass)} إلى ${escapeHtml(r.toClass)}</p><p>التقييم الحالي: <span class="badge ${balanceClass(r.balanceLabel)}">${escapeHtml(r.balanceLabel)}</span></p>`;q('#decisionNote').value='';q('#decisionLayer').classList.remove('hidden')}
q('#cancelDecision').onclick=()=>q('#decisionLayer').classList.add('hidden');q('#approveDecision').onclick=()=>submitDecision('approve');q('#rejectDecision').onclick=()=>submitDecision('reject');
async function submitDecision(decision){
 if(!currentRequest)return;setStatus(q('#decisionStatus'),'جاري حفظ القرار...','info');q('#approveDecision').disabled=q('#rejectDecision').disabled=true;
 try{const s=getSession();await transApi({action:'decision',requestId:currentRequest.id,decision,note:q('#decisionNote').value.trim(),staffName:s.staff});q('#decisionLayer').classList.add('hidden');await load()}
 catch(e){setStatus(q('#decisionStatus'),e.message,'error')}finally{q('#approveDecision').disabled=q('#rejectDecision').disabled=false}
}