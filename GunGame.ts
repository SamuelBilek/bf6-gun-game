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

const WEAPON_ATTACHMENT_CATEGORIES: { [category: string]: mod.WeaponAttachments[] } = {
    Ammo: [],
    Barrel: [],
    Bottom: [],
    Ergonomic: [],
    Left: [],
    Magazine: [],
    Muzzle: [],
    Right: [],
    Scope: [],
    Top: [],
};

for (const key of Object.keys(mod.WeaponAttachments) as Array<keyof typeof mod.WeaponAttachments>) {
    const name = String(key);
    for (const category in WEAPON_ATTACHMENT_CATEGORIES) {
        if (name.startsWith(category)) {
            WEAPON_ATTACHMENT_CATEGORIES[category].push(mod.WeaponAttachments[key]);
            break;
        }
    }
}

function GetRandomAttachmentForCategory(category: string): mod.WeaponAttachments | undefined {
    const pool = WEAPON_ATTACHMENT_CATEGORIES[category];
    if (!pool || pool.length === 0) {
        return undefined;
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

function CreateRandomWeaponPackage(): mod.WeaponPackage {
    const weaponPackage = mod.CreateNewWeaponPackage();
    for (const category of Object.keys(WEAPON_ATTACHMENT_CATEGORIES)) {
        if (!(Math.random() < 0.5)) {
            continue;
        }
        const attachment = GetRandomAttachmentForCategory(category);
        if (!attachment) {
            continue;
        }
        mod.AddAttachmentToWeaponPackage(attachment, weaponPackage);
    }
    return weaponPackage;
}

type WeaponPackage = {
    weapon: mod.Weapons;
    package: mod.WeaponPackage;
};

var AVAILABLE_WEAPON_PACKAGES: WeaponPackage[] = [];

function CreateAvailableWeapons(): void {
  const arr = WEAPON_VALUES.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  AVAILABLE_WEAPON_PACKAGES = arr.slice(0, WEAPON_LEVELS).map(weapon => ({ weapon, package: CreateRandomWeaponPackage() }));
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

var WEAPON_PACKAGE_TO_PLAYER_COUNT_MAP = new Map<WeaponPackage, number>();
var MELEE_PLAYER_COUNT = 0;

function UpdateWeaponToPlayerCountMap() {
    // Wish I could just call AllPlayers and simply iterate over it :(
    let allPlayers = JsPlayer.getAllAsArray();
    MELEE_PLAYER_COUNT = 0;
    for (const weaponPackage of AVAILABLE_WEAPON_PACKAGES) {
        WEAPON_PACKAGE_TO_PLAYER_COUNT_MAP.set(weaponPackage, 0);
    }
    for (const jsPlayer of allPlayers) {
        let weaponIndex = jsPlayer.getWeaponIndex();
        if (weaponIndex >= AVAILABLE_WEAPON_PACKAGES.length) {
            MELEE_PLAYER_COUNT += 1;
            continue;
        }
        let weaponPackage = AVAILABLE_WEAPON_PACKAGES[weaponIndex];
        let currentCount = WEAPON_PACKAGE_TO_PLAYER_COUNT_MAP.get(weaponPackage) ?? 0;
        WEAPON_PACKAGE_TO_PLAYER_COUNT_MAP.set(weaponPackage, currentCount + 1);
    }
}

var GLOBAL_UI_REFRESH_NEEDED = false;

class WeaponPlayerCountWidget {
    staticWidget: mod.UIWidget|undefined;
    playerCountWidgets: Map<WeaponPackage, mod.UIWidget> = new Map();
    prevPlayerCountMap: Map<WeaponPackage, number> = new Map();
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
        for (let i = 0; i < AVAILABLE_WEAPON_PACKAGES.length; i++) {
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
            position: [AVAILABLE_WEAPON_PACKAGES.length * PROGRESS_BAR_ITEM_WIDTH, 0],
            size: [PROGRESS_BAR_ITEM_WIDTH, WEAPON_COUNT_ITEM_HEIGHT],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.staticWidget,
            bgColor: PROGRESS_BAR_ITEM_BASE_COLOR,
            bgFill: mod.UIBgFill.Blur,
        });
    }

    UpdatePlayerCountWidgets() {
        for (const [i, weaponPackage] of AVAILABLE_WEAPON_PACKAGES.entries()) {
            let widget = this.playerCountWidgets.get(weaponPackage);
            let currentCount = WEAPON_PACKAGE_TO_PLAYER_COUNT_MAP.get(weaponPackage) ?? 0;
            let prevCount = this.prevPlayerCountMap.get(weaponPackage) ?? -1;
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
                this.playerCountWidgets.set(weaponPackage, widget!);
                this.prevPlayerCountMap.set(weaponPackage, currentCount);
            }
        }
        let refreshNeeded = MELEE_PLAYER_COUNT !== this.prevMeleeCount;
        if (this.meleeCountWidget && refreshNeeded) {
            mod.DeleteUIWidget(this.meleeCountWidget);
        }
        if (refreshNeeded) {
            this.meleeCountWidget = modlib.ParseUI({
                type: "Text",
                position: [AVAILABLE_WEAPON_PACKAGES.length * PROGRESS_BAR_ITEM_WIDTH, 0],
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
    weaponItemWidgets: Map<WeaponPackage, mod.UIWidget> = new Map();
    meleeItemWidget: mod.UIWidget|undefined;
    prevActiveWeapon: WeaponPackage|undefined = undefined;
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
        for (const [i, weaponPackage] of AVAILABLE_WEAPON_PACKAGES.entries()) {
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
        for (const [i, weaponPackage] of AVAILABLE_WEAPON_PACKAGES.entries()) {
            let hasEquipment = mod.HasEquipment(this.player, weaponPackage.weapon);
            hasFirearm = hasFirearm || hasEquipment;
            let refreshNeeded = (hasEquipment && (this.prevActiveWeapon !== weaponPackage) || (!hasEquipment && this.prevActiveWeapon === weaponPackage));
            let widget = this.weaponItemWidgets.get(weaponPackage);
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
                mod.AddUIWeaponImage(String(weaponPackage.weapon), mod.CreateVector(0, 0, 1), mod.CreateVector(PROGRESS_BAR_ITEM_WIDTH, WEAPON_ICON_ITEM_HEIGHT, 1), mod.UIAnchor.Center, weaponPackage.weapon, widget!, weaponPackage.package);
                this.weaponItemWidgets.set(weaponPackage, widget!);
                this.prevActiveWeapon = weaponPackage;
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
                position: [AVAILABLE_WEAPON_PACKAGES.length * PROGRESS_BAR_ITEM_WIDTH, 0],
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
    if (weaponIndex >= AVAILABLE_WEAPON_PACKAGES.length) {
        return;
    }
    let weaponPackage = AVAILABLE_WEAPON_PACKAGES[weaponIndex];
    mod.AddEquipment(player, weaponPackage.weapon, weaponPackage.package, mod.InventorySlots.PrimaryWeapon);
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
        if (weaponIndexPrev >= AVAILABLE_WEAPON_PACKAGES.length) {
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


