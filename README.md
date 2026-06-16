# Match-3 Core Windows A + B + C

This folder contains Window A scope:

- 8x8 board generation
- adjacent swap
- match detection
- clear
- gravity
- refill
- chain resolution
- clear output with damage data
- resolve summary output for downstream systems

This folder also contains Window B pure combat logic:

- MAEE hero hp and shield state
- 6 fairy-tale enemy waves
- match result damage conversion
- enemy attack counters
- freeze, shield, armor break, heal, win, and loss rules

This folder also contains Window C skill and event output logic:

- 4-match skill triggers
- 5-match ultimate triggers
- extra skill damage
- combat status effects from skills
- VFX event output
- board effect requests for later UI/integration execution

Out of scope for these windows:

- real VFX animation
- executing board effect requests
- start page
- gameplay UI layout

Run checks:

```sh
npm install
npm test
npm run typecheck
```

Run the plain board preview:

```sh
npm run dev
```
