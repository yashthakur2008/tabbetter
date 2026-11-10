// Replaces only the network boundary in importer subprocess tests.
import fs from 'node:fs';
const fixtures = JSON.parse(fs.readFileSync(process.env.TABBETTER_IMPORT_FIXTURES, 'utf8'));
globalThis.fetch = async (input) => {
  const url = String(input);
  fs.appendFileSync(process.env.TABBETTER_IMPORT_REQUESTS, url + '\n');
  const fixture = fixtures[url];
  return fixture === undefined
    ? new Response('Not found', { status: 404 })
    : new Response(typeof fixture === 'string' ? fixture : JSON.stringify(fixture));
};
