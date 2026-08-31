const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'n8n', 'student-transfer-1448-v2.1-professional.json');
const workflow = JSON.parse(fs.readFileSync(targetPath, 'utf8'));

// 1. Ensure student search is exact and fast (filters by studentId)
const searchNode = workflow.nodes.find(x => x.name.includes('استعلام') && x.name.includes('طالب') && x.type.includes('googleSheets'));
if (searchNode) {
  searchNode.name = 'البحث عن الطالب - استعلام';
  searchNode.parameters.filtersUI = {
    values: [{ lookupColumn: 'رقم الطالب', lookupValue: '={{ $json.studentId }}' }]
  };
}

// 2. Re-wire connections
if (workflow.connections['هل العملية استعلام طالب؟']) {
  workflow.connections['هل العملية استعلام طالب؟'].main[0] = [{
    node: 'البحث عن الطالب - استعلام',
    type: 'main',
    index: 0
  }];
}

workflow.connections['البحث عن الطالب - استعلام'] = {
  main: [[{
    node: 'قراءة إعدادات الفصول - استعلام',
    type: 'main',
    index: 0
  }]]
};
delete workflow.connections['قراءة طلاب المدرسة - استعلام'];

// 3. Update 'بناء نتيجة الطالب'
const buildNode = workflow.nodes.find(x => x.name === 'بناء نتيجة الطالب');
if (buildNode) {
  buildNode.parameters.jsCode = `const req = $('تحليل طلب موقع النقل').first().json;
const row = $('البحث عن الطالب - استعلام').first()?.json ?? {};
const settings = $input.all().map(i => i.json || {}).filter(r => String(r['مفتاح الفصل'] ?? '').trim());

// 1. Check global portal lock
const portalLockRow = settings.find(r => String(r['مفتاح الفصل'] ?? '').trim() === 'PORTAL-STATUS');
const isPortalLocked = portalLockRow ? String(portalLockRow['متاح للنقل'] ?? 'نعم').trim() === 'لا' : false;

if (isPortalLocked) {
  return [{
    json: {
      success: false,
      portalLocked: true,
      message: 'سوف يُتاح الموقع قريباً لنقل الطلاب. البوابة مغلقة حالياً من قِبل إدارة المدرسة.'
    }
  }];
}

// 2. Student Info & Normalization
function normId(v) {
  if (!v) return '';
  return String(v).trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\u200B-\u200D\uFEFF]/g, '');
}

const reqIdRaw = normId(req.studentId);
const name = String(row['اسم الطالب'] ?? '').trim();
const gradeCode = String(row['رقم الصف'] ?? '').trim();
const classNo = String(row['الفصل'] ?? '').trim();
const gradeMap = { '730': 'الأول متوسط', '830': 'الثاني متوسط', '930': 'الثالث متوسط' };
const maxMap = { '730': 6, '830': 6, '930': 6 };

if (!reqIdRaw) {
  return [{ json: { success: false, message: 'يرجى إدخال رقم الطالب / الهوية الوطنية / السجل.' } }];
}

if (!name || !gradeMap[gradeCode] || !classNo) {
  return [{ json: { success: false, message: 'لم يتم العثور على بيانات الطالب في سجلات المدرسة. يرجى التأكد من صحة رقم الهوية.' } }];
}

// 3. Class Configuration Map
const config = {};
for (const r of settings) {
  const key = String(r['مفتاح الفصل'] ?? '').trim();
  config[key] = {
    available: String(r['متاح للنقل'] ?? 'نعم').trim() !== 'لا',
    excluded: String(r['مستبعد من الموازنة'] ?? 'لا').trim() === 'نعم'
  };
}

// 4. Return all open classes (excluding current class and excluded classes)
const availableClasses = Array.from({ length: maxMap[gradeCode] || 6 }, (_, i) => String(i + 1)).filter(c => {
  if (c === classNo) return false;
  const key = gradeCode + '-' + c;
  const s = config[key];
  if (s && s.excluded) return false;
  return !s || s.available;
});

return [{
  json: {
    success: true,
    student: {
      studentId: req.studentId,
      name,
      gradeCode,
      grade: gradeMap[gradeCode],
      class: classNo,
      availableClasses
    }
  }
}];`;
}

// 4. Update 'بناء متابعة الطلبات' to support flexible ID matching
const statusBuildNode = workflow.nodes.find(x => x.name === 'بناء متابعة الطلبات');
if (statusBuildNode) {
  statusBuildNode.parameters.jsCode = `const req = $('تحليل طلب موقع النقل').first().json;
function normId(v) {
  if (!v) return '';
  return String(v).trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\u200B-\u200D\uFEFF]/g, '');
}
function stripId(v) {
  return normId(v).replace(/[^a-zA-Z0-9]/g, '');
}

const reqId = normId(req.studentId);
const reqIdStripped = stripId(req.studentId);

const allRows = $input.all().map(i => i.json || {}).filter(r => String(r['رقم الطلب'] ?? '').trim());

// Match requests flexibly
const rows = allRows.filter(r => {
  const rowId = normId(r['رقم الطالب'] ?? '');
  if (!rowId) return false;
  if (rowId === reqId) return true;
  const rowIdStripped = stripId(rowId);
  if (rowIdStripped && reqIdStripped) {
    if (rowIdStripped === reqIdStripped) return true;
    if (rowIdStripped.startsWith(reqIdStripped) || reqIdStripped.startsWith(rowIdStripped)) return true;
  }
  return false;
});

rows.sort((a, b) => String(b['تاريخ الطلب'] ?? '').localeCompare(String(a['تاريخ الطلب'] ?? '')));
const requests = rows.slice(0, 8).map(r => ({
  requestId: String(r['رقم الطلب'] ?? ''),
  date: String(r['تاريخ الطلب'] ?? ''),
  status: String(r['الحالة'] ?? 'قيد المراجعة'),
  fromClass: String(r['الفصل الحالي'] ?? ''),
  toClass: String(r['الفصل المطلوب'] ?? ''),
  reason: String(r['سبب الطلب'] ?? ''),
  managementNote: String(r['ملاحظة الإدارة'] ?? '')
}));

return [{ json: { success: true, requests, message: requests.length ? '' : 'لا توجد طلبات مسجلة لهذا الطالب.' } }];`;
}

// 5. Ensure settings read has executeOnce & retries
const settingsNode = workflow.nodes.find(x => x.name === 'قراءة إعدادات الفصول - استعلام');
if (settingsNode) {
  settingsNode.executeOnce = true;
  settingsNode.retryOnFail = true;
  settingsNode.maxTries = 3;
}

fs.writeFileSync(targetPath, JSON.stringify(workflow, null, 2), 'utf8');
console.log('✓ Successfully finalized clean n8n workflow with flexible ID matching!');
