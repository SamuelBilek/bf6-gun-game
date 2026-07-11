import * as modlib from "modlib";

const WEAPON_LEVELS = 15;
const AVAILABLE_MELEE = [
    mod.Gadgets.Melee_Combat_Knife, 
    mod.Gadgets.Melee_Hunting_Knife, 
    mod.Gadgets.Melee_Sledgehammer
];
const MELEE = AVAILABLE_MELEE[Math.floor(Math.random() * AVAILABLE_MELEE.length)];
const WEAPON_VALUES = (Object.keys(mod.Weapons) as Array<keyof typeof mod.Weapons>)
    .filter(k => isNaN(Number(k)) && !String(k).startsWith("BattlePickup"))
    .map(k => mod.Weapons[k]) as mod.Weapons[];
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


const PROGRESS_BAR_ITEM_WIDTH = 100;
const WEAPON_ICON_ITEM_HEIGHT = 35;
const WEAPON_COUNT_ITEM_HEIGHT = 20;

const SEPARATOR_WIDTH = 2;
const PROGRESS_BAR_WIDTH = PROGRESS_BAR_ITEM_WIDTH * (WEAPON_LEVELS + 1) + SEPARATOR_WIDTH * WEAPON_LEVELS; // +1 for melee
const PROGRESS_BAR_Y_OFFSET = 30;

const PROGRESS_BAR_ITEM_BASE_COLOR = [0, 0, 0];
const PROGRESS_BAR_ITEM_HIGHLIGHT_COLOR = [0.5, 0.5, 0.5];
const SEPARATOR_COLOR = [1, 1, 1];

var WEAPON_TO_PLAYER_COUNT_MAP = new Map<mod.Weapons, number>();
var MELEE_PLAYER_COUNT = 0;

function UpdateWeaponToPlayerCountMap() {
    // Wish I could just call AllPlayers and simply iterate over it :(
    let allPlayers = JsPlayer.getAllAsArray();
    MELEE_PLAYER_COUNT = 0;
    for (const weapon of AVAILABLE_WEAPONS) {
        WEAPON_TO_PLAYER_COUNT_MAP.set(weapon, 0);
    }
    for (const jsPlayer of allPlayers) {
        let weaponIndex = jsPlayer.getWeaponIndex();
        if (weaponIndex >= AVAILABLE_WEAPONS.length) {
            MELEE_PLAYER_COUNT += 1;
            continue;
        }
        let weapon = AVAILABLE_WEAPONS[weaponIndex];
        let currentCount = WEAPON_TO_PLAYER_COUNT_MAP.get(weapon) ?? 0;
        WEAPON_TO_PLAYER_COUNT_MAP.set(weapon, currentCount + 1);
    }
}

var GLOBAL_UI_REFRESH_NEEDED = false;

class WeaponPlayerCountWidget {
    staticWidget: mod.UIWidget|undefined;
    playerCountWidgets: Map<mod.Weapons, mod.UIWidget> = new Map();
    prevPlayerCountMap: Map<mod.Weapons, number> = new Map();
    meleeCountWidget: mod.UIWidget|undefined;
    prevMeleeCount: number = -1;

    constructor() {
        this.CreateStaticWidget();
        this.UpdatePlayerCountWidgets();
    }

