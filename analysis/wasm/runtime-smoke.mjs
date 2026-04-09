import createRuntimeSmokeModule from './runtime-smoke.generated.mjs';

await createRuntimeSmokeModule({
    arguments: process.argv.slice(2)
});
