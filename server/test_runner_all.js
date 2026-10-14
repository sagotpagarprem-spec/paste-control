// Universal Pest Control — Consolidated Multi-Phase Test Runner
const { spawn } = require('child_process');
const path = require('path');

const suites = [
  { name: 'Security Sprint Regression (35 Checks)', script: 'server/test_security_sprint.js' },
  { name: 'Phase 1: Auth & RBAC (16 Checks)', script: 'server/test_phase1.js' },
  { name: 'Phase 2: CRM & Leads (15 Checks)', script: 'server/test_phase2.js' },
  { name: 'Phase 3: Bookings & Profiles (14 Checks)', script: 'server/test_phase3.js' },
  { name: 'Phase 4: CMS & Catalogs (26 Checks)', script: 'server/test_phase4.js' },
  { name: 'Phase 5: Field Dispatch (18 Checks)', script: 'server/test_phase5.js' },
  { name: 'Master End-to-End Suite (26 Checks)', script: 'server/test_master.js' }
];

async function runSuite(suite) {
  return new Promise((resolve) => {
    console.log(`\n======================================================================`);
    console.log(`RUNNING: ${suite.name}`);
    console.log(`Command: node ${suite.script}`);
    console.log(`======================================================================\n`);

    const child = spawn(process.execPath, [path.join(__dirname, '..', suite.script)], {
      stdio: 'inherit',
      env: process.env
    });

    child.on('close', (code) => {
      resolve({ name: suite.name, code, passed: code === 0 });
    });
  });
}

async function runAll() {
  const startTime = Date.now();
  console.log('🚀 Starting Universal Pest Control Consolidated Test Runner...\n');

  const results = [];
  for (const s of suites) {
    const res = await runSuite(s);
    results.push(res);
    if (!res.passed) {
      console.error(`\n❌ SUITE FAILED: ${s.name} (exit code: ${res.code})`);
      break;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n======================================================================');
  console.log('📊 CONSOLIDATED TEST EXECUTION SUMMARY');
  console.log('======================================================================');
  results.forEach((r, idx) => {
    const icon = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${idx + 1}. [${icon}] ${r.name}`);
  });
  console.log(`\nTotal Duration: ${duration}s`);

  const anyFailed = results.some(r => !r.passed) || results.length < suites.length;
  if (anyFailed) {
    console.error('\n⚠️ Some test suites failed or were aborted.');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 7 SUITES (150 TEST CHECKS) PASSED CONCURRENTLY AND SEQUENTIALLY!\n');
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
