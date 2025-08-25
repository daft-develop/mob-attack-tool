# TESTING

## Test Setup

I'm using the [Quench](https://foundryvtt.com/packages/quench) module for performing unit tests within Foundry. You can install the module like any other, enable it in your test world, and then uncomment the initQuenchTests() line in mobAttack.js to have it automatically bring in the tests.

The tests perform a preflight suite to ensure your actors are setup correctly, but generally you'll need to manually set up the following:

* A scene named 'Scene' that is active, global lighting enabled, token vision disabled, and no background image. This is to ensure reloading the page for repeat testing is reasonably quick

* Import the testing actors (randal and skeleton) from the test_data folder of this repo. This will ensure you have the expected tokens with testing items setup on the sheet to match the quench test plan

* Import Sefris from the legacy starting heros, ensure he's level 5 (to check Eldritch Blast scaling) and place on the scene

* Import the legacy 'Archmage' and place one instance in the scenen