    CreateStaticWidget() {
        this.staticWidget = modlib.ParseUI({
            type: "Container",
            position: [0, PROGRESS_BAR_Y_OFFSET + WEAPON_ICON_ITEM_HEIGHT],
            size: [PROGRESS_BAR_WIDTH, WEAPON_COUNT_ITEM_HEIGHT],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.None,
        });
        for (let i = 0; i < AVAILABLE_WEAPONS.length; i++) {
            modlib.ParseUI({
                type: "Container",
                position: [i * PROGRESS_BAR_ITEM_WIDTH, 0],
                size: [PROGRESS_BAR_ITEM_WIDTH, WEAPON_COUNT_ITEM_HEIGHT],
                anchor: mod.UIAnchor.TopLeft,
                parent: this.staticWidget,
                bgColor: PROGRESS_BAR_ITEM_BASE_COLOR,
                bgFill: mod.UIBgFill.Blur,
            });
            modlib.ParseUI({
                type: "Container",
                position: [(i + 1) * PROGRESS_BAR_ITEM_WIDTH, 0],
                size: [SEPARATOR_WIDTH, WEAPON_COUNT_ITEM_HEIGHT],
                anchor: mod.UIAnchor.TopLeft,
                bgFill: mod.UIBgFill.Solid,
                bgColor: SEPARATOR_COLOR,
                parent: this.staticWidget,
            });
        }
        modlib.ParseUI({
            type: "Container",
            position: [AVAILABLE_WEAPONS.length * PROGRESS_BAR_ITEM_WIDTH, 0],
            size: [PROGRESS_BAR_ITEM_WIDTH, WEAPON_COUNT_ITEM_HEIGHT],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.staticWidget,
            bgColor: PROGRESS_BAR_ITEM_BASE_COLOR,
            bgFill: mod.UIBgFill.Blur,
        });
    }

    UpdatePlayerCountWidgets() {
        for (const [i, weapon] of AVAILABLE_WEAPONS.entries()) {
            let widget = this.playerCountWidgets.get(weapon);
            let currentCount = WEAPON_TO_PLAYER_COUNT_MAP.get(weapon) ?? 0;
            let prevCount = this.prevPlayerCountMap.get(weapon) ?? -1;
            let refreshNeeded = currentCount !== prevCount;
            if (widget && refreshNeeded) {
                mod.DeleteUIWidget(widget);
            }
            if (refreshNeeded) {
                widget = modlib.ParseUI({
                    type: "Text",
                    position: [i * PROGRESS_BAR_ITEM_WIDTH, 0],
                    size: [PROGRESS_BAR_ITEM_WIDTH, WEAPON_COUNT_ITEM_HEIGHT],
                    anchor: mod.UIAnchor.TopLeft,
                    textAnchor: mod.UIAnchor.Center,
                    textLabel: String(currentCount),
                    parent: this.staticWidget,
                });
                this.playerCountWidgets.set(weapon, widget!);
                this.prevPlayerCountMap.set(weapon, currentCount);
            }
        }
        let refreshNeeded = MELEE_PLAYER_COUNT !== this.prevMeleeCount;
        if (this.meleeCountWidget && refreshNeeded) {
            mod.DeleteUIWidget(this.meleeCountWidget);
        }
        if (refreshNeeded) {
            this.meleeCountWidget = modlib.ParseUI({
                type: "Text",
                position: [AVAILABLE_WEAPONS.length * PROGRESS_BAR_ITEM_WIDTH, 0],
                size: [PROGRESS_BAR_ITEM_WIDTH, WEAPON_COUNT_ITEM_HEIGHT],
                anchor: mod.UIAnchor.TopLeft,
                textAnchor: mod.UIAnchor.Center,
                textLabel: String(MELEE_PLAYER_COUNT),
                parent: this.staticWidget,
            });
            this.prevMeleeCount = MELEE_PLAYER_COUNT;
        }
    }
}

var WEAPON_PLAYER_COUNT_WIDGET: WeaponPlayerCountWidget|undefined = undefined;


class WeaponProgressWidget {
    player: mod.Player;
    staticWidget: mod.UIWidget|undefined;
    weaponItemWidgets: Map<mod.Weapons, mod.UIWidget> = new Map();
    meleeItemWidget: mod.UIWidget|undefined;
    prevActiveWeapon: mod.Weapons|undefined = undefined;
    prevMeleeActive: boolean = false;

    constructor(player: mod.Player) {
        this.player = player;
        this.CreateStaticWidget();
        this.UpdateWeaponItemWidgets();
    }

