const API='https://n8n.yasergrid.online/webhook/student-transfer-1448-v1';
let student=null;
const $=s=>document.querySelector(s);
function msg(el,text,type='info'){el.hidden=!text;el.className=`status ${type}`;el.textContent=text||''}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
async function api(payload){
 const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.success===false) throw new Error(d.message||'تعذر تنفيذ العملية.');
 return d;
}
document.querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('.tab-btn').forEach(x=>x.classList.toggle('active',x===b));
 $('#newTab').classList.toggle('hidden',b.dataset.tab!=='new');$('#statusTab').classList.toggle('hidden',b.dataset.tab!=='status');
});
$('#lookupBtn').onclick=lookup;
$('#studentId').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookup()}});
async function lookup(){
 const id=$('#studentId').value.trim(); if(!id){msg($('#lookupStatus'),'أدخل رقم الطالب / الهوية.','error');return}
 $('#lookupBtn').disabled=true;msg($('#lookupStatus'),'جاري التحقق من البيانات...','info');
 try{
  const d=await api({action:'lookup',studentId:id});student=d.student;
  $('#studentName').textContent=student.name;$('#studentGrade').textContent=student.grade;$('#studentClass').textContent=student.class;
  const classes=student.availableClasses||[];const sel=$('#targetClass');
  sel.innerHTML=classes.length?`<option value="">اختر الفصل</option>`+classes.map(c=>`<option value="${esc(c)}">الفصل ${esc(c)}</option>`):'<option value="">لا توجد فصول متاحة حاليًا</option>';
  sel.disabled=!classes.length;$('#submitBtn').disabled=!classes.length;
  $('#studentCard').classList.remove('hidden');$('#successCard').classList.add('hidden');
  msg($('#lookupStatus'),classes.length?'تم التحقق من بيانات الطالب بنجاح.':'تم التحقق من الطالب، لكن لا توجد فصول متاحة للنقل حاليًا.',classes.length?'ok':'warn');
 }catch(e){student=null;$('#studentCard').classList.add('hidden');msg($('#lookupStatus'),e.message,'error')}
 finally{$('#lookupBtn').disabled=false}
}
$('#transferForm').onsubmit=async e=>{
 e.preventDefault(); if(!student)return;
 const targetClass=$('#targetClass').value,reason=$('#reason').value,note=$('#studentNote').value.trim();
 if(!targetClass||!reason){msg($('#submitStatus'),'اختر الفصل المطلوب وسبب الطلب.','error');return}
 $('#submitBtn').disabled=true;msg($('#submitStatus'),'جاري تسجيل الطلب...','info');
 try{
  const d=await api({action:'submit',studentId:student.studentId,targetClass,reason,note});
  $('#successCode').textContent=d.requestId||'تم التسجيل';$('#studentCard').classList.add('hidden');$('#successCard').classList.remove('hidden');msg($('#lookupStatus'),'','info');
 }catch(e){msg($('#submitStatus'),e.message,'error')}finally{$('#submitBtn').disabled=false}
};
$('#newRequestBtn').onclick=()=>{student=null;$('#successCard').classList.add('hidden');$('#studentCard').classList.add('hidden');$('#studentId').value='';$('#studentId').focus()};
$('#statusBtn').onclick=async()=>{
 const id=$('#statusStudentId').value.trim();if(!id){msg($('#statusMessage'),'أدخل رقم الطالب / الهوية.','error');return}
 $('#statusBtn').disabled=true;msg($('#statusMessage'),'جاري جلب الطلبات...','info');
 try{
  const d=await api({action:'status',studentId:id});msg($('#statusMessage'),'','info');
  $('#statusResults').innerHTML=(d.requests||[]).map(r=>`<div class="student-card"><div class="student-head"><div><small>رقم الطلب</small><div class="request-code">${esc(r.requestId)}</div></div><div class="meta-pills"><div class="meta-pill">الحالة<b>${esc(r.status)}</b></div><div class="meta-pill">النقل<b>${esc(r.fromClass)} ← ${esc(r.toClass)}</b></div></div></div><p><b>السبب:</b> ${esc(r.reason)}</p>${r.managementNote?`<p><b>ملاحظة الإدارة:</b> ${esc(r.managementNote)}</p>`:''}<small>${esc(r.date)}</small></div>`).join('');
 }catch(e){$('#statusResults').innerHTML='';msg($('#statusMessage'),e.message,'error')}finally{$('#statusBtn').disabled=false}
};