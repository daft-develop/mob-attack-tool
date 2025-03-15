# TESTING

## Test Setup

I'm using the wonderful [Quench](https://foundryvtt.com/packages/quench) module for performing unit tests within Foundry. You can install the module like any other, enable it in your test world, and then uncomment the initQuenchTests() line in mobAttack.js to have it automatically bring in the tests.

The tests perform a preflight suite to ensure your actors are setup correctly, but generally you'll need to manually set up the following:

* A scene named 'Scene' that is active, global lighting enabled, token vision disabled, and no background image. This is to ensure reloading the page for repeat testing is reasonably quick

* Import the starter hero "Randal" with the following changes (or import from /test_data in this repo)
  * Level him up to level 5 to get Extra Attack, and use the level 4 ASI to bump STR up to 18
  * Drag one copy of Randal onto the scene. Probably not necessary but MAT uses tokens as it's baseline reference
  * Add a lot of custom equipment to help test all the different attack bonus modifiers
    * 'Longsword' - Standard equipment
    * 'Longbow' - Standard equipment
    * 'Handaxe (CHA)' - Change attribute to CHA
    * 'Handaxe (No Prof)' - Change to "Not Proficient"
    * 'Handaxe (None)' - Change attribute to 'None'
    * 'Handaxe (Bonus ToHit)' - Add ToHit Bonus of 10
    * 'Handaxe (Flat)' - Enable Flat Bonus, Bonus ToHit of 11
    * 'Battleaxe +3' - SRD +3 battleaxe puts the bonus in the item description field
    * 'Handaxe, +1' - Use "Magic Weapon" spell to at a +1 using active effects
    * 'Handaxe, +5' - Modify "Magic Weapon" spell with the additional `activities[attack].attack.flat` override true and `activities[attack].attack.bonus` override `5`
    * 'Fire Bolt' - Default import
    * 'Fire Bolt (CON)' - Change casting attribute to CON