    CreateStaticWidget() {
        this.staticWidget = modlib.ParseUI({
            type: "Container",
            position: [0, PROGRESS_BAR_Y_OFFSET],
            size: [PROGRESS_BAR_WIDTH, WEAPON_ICON_ITEM_HEIGHT],
            anchor: mod.UIAnchor.TopCenter,
            playerId: this.player,
            visible: true,
            bgFill: mod.UIBgFill.None,
        });
        for (const [i, weapon] of AVAILABLE_WEAPONS.entries()) {
            modlib.ParseUI({
                type: "Container",
                position: [(i + 1) * PROGRESS_BAR_ITEM_WIDTH, 0],
                size: [SEPARATOR_WIDTH, WEAPON_ICON_ITEM_HEIGHT],
                anchor: mod.UIAnchor.TopLeft,
                bgFill: mod.UIBgFill.Solid,
                bgColor: SEPARATOR_COLOR,
                parent: this.staticWidget,
            });
        }
    }
    UpdateWeaponItemWidgets() {
        let hasFirearm = false;
        for (const [i, weapon] of AVAILABLE_WEAPONS.entries()) {
            let hasEquipment = mod.HasEquipment(this.player, weapon);
            hasFirearm = hasFirearm || hasEquipment;
            let refreshNeeded = (hasEquipment && (this.prevActiveWeapon !== weapon) || (!hasEquipment && this.prevActiveWeapon === weapon));
            let widget = this.weaponItemWidgets.get(weapon);
            if (widget && refreshNeeded) {
                mod.DeleteUIWidget(widget);
                widget = undefined;
            }
            if (!widget) {
                widget = modlib.ParseUI({
                    type: "Container",
                    position: [i * PROGRESS_BAR_ITEM_WIDTH, 0],
                    size: [PROGRESS_BAR_ITEM_WIDTH, WEAPON_ICON_ITEM_HEIGHT],
                    anchor: mod.UIAnchor.TopLeft,
                    bgFill: hasEquipment ? mod.UIBgFill.Solid : mod.UIBgFill.Blur,
                    bgColor: hasEquipment ? PROGRESS_BAR_ITEM_HIGHLIGHT_COLOR : PROGRESS_BAR_ITEM_BASE_COLOR,
                    parent: this.staticWidget,
                });
                mod.AddUIWeaponImage(String(weapon), mod.CreateVector(0, 0, 1), mod.CreateVector(PROGRESS_BAR_ITEM_WIDTH, WEAPON_ICON_ITEM_HEIGHT, 1), mod.UIAnchor.Center, weapon, widget!);
                this.weaponItemWidgets.set(weapon, widget!);
                this.prevActiveWeapon = weapon;
            }
        }
        let refreshNeeded = this.prevMeleeActive === hasFirearm;
        if (this.meleeItemWidget && refreshNeeded) {
            mod.DeleteUIWidget(this.meleeItemWidget);
            this.meleeItemWidget = undefined;
        }
        if (!this.meleeItemWidget) {
            this.meleeItemWidget = modlib.ParseUI({
                type: "Container",
                position: [AVAILABLE_WEAPONS.length * PROGRESS_BAR_ITEM_WIDTH, 0],
                size: [PROGRESS_BAR_ITEM_WIDTH, WEAPON_ICON_ITEM_HEIGHT],
                anchor: mod.UIAnchor.TopLeft,
                bgFill: !hasFirearm ? mod.UIBgFill.Solid : mod.UIBgFill.Blur,
                bgColor: !hasFirearm ? PROGRESS_BAR_ITEM_HIGHLIGHT_COLOR : PROGRESS_BAR_ITEM_BASE_COLOR,
                parent: this.staticWidget,
            });
            mod.AddUIGadgetImage(String(MELEE), mod.CreateVector(0, 0, 1), mod.CreateVector(PROGRESS_BAR_ITEM_WIDTH, WEAPON_ICON_ITEM_HEIGHT, 1), mod.UIAnchor.Center, MELEE, this.meleeItemWidget!);
            this.prevMeleeActive = !hasFirearm;
        }
    }
}

class JsPlayer {
    player: mod.Player;
    playerId: number;
    kill_index = 0;

    progressWidget: WeaponProgressWidget|undefined;

    static playerInstances: mod.Player[] = [];

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        JsPlayer.playerInstances.push(this.player);

