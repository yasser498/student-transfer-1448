# نظام نقل الطلاب 1448 — V2.1 PROFESSIONAL

مدرسة عماد الدين زنكي المتوسطة

## ما تم إصلاحه في هذه النسخة؟
الصفحة القديمة ظهرت كـ HTML خام لأن ملفات CSS/JS كانت تُطلب بمسارات نسبية، ومع طريقة توجيه Vercel أصبحت بعض الصفحات تبحث عن الملفات في مسار غير صحيح.

في V2.1:
- جميع CSS وJS والشعار تستخدم مسارات مطلقة تبدأ بـ `/`.
- لا نعتمد على `cleanUrls`.
- تم إضافة Cache headers مناسبة حتى يظهر التصميم الجديد بعد النشر.
- واجهة الإدارة أُعيد تصميمها بالكامل.

## محتويات المشروع
- `/index.html` موقع الطالب
- `/assets/student.css`
- `/assets/student.js`
- `/assets/config.js`
- `/assets/moe-logo.png`
- `/trans/index.html` لوحة الإدارة
- `/trans/classes.html` إدارة الفصول
- `/trans/report.html` التقرير النهائي
- `/trans/settings.html` الإعدادات
- `/trans/admin.css`
- `/trans/common.js`
- `/trans/dashboard.js`
- `/trans/classes.js`
- `/trans/report.js`
- `/trans/settings.js`
- `/n8n/student-transfer-1448-v2.1-professional.json`
- `/vercel.json`

## التفعيل في n8n
1. استورد `n8n/student-transfer-1448-v2.1-professional.json`.
2. إذا طلب n8n إعادة اختيار Google Sheets Credential فاختر الحساب الحالي.
3. عطّل Workflow القديم الذي يستخدم نفس Webhooks.
4. فعّل V2.1 فقط.
5. لا تشغّل نسختين تستخدمان نفس:
   - `student-transfer-1448-v1`
   - `student-transfer-1448-trans-v1`

## إدارة الفصول
من:
`https://student-transfer-1448.vercel.app/trans/classes.html`

- العدد الحالي يُقرأ من بيانات الطلاب.
- `متاح لاستقبال النقل`:
  - تشغيل = يظهر الفصل للطالب.
  - إيقاف = يختفي من موقع الطالب.
  - Backend يتحقق من ذلك أيضًا عند الإرسال.
- `مستبعد من الموازنة` = لا يدخل في حساب الهدف.
- العدد المستهدف = يدوي أو تلقائي.
- يمكن حفظ فصل واحد أو جميع التعديلات.

## التقرير النهائي
`https://student-transfer-1448.vercel.app/trans/report.html`

يشمل:
- إجمالي الطلاب والطلبات.
- قيد المراجعة / المقبول / المرفوض.
- أعداد جميع الفصول.
- الهدف التلقائي والفعلي.
- الاحتياج أو الفائض.
- الفصول المغلقة والمستبعدة.
- خطة موازنة مقترحة.
- جميع الطلبات والقرارات.
- تاريخ القرار ومن اعتمده.
- طباعة / حفظ PDF.
- تصدير CSV.

## الرفع على Vercel
ارفع **محتويات هذا المجلد** إلى جذر مستودع GitHub المرتبط بمشروع Vercel، وليس المجلد نفسه داخل مجلد إضافي.

بعد Deploy افتح:
- الطالب: `/`
- الإدارة: `/trans/`
- الفصول: `/trans/classes.html`
- التقرير: `/trans/report.html`
- الإعدادات: `/trans/settings.html`

إذا ظهر التصميم القديم بعد Deploy، نفّذ Redeploy من Vercel ثم Hard Refresh للمتصفح.
