const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'n8n', 'student-transfer-1448-v2.1-professional.json');
const workflow = JSON.parse(fs.readFileSync(targetPath, 'utf8'));

workflow.nodes.forEach(n => {
  if (n.type.includes('code') && n.parameters && n.parameters.jsCode) {
    let code = n.parameters.jsCode;
    // Replace unsafe .first().json with ($('...').first()?.json || {})
    code = code.replace(/\$input\.first\(\)\.json/g, '($input.first()?.json || {})');
    code = code.replace(/\$\('([^']+)'\)\.first\(\)\.json/g, "($('$1').first()?.json || {})");
    n.parameters.jsCode = code;
  }
});

fs.writeFileSync(targetPath, JSON.stringify(workflow, null, 2), 'utf8');
console.log('✓ Successfully fortified all n8n code nodes against undefined errors!');
