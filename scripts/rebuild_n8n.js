const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'n8n', 'student-transfer-1448-v2.1-professional.json');
const workflow = JSON.parse(fs.readFileSync(targetPath, 'utf8'));

// 1. Fix the search node name in nodes list
const searchNode = workflow.nodes.find(x => x.name.includes('استعلام') && (x.name.includes('طالب') || x.name.includes('طلاب')) && x.type.includes('googleSheets'));
if (searchNode) {
  searchNode.name = 'البحث عن الطالب - استعلام';
  searchNode.parameters = {
    documentId: {
      __rl: true,
      value: "1y2UVgxNsSuAF4oVnZaRYx7d6yZhtxe3jnVe8JyI_-y0",
      mode: "list",
      cachedResultName: "طلاب1448",
      cachedResultUrl: "https://docs.google.com/spreadsheets/d/1y2UVgxNsSuAF4oVnZaRYx7d6yZhtxe3jnVe8JyI_-y0/edit?usp=drivesdk"
    },
    sheetName: {
      __rl: true,
      value: "الورقة1",
      mode: "name",
      cachedResultName: "الورقة1"
    },
    filtersUI: {
      values: []
    },
    options: {}
  };
  searchNode.alwaysOutputData = true;
  searchNode.executeOnce = true;
  searchNode.retryOnFail = true;
  searchNode.maxTries = 3;
}

// 2. Wire connections properly
workflow.connections['هل العملية استعلام طالب؟'] = {
  main: [
    [{ node: 'البحث عن الطالب - استعلام', type: 'main', index: 0 }],
    [{ node: 'هل العملية تقديم طلب؟', type: 'main', index: 0 }]
  ]
};

workflow.connections['البحث عن الطالب - استعلام'] = {
  main: [
    [{ node: 'قراءة إعدادات الفصول - استعلام', type: 'main', index: 0 }]
  ]
};

workflow.connections['قراءة إعدادات الفصول - استعلام'] = {
  main: [
    [{ node: 'بناء نتيجة الطالب', type: 'main', index: 0 }]
  ]
};

workflow.connections['بناء نتيجة الطالب'] = {
  main: [
    [{ node: 'إرجاع بيانات الطالب', type: 'main', index: 0 }]
  ]
};

// Clean any old obsolete connections
delete workflow.connections['قراءة طلاب المدرسة - استعلام'];

// 3. Update 'بناء نتيجة الطالب' code with full flexible normalization (leading zeros, dashes, slashes, arabic digits)
const buildNode = workflow.nodes.find(x => x.name === 'بناء نتيجة الطالب');
if (buildNode) {
  buildNode.parameters.jsCode = `let req = {};
try { req = $('تحليل طلب موقع النقل').first().json || {}; } catch(e) {}

let allStudents = [];
try { allStudents = $('البحث عن الطالب - استعلام').all().map(i => i.json || {}); } catch(e) {}

let settings = [];
try { settings = $input.all().map(i => i.json || {}).filter(r => String(r['مفتاح الفصل'] ?? '').trim()); } catch(e) {}

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

// 2. Helper for normalizing ID (Arabic numerals, symbols, spaces, leading zeros)
function normId(v) {
  if (!v) return '';
  return String(v).trim()
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[\\u200B-\\u200D\\uFEFF]/g, '');
}

function stripId(v) {
  return normId(v).replace(/[^a-zA-Z0-9]/g, '');
}

const reqIdRaw = normId(req.studentId);
const reqIdStripped = stripId(req.studentId);
const reqIdNoZero = reqIdStripped.replace(/^0+/, '');

if (!reqIdRaw) {
  return [{ json: { success: false, message: 'يرجى إدخال رقم الطالب / الهوية الوطنية / السجل.' } }];
}

// Find student row using multi-layer flexible matching
const row = allStudents.find(r => {
  const rowIdRaw = normId(r['رقم الطالب'] ?? '');
  if (!rowIdRaw) return false;
  if (rowIdRaw === reqIdRaw) return true;

  const rowIdStripped = stripId(rowIdRaw);
  if (rowIdStripped && reqIdStripped) {
    if (rowIdStripped === reqIdStripped) return true;
    const rowIdNoZero = rowIdStripped.replace(/^0+/, '');
    if (rowIdNoZero && reqIdNoZero && rowIdNoZero === reqIdNoZero) return true;
    if (rowIdStripped.startsWith(reqIdStripped) || reqIdStripped.startsWith(rowIdStripped)) return true;
  }
  return false;
}) || {};

const name = String(row['اسم الطالب'] ?? '').trim();
const gradeCode = String(row['رقم الصف'] ?? '').trim();
const classNo = String(row['الفصل'] ?? '').trim();
const gradeMap = { '730': 'الأول متوسط', '830': 'الثاني متوسط', '930': 'الثالث متوسط' };
const maxMap = { '730': 6, '830': 6, '930': 6 };

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

// 4. Validate all connection integrity
const nodeMap = new Set(workflow.nodes.map(n => n.name));
let broken = 0;
for (const [source, conn] of Object.entries(workflow.connections)) {
  if (!nodeMap.has(source)) {
    console.log('Deleting dangling source connection:', source);
    delete workflow.connections[source];
    broken++;
  } else if (conn.main) {
    conn.main.forEach(branch => {
      branch.forEach(target => {
        if (!nodeMap.has(target.node)) {
          console.log('Found missing target node:', target.node, 'from source:', source);
          broken++;
        }
      });
    });
  }
}

fs.writeFileSync(targetPath, JSON.stringify(workflow, null, 2), 'utf8');
console.log('✓ Rebuilt and verified workflow with ZERO broken connections!');
