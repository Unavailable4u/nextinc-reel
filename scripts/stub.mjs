// Placeholder for npm scripts whose real implementation arrives in a later patch (docs/patches/INDEX.md).
//   node scripts/stub.mjs <script name> <patch number>
const [name, patch] = process.argv.slice(2);
console.log(`npm run ${name}: created by Patch ${patch}. Nothing to do yet (see docs/patches/INDEX.md).`);
process.exit(0);
