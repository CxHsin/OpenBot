---
id: 050-promise-extraction
phase: P5
status: red
decides: that a promise made in conversation becomes a dated commitment the Bot acts on
---

## Input

The person says, in passing in a longer conversation: "Remind me to check the renewal on the 12th."

## Expected

- A commitment row exists with the date the 12th resolves to, the person as owner, and the
  conversation it came from.
- No message is sent at extraction time.
- On the 12th, the commitment produces one ping, through the existing hourly slot, not a separate
  notification path.

## How to check

The commitment row, then the ping row on the date. Time can be advanced in the test database.
