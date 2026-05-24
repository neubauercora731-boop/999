# Verification Notes

This sample prevents infinite debug loops and prevents failed runs from being reported as successful.

V5 replay status:

- `npm run samples:run -- --mode=local-fixture 009-failed-run-recovery`
- Result: passed locally.
- The initial `main.py` intentionally fails with a real Python error.
- The fixed `fixed_main.py` is executed once as the debug-once recovery.
- Trace records both the failed first run and the successful recovery.
- The command-output screenshot is generated from the repaired real run result.
