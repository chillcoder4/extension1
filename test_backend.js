import { spawn } from 'child_process';

const server = spawn('node', ['server.js']);
let isTestRunning = false;

// Handle timeout just in case
setTimeout(() => {
  console.error("Test timeout. Killing server.");
  server.kill();
  process.exit(1);
}, 15000);

server.stdout.on('data', async (data) => {
  const output = data.toString();
  console.log(output.trim());
  
  if (output.includes('running on http://localhost:3000') && !isTestRunning) {
    isTestRunning = true;
    try {
      console.log('\n--- Sending mock AI logic request ---');
      const res = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: "The quick brown fox jumps over the lazy dog. This is a classic pangram containing every letter of the English alphabet." })
      });
      
      const json = await res.json();
      console.log(`\n--- Response Status: ${res.status} ---`);
      console.log('Data:', JSON.stringify(json, null, 2));
      
      if (res.ok && json.summary) {
        console.log('\n✅ AI API Proxy & Failover Test PASSED!');
      } else {
        console.error('\n❌ AI Proxy Test FAILED!');
      }
    } catch(e) {
      console.error('\n❌ Fetch Error:', e);
    } finally {
      server.kill();
      process.exit(0);
    }
  }
});

server.stderr.on('data', (data) => {
  console.error("[Server Error]", data.toString().trim());
});
