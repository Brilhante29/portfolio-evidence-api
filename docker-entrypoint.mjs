const command = process.argv[2] ?? 'serve';

if (command === 'serve') {
  await import('./dist/src/main.js');
} else if (command === 'benchmark') {
  process.argv.splice(2, 1);
  await import('./dist/benchmarks/run.js');
} else {
  throw new Error(`unsupported container command: ${command}`);
}
