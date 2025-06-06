/**
 * @param {String} checkVersion string representing the reference version we're checking against. Expect '1.2.3' format for consistency
 * @param {String} actualVersion default to actual system version. Added as a default to allow injection for testing, normally not used
 * @returns true if check version is equal or newer than the actual system version
 */
export function systemEqualOrNewerThan(checkVersion, actualVersion = game.system.version) {
  if (checkVersion === actualVersion) return true

  return foundry.utils.isNewerVersion(actualVersion, checkVersion)
}

/**
 * @param {String} checkVersion string representing the reference version we're checking against. Expect '1.2' format for consistency
 * @param {String} actualVersion default to actual system version. Added as a default to allow injection for testing, normally not used
 * @returns true if check version is equal or newer than the actual system version
 */
export function foundryEqualOrNewerThan(checkVersion, actualVersion = game.version) {
  if (checkVersion === actualVersion) return true

  return foundry.utils.isNewerVersion(actualVersion, checkVersion)
}