        this.progressWidget = new WeaponProgressWidget(this.player);
        this.UpdateProgressUI();
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

    getWeaponIndex() {
        return Math.floor(this.kill_index / 2);
    }

    static getAllAsArray() {
        return Object.values(this.#allJsPlayers);
    }

    UpdateProgressUI() {
        this.progressWidget?.UpdateWeaponItemWidgets();
    }
}


export function OngoingGlobal() {
    if (GLOBAL_UI_REFRESH_NEEDED) {
        UpdateWeaponToPlayerCountMap();
        WEAPON_PLAYER_COUNT_WIDGET?.UpdatePlayerCountWidgets();
    }
    GLOBAL_UI_REFRESH_NEEDED = false;
}


export async function OnGameModeStarted() {
    mod.SetSpawnMode(mod.SpawnModes.AutoSpawn);
    CreateAvailableWeapons();
    GLOBAL_UI_REFRESH_NEEDED = true;
    // For some reason with the later version of the SDK, displaying using the modlib.ParseUI() fails to display the player count
    // Instead it shows <unknown_string>
    // TODO: Uncomment this when the display bug is fixed
    //WEAPON_PLAYER_COUNT_WIDGET = new WeaponPlayerCountWidget();
}


export function OnPlayerJoinGame(eventPlayer: mod.Player) {
    GLOBAL_UI_REFRESH_NEEDED = true;
}


export function OnPlayerLeaveGame(eventNumber: number) {
    GLOBAL_UI_REFRESH_NEEDED = true;
}


function ResetPlayer(player: mod.Player) {
    let jsPlayer = JsPlayer.get(player);
    if (!jsPlayer) {
        return;
    }
    for (let slot of INVENTORY_SLOTS) {
        if (!(slot === mod.InventorySlots.MeleeWeapon || slot === mod.InventorySlots.PrimaryWeapon)) {
            mod.RemoveEquipment(player, slot);
        }
    }
    mod.AddEquipment(player, MELEE, mod.InventorySlots.MeleeWeapon);
}


function UpdatePlayerWeapons(player: mod.Player) {
    let jsPlayer = JsPlayer.get(player);
    if (!jsPlayer) {
        return;
    }
    ResetPlayer(player);
    let weaponIndex = jsPlayer.getWeaponIndex();
    // Melee level after all weapons completed
    if (weaponIndex >= AVAILABLE_WEAPONS.length) {
        return;
    }
    let weapon = AVAILABLE_WEAPONS[weaponIndex];
    mod.AddEquipment(player, weapon, mod.InventorySlots.PrimaryWeapon);
}


export function OnPlayerDeployed(eventPlayer: mod.Player): void {
    UpdatePlayerWeapons(eventPlayer);
    GLOBAL_UI_REFRESH_NEEDED = true;
    let jsPlayer = JsPlayer.get(eventPlayer);
    if (jsPlayer) {
        jsPlayer.UpdateProgressUI();
    }
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
    let weaponIndexPrev = jsPlayer.getWeaponIndex();
    if (mod.EventDeathTypeCompare(eventDeathType, mod.PlayerDeathTypes.Melee)) {
        let jsOtherPlayer = JsPlayer.get(eventOtherPlayer);
        if (jsOtherPlayer) {
            jsOtherPlayer.kill_index = Math.max(jsOtherPlayer.kill_index - 1, 0);
        }
        // Knife kill after all weapons completed
        if (weaponIndexPrev >= AVAILABLE_WEAPONS.length) {
            mod.EndGameMode(eventPlayer);
            return;
        }
        // Extra point for melee kill, but only if not game-ending
        jsPlayer.kill_index += 1;
    }
    jsPlayer.kill_index += 1;
    let weaponIndexNew = jsPlayer.getWeaponIndex();
    if (weaponIndexNew > weaponIndexPrev) {
        UpdatePlayerWeapons(eventPlayer);
        jsPlayer.UpdateProgressUI();
    }
    GLOBAL_UI_REFRESH_NEEDED = true;
}


