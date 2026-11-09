import { moduleName } from '../constants.js'

/**
 * End a grouped mob turn in combat
 * @param {object} data - Mob attack data containing selectedTokenIds
 */
export async function endGroupedMobTurn(data) {
  if (game.combat != null) {
    const mobList = game.settings.get(moduleName, 'hiddenMobList')
    const combatants = game.combat.turns
    let mobCreatures = {}
    let otherCreatures = []
    for (let combatant of combatants) {
      let savedMob
      for (let mobName of Object.keys(mobList)) {
        if (mobList[mobName].selectedTokenIds.includes(combatant.tokenId)) {
          savedMob = mobList[mobName]
          break
        }
      }
      if (savedMob) {
        if (Object.keys(mobList).includes(savedMob.mobName)) {
          if (!mobCreatures[savedMob.mobName]?.length) {
            mobCreatures[savedMob.mobName] = [combatant._id]
          }
          else {
            mobCreatures[savedMob.mobName].push(combatant._id)
          }
        }
      }
      else {
        otherCreatures.push(combatant)
      }
    }

    let skipComplete = false
    for (let mobName of Object.keys(mobList)) {
      if (mobCreatures[mobName]?.includes(game.combat.combatant._id) && canvas.tokens.controlled.filter(t => t.id)?.includes(game.combat.combatant._id)) {
        let turnIndex = game.combat.turns.indexOf(game.combat.combatant)
        let lastMobTurn = turnIndex
        let currentRound = game.combat.round
        for (let i = turnIndex + 1; i < game.combat.turns.length; i++) {
          if (mobCreatures[mobName].includes(game.combat.turns[i]._id)) {
            lastMobTurn++
          }
          else {
            break
          }
        }
        if (lastMobTurn === game.combat.turns.length - 1) {
          await game.combat.nextRound()
          skipComplete = true
        }
        else if (Object.keys(mobList).length > 0) {
          await game.combat.update({ round: currentRound, turn: lastMobTurn + 1 })
          skipComplete = true
        }
        break
      }
    }
    if (!skipComplete) {
      // skip turn of selected tokens (not a saved mob per se),
      // but only if they include the current combatant.
      if (canvas.tokens.controlled.filter(t => t.id === game.combat.combatant.tokenId).length > 0) {
        let turnIndex = game.combat.turns.indexOf(game.combat.combatant)
        let lastMobTurn = turnIndex
        let currentRound = game.combat.round
        for (let i = turnIndex + 1; i < game.combat.turns.length; i++) {
          if (data.selectedTokenIds.filter(t => t.tokenId === game.combat.turns[i].tokenId).length > 0) {
            lastMobTurn++
          }
          else {
            break
          }
        }
        if (lastMobTurn === game.combat.turns.length - 1) {
          await game.combat.nextRound()
        }
        else {
          await game.combat.update({ round: currentRound, turn: lastMobTurn + 1 })
        }
      }
    }
  }
}
