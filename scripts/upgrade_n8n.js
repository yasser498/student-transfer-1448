const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'n8n', 'student-transfer-1448-v2.1-professional.json');
const workflow = JSON.parse(fs.readFileSync(targetPath, 'utf8'));

// 1. Update 'البحث عن الطالب - استعلام' to read all rows of 'الورقة1' so it can count live students
const searchStudentNode = workflow.nodes.find(x => x.name === 'البحث عن الطالب - استعلام');
if (searchStudentNode) {
  searchStudentNode.name = 'قراءة طلاب المدرسة - استعلام';
  searchStudentNode.parameters.filtersUI = { values: [] };
}

// 2. Update connections
if (workflow.connections['هل العملية استعلام طالب؟']) {
  workflow.connections['هل العملية استعلام طالب؟'].main[0] = [{
    node: 'قراءة طلاب المدرسة - استعلام',
    type: 'main',
    index: 0
  }];
}

if (workflow.connections['البحث عن الطالب - استعلام']) {
  workflow.connections['قراءة طلاب المدرسة - استعلام'] = workflow.connections['البحث عن الطالب - استعلام'];
  delete workflow.connections['البحث عن الطالب - استعلام'];
}

// 3. Update 'بناء نتيجة الطالب' code
const buildStudentNode = workflow.nodes.find(x => x.name === 'بناء نتيجة الطالب');
if (buildStudentNode) {
  buildStudentNode.parameters.jsCode = `const req = $('تحليل طلب موقع النقل').first().json;
const allStudents = $('قراءة طلاب المدرسة - استعلام').all().map(i => i.json || {});
const settings = $('قراءة إعدادات الفصول - استعلام').all().map(i => i.json || {}).filter(r => String(r['مفتاح الفصل'] ?? '').trim());

// 1. Check global portal lock & auto capacity lock settings
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

const autoCapRow = settings.find(r => String(r['مفتاح الفصل'] ?? '').trim() === 'SYSTEM-AUTO-CAP-LOCK' || String(r['مفتاح الفصل'] ?? '').trim() === 'AUTO-CAP-LOCK');
const isAutoCapEnabled = autoCapRow ? String(autoCapRow['متاح للنقل'] ?? 'نعم').trim() !== 'لا' : true;

// 2. Find the requested student
const studentId = String(req.studentId ?? '').trim();
if (!studentId) {
  return [{ json: { success: false, message: 'يرجى إدخال رقم الطالب / الهوية.' } }];
}

const row = allStudents.find(r => String(r['رقم الطالب'] ?? '').trim() === studentId) || {};
const name = String(row['اسم الطالب'] ?? '').trim();
const gradeCode = String(row['رقم الصف'] ?? '').trim();
const classNo = String(row['الفصل'] ?? '').trim();
const gradeMap = { '730': 'الأول متوسط', '830': 'الثاني متوسط', '930': 'الثالث متوسط' };
const maxMap = { '730': 6, '830': 6, '930': 6 };

if (!name || !gradeMap[gradeCode] || !classNo) {
  return [{ json: { success: false, message: 'لم يتم العثور على بيانات الطالب في سجلات المدرسة.' } }];
}

// 3. Count live students currently enrolled in each class of this grade
const classCounts = {};
for (const s of allStudents) {
  if (String(s['رقم الصف'] ?? '').trim() === gradeCode) {
    const c = String(s['الفصل'] ?? '').trim();
    if (c) {
      classCounts[c] = (classCounts[c] || 0) + 1;
    }
  }
}

// 4. Build configuration and capacity limits for each class
const config = {};
for (const r of settings) {
  const key = String(r['مفتاح الفصل'] ?? '').trim();
  const targetCount = Number(String(r['العدد المستهدف'] ?? '').trim()) || 33;
  config[key] = {
    available: String(r['متاح للنقل'] ?? 'نعم').trim() !== 'لا',
    excluded: String(r['مستبعد من الموازنة'] ?? 'لا').trim() === 'نعم',
    target: targetCount
  };
}

// 5. Dynamic class filter:
// - Always exclude the student's current class
// - Exclude manually closed or excluded classes
// - IF Auto Capacity Lock is ENABLED (isAutoCapEnabled): dynamically hide class if live count >= target!
// - IF Auto Capacity Lock is DISABLED: show all available classes regardless of count!
const availableClasses = Array.from({ length: maxMap[gradeCode] || 6 }, (_, i) => String(i + 1)).filter(c => {
  if (c === classNo) return false;
  const key = gradeCode + '-' + c;
  const s = config[key];
  if (s && s.excluded) return false;
  if (s && !s.available) return false;

  if (isAutoCapEnabled) {
    const currentCount = classCounts[c] || 0;
    const target = (s && s.target) ? s.target : 33;
    if (currentCount >= target) return false; // Full -> Hide
  }

  return true;
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

// 4. Update 'التحقق من إتاحة الفصل للنقل' in transfer submission
const checkTransferNode = workflow.nodes.find(x => x.name === 'التحقق من إتاحة الفصل للنقل');
if (checkTransferNode) {
  checkTransferNode.parameters.jsCode = `const prep = $('التحقق من طلب النقل').first().json;
const row = $input.first()?.json ?? {};
const found = String(row['مفتاح الفصل'] ?? '').trim();
const available = found ? String(row['متاح للنقل'] ?? 'نعم').trim() !== 'لا' : true;
const excluded = found ? String(row['مستبعد من الموازنة'] ?? 'لا').trim() === 'نعم' : false;

const canContinue = available && !excluded;

return [{
  json: {
    ...prep,
    canContinue: canContinue,
    message: canContinue ? '' : 'الفصل ' + prep.toClass + ' غير متاح أو مكتمل الطاقة الاستيعابية حالياً. اختر فصلاً آخر به مقاعد شاغرة.'
  }
}];`;
}

fs.writeFileSync(targetPath, JSON.stringify(workflow, null, 2), 'utf8');
console.log('✓ Successfully upgraded n8n workflow JSON with 100% Dynamic Live Capacity Engine!');
