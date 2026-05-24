# Verification Notes

`npm run samples:run -- --mode=local-fixture 002-real-run-screenshot-workflow` runs `input-files/main.py`, captures real stdout/stderr/exitCode/runtime, renders `command_output_screenshot`, and writes local replay artifacts under `.tmp/sample-runs/002-real-run-screenshot-workflow/`.

The replay does not use Supabase and does not upload artifacts. It is intended as a fast local regression guard for the command-output screenshot workflow.
