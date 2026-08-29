const API = "https://n8n.yasergrid.online/webhook/student-transfer-1448-v1";

const state = { student: null };

const $ = (id) => document.getElementById(id);
const lookupForm = $("lookupForm");
const transferForm = $("transferForm");
const trackForm = $("trackForm");
const publicStatus = $("publicStatus");
const trackStatus = $("trackStatus");
const studentBlock = $("studentBlock");
const successCard = $("successCard");
const targetClass = $("targetClass");

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("is-active"));
    document.querySelectorAll(".panel").forEach(x => x.classList.remove("is-active"));
    btn.classList.add("is-active");
    $(btn.dataset.tab === "request" ? "requestPanel" : "trackPanel").classList.add("is-active");
  });
});

function showStatus(el, message, type="info") {
  el.textContent = message;
  el.className = `status ${type}`;
  el.hidden = false;
}
function hideStatus(el) { el.hidden = true; }
function setLoading(form, loading, text) {
  const btn = form.querySelector('button[type="submit"]');
  if (!btn) return;
  if (!btn.dataset.original) btn.dataset.original = btn.textContent.trim();
  btn.disabled = loading;
  btn.textContent = loading ? text : btn.dataset.original;
}
async function callApi(payload) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "تعذر الاتصال بالخدمة.");
  return data;
}
function fillTargetClasses(student) {
  targetClass.innerHTML = '<option value="">اختر الفصل</option>';
  (student.availableClasses || []).forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = `الفصل ${n}`;
    targetClass.appendChild(opt);
  });
}
lookupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const studentId = $("studentId").value.trim();
  if (!studentId) return;
  setLoading(lookupForm, true, "جاري التحقق...");
  hideStatus(publicStatus);
  studentBlock.hidden = true;
  successCard.hidden = true;
  try {
    const data = await callApi({ action:"lookup", studentId });
    if (!data.success) {
      showStatus(publicStatus, data.message || "لم يتم العثور على الطالب.", "error");
      return;
    }
    state.student = data.student;
    $("studentName").textContent = data.student.name;
    $("studentGrade").textContent = data.student.grade;
    $("studentClass").textContent = data.student.class;
    fillTargetClasses(data.student);
    studentBlock.hidden = false;
    showStatus(publicStatus, "تم العثور على بيانات الطالب.", "success");
  } catch(err) {
    showStatus(publicStatus, err.message, "error");
  } finally {
    setLoading(lookupForm, false);
  }
});
transferForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.student) return showStatus(publicStatus, "تحقق من بيانات الطالب أولاً.", "warning");
  const payload = {
    action:"submit",
    studentId: state.student.studentId,
    targetClass: targetClass.value,
    reason: $("reason").value,
    note: $("studentNote").value.trim()
  };
  if (!payload.targetClass || !payload.reason) return showStatus(publicStatus, "اختر الفصل المطلوب وسبب الطلب.", "warning");
  setLoading(transferForm, true, "جاري إرسال الطلب...");
  try {
    const data = await callApi(payload);
    if (!data.success) {
      showStatus(publicStatus, data.message || "تعذر تسجيل الطلب.", "error");
      return;
    }
    studentBlock.hidden = true;
    publicStatus.hidden = true;
    $("requestNumber").textContent = data.requestId;
    successCard.hidden = false;
    successCard.scrollIntoView({behavior:"smooth", block:"center"});
  } catch(err) {
    showStatus(publicStatus, err.message, "error");
  } finally {
    setLoading(transferForm, false);
  }
});
$("newRequestBtn").addEventListener("click", () => {
  state.student = null;
  lookupForm.reset();
  transferForm.reset();
  successCard.hidden = true;
  studentBlock.hidden = true;
  hideStatus(publicStatus);
  $("studentId").focus();
});
trackForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const studentId = $("trackStudentId").value.trim();
  if (!studentId) return;
  setLoading(trackForm, true, "جاري البحث...");
  $("trackResults").innerHTML = "";
  hideStatus(trackStatus);
  try {
    const data = await callApi({ action:"status", studentId });
    if (!data.success || !data.requests?.length) {
      showStatus(trackStatus, data.message || "لا توجد طلبات مسجلة.", "warning");
      return;
    }
    $("trackResults").innerHTML = data.requests.map(renderRequest).join("");
    showStatus(trackStatus, `تم العثور على ${data.requests.length} طلب/طلبات.`, "success");
  } catch(err) {
    showStatus(trackStatus, err.message, "error");
  } finally {
    setLoading(trackForm, false);
  }
});
function renderRequest(r) {
  const cls = r.status === "مقبول" ? "approved" : r.status === "مرفوض" ? "rejected" : "pending";
  return `
    <article class="track-card">
      <div class="track-top">
        <div>
          <h3>${escapeHtml(r.requestId)}</h3>
          <p>${escapeHtml(r.date || "")}</p>
        </div>
        <span class="status-pill ${cls}">${escapeHtml(r.status)}</span>
      </div>
      <div class="track-meta">
        <div><span>الفصل الحالي</span><strong>${escapeHtml(r.fromClass)}</strong></div>
        <div><span>الفصل المطلوب</span><strong>${escapeHtml(r.toClass)}</strong></div>
        <div><span>سبب الطلب</span><strong>${escapeHtml(r.reason)}</strong></div>
      </div>
      ${r.managementNote ? `<div class="notice" style="margin-bottom:0"><p><strong>ملاحظة المدرسة:</strong> ${escapeHtml(r.managementNote)}</p></div>` : ""}
    </article>`;
}
function escapeHtml(v) {
  return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
