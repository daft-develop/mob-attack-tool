# TESTING

There are two kinds of tests:

* **Unit tests** (Vitest, `test/unit/`) run without Foundry: `npm test`. Run them, and `npm run lint`, before every commit.
* **End-to-end tests** (Playwright, `e2e/`) run against a real local Foundry server, including the [Quench](https://foundryvtt.com/packages/quench) batches in `scripts/quench.js`.

## Test world setup

The Quench batches and the end-to-end tests expect a world (named `testing` by default) with the [Quench](https://foundryvtt.com/packages/quench) module installed. The Quench preflight suite checks the setup, but generally you'll need to set up the following by hand:

* A scene named 'Scene' that is active, global lighting enabled, token vision disabled, and no background image. This is to ensure reloading the page for repeat testing is reasonably quick

* Import the testing actors (randal and skeleton) from the test_data folder of this repo. This will ensure you have the expected tokens with testing items setup on the sheet to match the quench test plan

* Import Sefris from the legacy starting heros, ensure he's level 5 (to check Eldritch Blast scaling) and place on the scene

* Import the legacy 'Archmage' and place one instance in the scene

Keep one token of each on the scene; Multilevel Tokens clones are ignored.

## End-to-end tests

Copy `.env.example` to `.env` and list your local installs as targets: one Foundry install folder and one data folder per Foundry/dnd5e combination. Nothing machine-specific is in the code.

* `npm run test:e2e` runs every test for one target: `FOUNDRY_TARGET`, or the first in `FOUNDRY_TARGETS`
* `npm run test:e2e:all` runs them for every target in turn and prints a summary
* Arguments go to Playwright, e.g. `npm run test:e2e -- e2e/quench.spec.mjs` or `-g "damage card"`

Each run starts Foundry on its own port (`FOUNDRY_PORT`) with a throwaway data folder built from the target's: the world is copied fresh, systems and modules are mirrored (compendium packs copied, so Foundry never writes to your installs), and `mob-attack-tool` points at this repository. Your own worlds are never changed, and a Foundry instance you have running on the same data folder is not disturbed. Updates to your data folders are picked up on the next run.

Tests turn modules on or off in the throwaway world as they need them (`ensureModules` in `e2e/fixtures.mjs`); a target's `DISABLE_MODULES` leaves modules out entirely, e.g. midi-qol where it isn't compatible yet. Dice are scripted with `queueDice` (`e2e/dice.mjs`), and tests place their own tokens (`e2e/scene.mjs`).

To run the Quench batches by hand instead, enable Quench in your world and uncomment the `initQuenchTests()` lines in mobAttack.js (don't commit that).
