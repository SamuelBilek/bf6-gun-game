const WEAPON_LEVELS = 15;
const AVAILABLE_MELEE = [
    mod.Gadgets.Melee_Combat_Knife, mod.Gadgets.Melee_Hunting_Knife, mod.Gadgets.Melee_Sledgehammer
];
const MELEE = AVAILABLE_MELEE[Math.floor(Math.random() * AVAILABLE_MELEE.length)];
const WEAPON_VALUES = (Object.keys(mod.Weapons) as Array<keyof typeof mod.Weapons>).filter(k => isNaN(Number(k))).map(k => mod.Weapons[k]) as mod.Weapons[];
const INVENTORY_SLOTS = (Object.keys(mod.InventorySlots) as Array<keyof typeof mod.InventorySlots>).filter(k => isNaN(Number(k))).map(k => mod.InventorySlots[k]) as mod.InventorySlots[];

var AVAILABLE_WEAPONS: mod.Weapons[] = [];

function CreateAvailableWeapons(): void {
  const arr = WEAPON_VALUES.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  AVAILABLE_WEAPONS = arr.slice(0, WEAPON_LEVELS);
}


class JsPlayer {
    player: mod.Player;
    playerId: number;
    kill_index = 0;

    static playerInstances: mod.Player[] = [];

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        JsPlayer.playerInstances.push(this.player);
    }

    // declare dictionary with int keys
    static #allJsPlayers: { [key: number] : JsPlayer }  = {};

    static get(player: mod.Player) {
        if (mod.GetObjId(player) > -1) {
            let index = mod.GetObjId(player);

            let jsPlayer = this.#allJsPlayers[index];
            if (!jsPlayer) {
                jsPlayer = new JsPlayer(player);
                this.#allJsPlayers[index] = jsPlayer;
            }

            return jsPlayer;
        }
        return undefined;
    }
}


export async function OnGameModeStarted() {
    CreateAvailableWeapons();
}


function ResetPlayer(player: mod.Player) {
    let jsPlayer = JsPlayer.get(player);
    if (!jsPlayer) {
        return;
    }
    for (let slot of INVENTORY_SLOTS) {
        mod.RemoveEquipment(player, slot);
    }
    mod.AddEquipment(player, MELEE);
}


function UpdatePlayerWeapons(player: mod.Player) {
    let jsPlayer = JsPlayer.get(player);
    if (!jsPlayer) {
        return;
    }

    let weaponIndex = Math.floor(jsPlayer.kill_index / 2);
    // Melee kill after all weapons completed
    if (weaponIndex >= AVAILABLE_WEAPONS.length) {
        ResetPlayer(player);
        return;
    }
    let weapon = AVAILABLE_WEAPONS[weaponIndex];
    if (!mod.HasEquipment(player, weapon)) {
        ResetPlayer(player);
        mod.AddEquipment(player, weapon);
    }
}


export function OnPlayerDeployed(eventPlayer: mod.Player): void {
    ResetPlayer(eventPlayer);
    UpdatePlayerWeapons(eventPlayer);
}


export function OnPlayerEarnedKill(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player,
    eventDeathType: mod.DeathType,
    eventWeaponUnlock: mod.WeaponUnlock
): void {
    let jsPlayer = JsPlayer.get(eventPlayer);
    if (!jsPlayer) {
        return;
    }
    let weaponIndex = Math.floor(jsPlayer.kill_index / 2);
    if (mod.EventDeathTypeCompare(eventDeathType, mod.PlayerDeathTypes.Melee)) {
        let jsOtherPlayer = JsPlayer.get(eventOtherPlayer);
        if (jsOtherPlayer) {
            jsOtherPlayer.kill_index = Math.max(jsOtherPlayer.kill_index - 1, 0);
        }
        // Knife kill after all weapons completed
        if (weaponIndex >= AVAILABLE_WEAPONS.length) {
            mod.EndGameMode(eventPlayer);
            return;
        }
    }
    jsPlayer.kill_index += 1;
    // Modulo 2
    if ((jsPlayer.kill_index & 1) == 0) {
        UpdatePlayerWeapons(eventPlayer);
    }
}