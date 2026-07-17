import * as modlib from "modlib";

const WEAPON_LEVELS = 15;
const AVAILABLE_MELEE = (Object.keys(mod.Gadgets) as Array<keyof typeof mod.Gadgets>).filter(k => isNaN(Number(k)) && String(k).startsWith("Melee")).map(k => mod.Gadgets[k]) as mod.Gadgets[];
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
    const ATTACHMENT_PROBABILITY = 0.8;
    for (const category of Object.keys(WEAPON_ATTACHMENT_CATEGORIES)) {
        if ((Math.random() < ATTACHMENT_PROBABILITY)) {
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
const PROGRESS_BAR_PLAYER_ITEM_HIGHLIGHT_COLOR = [0.0, 0.65, 1.0]; // Battlefield friendly blue
const PROGRESS_BAR_ENEMY_ITEM_HIGHLIGHT_COLOR = [1.0, 0.45, 0.05]; // Battlefield enemy orange
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


type HighlightState = "self" | "other" | "none";

function GetHighlightBgFill(state: HighlightState): mod.UIBgFill {
    return state === "none" ? mod.UIBgFill.Blur : mod.UIBgFill.Solid;
}

function GetHighlightBgColor(state: HighlightState): number[] {
    if (state === "self") {
        return PROGRESS_BAR_PLAYER_ITEM_HIGHLIGHT_COLOR;
    }
    if (state === "other") {
        return PROGRESS_BAR_ENEMY_ITEM_HIGHLIGHT_COLOR;
    }
    return PROGRESS_BAR_ITEM_BASE_COLOR;
}

class WeaponProgressWidget {
    jsPlayer: JsPlayer;
    staticWidget: mod.UIWidget|undefined;
    weaponItemWidgets: Map<WeaponPackage, mod.UIWidget> = new Map();
    prevWeaponHighlights: Map<WeaponPackage, HighlightState> = new Map();
    meleeItemWidget: mod.UIWidget|undefined;
    prevMeleeHighlight: HighlightState|undefined = undefined;

    constructor(jsPlayer: JsPlayer) {
        this.jsPlayer = jsPlayer;
        this.CreateStaticWidget();
        this.UpdateWeaponItemWidgets();
    }

    CreateStaticWidget() {
        this.staticWidget = modlib.ParseUI({
            type: "Container",
            position: [0, PROGRESS_BAR_Y_OFFSET],
            size: [PROGRESS_BAR_WIDTH, WEAPON_ICON_ITEM_HEIGHT],
            anchor: mod.UIAnchor.TopCenter,
            playerId: this.jsPlayer.player,
            visible: true,
            bgFill: mod.UIBgFill.None,
        });
        for (let i = 0; i < AVAILABLE_WEAPON_PACKAGES.length; i++) {
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
        let weaponIndex = this.jsPlayer.getWeaponIndex();
        for (const [i, weaponPackage] of AVAILABLE_WEAPON_PACKAGES.entries()) {
            let isCurrentWeapon = i === weaponIndex;
            // Count map includes this player, so exclude self when checking for others
            let otherPlayerCount = (WEAPON_PACKAGE_TO_PLAYER_COUNT_MAP.get(weaponPackage) ?? 0) - (isCurrentWeapon ? 1 : 0);
            let highlight: HighlightState = isCurrentWeapon ? "self" : (otherPlayerCount > 0 ? "other" : "none");
            if (this.prevWeaponHighlights.get(weaponPackage) === highlight) {
                continue;
            }
            let widget = this.weaponItemWidgets.get(weaponPackage);
            if (widget) {
                mod.DeleteUIWidget(widget);
            }
            widget = modlib.ParseUI({
                type: "Container",
                position: [i * PROGRESS_BAR_ITEM_WIDTH, 0],
                size: [PROGRESS_BAR_ITEM_WIDTH, WEAPON_ICON_ITEM_HEIGHT],
                anchor: mod.UIAnchor.TopLeft,
                bgFill: GetHighlightBgFill(highlight),
                bgColor: GetHighlightBgColor(highlight),
                parent: this.staticWidget,
            });
            mod.AddUIWeaponImage(String(weaponPackage.weapon), mod.CreateVector(0, 0, 1), mod.CreateVector(PROGRESS_BAR_ITEM_WIDTH, WEAPON_ICON_ITEM_HEIGHT, 1), mod.UIAnchor.Center, weaponPackage.weapon, widget!, weaponPackage.package);
            this.weaponItemWidgets.set(weaponPackage, widget!);
            this.prevWeaponHighlights.set(weaponPackage, highlight);
        }
        let isMeleeLevel = weaponIndex >= AVAILABLE_WEAPON_PACKAGES.length;
        let otherMeleePlayerCount = MELEE_PLAYER_COUNT - (isMeleeLevel ? 1 : 0);
        let meleeHighlight: HighlightState = isMeleeLevel ? "self" : (otherMeleePlayerCount > 0 ? "other" : "none");
        if (this.prevMeleeHighlight === meleeHighlight) {
            return;
        }
        if (this.meleeItemWidget) {
            mod.DeleteUIWidget(this.meleeItemWidget);
        }
        this.meleeItemWidget = modlib.ParseUI({
            type: "Container",
            position: [AVAILABLE_WEAPON_PACKAGES.length * PROGRESS_BAR_ITEM_WIDTH, 0],
            size: [PROGRESS_BAR_ITEM_WIDTH, WEAPON_ICON_ITEM_HEIGHT],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: GetHighlightBgFill(meleeHighlight),
            bgColor: GetHighlightBgColor(meleeHighlight),
            parent: this.staticWidget,
        });
        mod.AddUIGadgetImage(String(MELEE), mod.CreateVector(0, 0, 1), mod.CreateVector(PROGRESS_BAR_ITEM_WIDTH, WEAPON_ICON_ITEM_HEIGHT, 1), mod.UIAnchor.Center, MELEE, this.meleeItemWidget!);
        this.prevMeleeHighlight = meleeHighlight;
    }

    Destroy() {
        if (this.staticWidget) {
            mod.DeleteUIWidget(this.staticWidget);
            this.staticWidget = undefined;
        }
        this.weaponItemWidgets.clear();
        this.prevWeaponHighlights.clear();
        this.meleeItemWidget = undefined;
        this.prevMeleeHighlight = undefined;
    }
}

class JsPlayer {
    player: mod.Player;
    playerId: number;
    kill_index = 0;

    progressWidget: WeaponProgressWidget|undefined;

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);

        this.progressWidget = new WeaponProgressWidget(this);
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

    static removeInvalidPlayers() {
        for (const id in this.#allJsPlayers) {
            const jsPlayer = this.#allJsPlayers[id];
            if (jsPlayer.player == null || !mod.IsPlayerValid(jsPlayer.player)) {
                jsPlayer.progressWidget?.Destroy();
                delete this.#allJsPlayers[id];
            }
        }
    }

    UpdateProgressUI() {
        this.progressWidget?.UpdateWeaponItemWidgets();
    }
}


export function OngoingGlobal() {
    if (GLOBAL_UI_REFRESH_NEEDED) {
        // Counts must be up to date before any widget refresh reads them
        UpdateWeaponToPlayerCountMap();
        for (const jsPlayer of JsPlayer.getAllAsArray()) {
            jsPlayer?.UpdateProgressUI();
        }
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
    // Leavers must not keep contributing to weapon player counts
    JsPlayer.removeInvalidPlayers();
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
        mod.RemoveEquipment(player, mod.InventorySlots.PrimaryWeapon);
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
    GLOBAL_UI_REFRESH_NEEDED = true;
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
    }
}


