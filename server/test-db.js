const { Client } = require('pg');
const fs = require('fs');

const urls = [
  "postgresql://postgres:%402wearebuil@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=no-verify",
  "postgresql://postgres:%402wearebuil@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=no-verify",
  "postgresql://postgres.lvceslvrecthiedzvoyy:%402wearebuil@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=no-verify"
];

async function run() {
  const results = [];
  for (const url of urls) {
    const safeUrl = url.replace('%402wearebuil', '***');
    let res = { url: safeUrl };
    const client = new Client({ connectionString: url });
    try {
      await client.connect();
      const q = await client.query('SELECT 1 as connected');
      res.success = true;
      await client.end();
    } catch (err) {
      res.success = false;
      res.error = err.message;
    }
    results.push(res);
  }
  fs.writeFileSync('out3.json', JSON.stringify(results, null, 2));
}

run();
