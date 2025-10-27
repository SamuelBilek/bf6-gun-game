const WEAPON_LEVELS = 15;
const AVAILABLE_MELEE = [
    mod.Gadgets.Melee_Combat_Knife, 
    mod.Gadgets.Melee_Hunting_Knife, 
    mod.Gadgets.Melee_Sledgehammer
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


const PROGRESS_BAR_ITEM_WIDTH = 100;
const WEAPON_ICON_ITEM_HEIGHT = 35;
const WEAPON_COUNT_ITEM_HEIGHT = 20;
const PROGRESS_BAR_ITEM_HEIGHT = WEAPON_ICON_ITEM_HEIGHT + WEAPON_COUNT_ITEM_HEIGHT;

const SEPARATOR_WIDTH = 2;
const SEPARATOR_HEIGHT = PROGRESS_BAR_ITEM_HEIGHT;
const PROGRESS_BAR_WIDTH = PROGRESS_BAR_ITEM_WIDTH * (WEAPON_LEVELS + 1) + SEPARATOR_WIDTH * WEAPON_LEVELS; // +1 for melee
const PROGRESS_BAR_HEIGHT = PROGRESS_BAR_ITEM_HEIGHT;
const PROGRESS_BAR_Y_OFFSET = 30;

const PROGRESS_BAR_ITEM_BASE_COLOR = [0, 0, 0];
const PROGRESS_BAR_ITEM_HIGHLIGHT_COLOR = [0.5, 0.5, 0.5];
const SEPARATOR_COLOR = [1, 1, 1];

var WEAPON_TO_PLAYER_COUNT_MAP = new Map<mod.Weapons, number>();

function UpdateWeaponToPlayerCountMap() {
    // Wish I could just call AllPlayers and simply iterate over it :(
    let allPlayers = JsPlayer.getAllAsArray();
    for (const weapon of AVAILABLE_WEAPONS) {
        let count = 0;
        for (const jsPlayer of allPlayers) {
            if (jsPlayer.currentWeapon === weapon) {
                count += 1;
            }
        }
        WEAPON_TO_PLAYER_COUNT_MAP.set(weapon, count);
    }
}


class JsPlayer {
    player: mod.Player;
    playerId: number;
    kill_index = 0;
    currentWeapon: mod.Weapons|undefined;

    progressWidget: mod.UIWidget|undefined;

    static playerInstances: mod.Player[] = [];

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        JsPlayer.playerInstances.push(this.player);

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

    static getAllAsArray() {
        return Object.values(this.#allJsPlayers);
    }

    UpdateProgressUI() {
        if (this.progressWidget) {
            mod.DeleteUIWidget(this.progressWidget);
        }
        this.progressWidget = ParseUI({
            type: "Container",
            position: [0, PROGRESS_BAR_Y_OFFSET],
            size: [PROGRESS_BAR_WIDTH, PROGRESS_BAR_HEIGHT],
            anchor: mod.UIAnchor.TopCenter,
            playerId: this.player,
            visible: true,
            bgFill: mod.UIBgFill.None,
        });
        let hasFirearm = false;
        for (const [i, weapon] of AVAILABLE_WEAPONS.entries()) {
            let hasEquipment = mod.HasEquipment(this.player, weapon);
            hasFirearm = hasFirearm || hasEquipment;
            let weaponItemWidget = ParseUI({
                type: "Container",
                position: [i * PROGRESS_BAR_ITEM_WIDTH, 0],
                size: [PROGRESS_BAR_ITEM_WIDTH, PROGRESS_BAR_ITEM_HEIGHT],
                anchor: mod.UIAnchor.TopLeft,
                bgFill: mod.UIBgFill.Blur,
                bgColor: PROGRESS_BAR_ITEM_BASE_COLOR,
                parent: this.progressWidget,
            });
            let weaponIconWidget = ParseUI({
                type: "Container",
                size: [PROGRESS_BAR_ITEM_WIDTH, WEAPON_ICON_ITEM_HEIGHT],
                anchor: mod.UIAnchor.TopLeft,
                bgFill: hasEquipment ? mod.UIBgFill.Solid : mod.UIBgFill.Blur,
                bgColor: hasEquipment ? PROGRESS_BAR_ITEM_HIGHLIGHT_COLOR : PROGRESS_BAR_ITEM_BASE_COLOR,
                parent: weaponItemWidget,
            });    
            mod.AddUIWeaponImage(String(weapon), mod.CreateVector(0, 0, 1), mod.CreateVector(PROGRESS_BAR_ITEM_WIDTH, PROGRESS_BAR_ITEM_HEIGHT, 1), mod.UIAnchor.Center, weapon, weaponIconWidget!);
            
            ParseUI({
                type: "Text",
                position: [0, WEAPON_ICON_ITEM_HEIGHT],
                size: [PROGRESS_BAR_ITEM_WIDTH, WEAPON_COUNT_ITEM_HEIGHT],
                anchor: mod.UIAnchor.TopLeft,
                textAnchor: mod.UIAnchor.Center,
                textLabel: MakeMessage("${}", WEAPON_TO_PLAYER_COUNT_MAP.get(weapon) ?? 0),
                parent: weaponItemWidget,
            });

            ParseUI({
                type: "Container",
                position: [(i + 1) * PROGRESS_BAR_ITEM_WIDTH, 0],
                size: [SEPARATOR_WIDTH, SEPARATOR_HEIGHT],
                anchor: mod.UIAnchor.TopLeft,
                bgFill: mod.UIBgFill.Solid,
                bgColor: SEPARATOR_COLOR,
                parent: this.progressWidget,
            });
        }
        let meleeWidget = ParseUI({
            type: "Container",
            position: [AVAILABLE_WEAPONS.length * PROGRESS_BAR_ITEM_WIDTH, 0],
            size: [PROGRESS_BAR_ITEM_WIDTH, PROGRESS_BAR_ITEM_HEIGHT],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: !hasFirearm ? mod.UIBgFill.Solid : mod.UIBgFill.Blur,
            bgColor: !hasFirearm ? PROGRESS_BAR_ITEM_HIGHLIGHT_COLOR : PROGRESS_BAR_ITEM_BASE_COLOR,
            parent: this.progressWidget,
        });
        mod.AddUIGadgetImage(String(MELEE), mod.CreateVector(0, 0, 1), mod.CreateVector(PROGRESS_BAR_ITEM_WIDTH, PROGRESS_BAR_ITEM_HEIGHT, 1), mod.UIAnchor.Center, MELEE, meleeWidget!);
    }
}


export async function OnGameModeStarted() {
    mod.SetSpawnMode(mod.SpawnModes.AutoSpawn);
    CreateAvailableWeapons();
    UpdateWeaponToPlayerCountMap();
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
        jsPlayer.currentWeapon = weapon;
    }
}


export function OnPlayerDeployed(eventPlayer: mod.Player): void {
    ResetPlayer(eventPlayer);
    UpdatePlayerWeapons(eventPlayer);
    UpdateWeaponToPlayerCountMap();
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
    UpdateWeaponToPlayerCountMap();
    jsPlayer.UpdateProgressUI();
}


//-----------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------//
// Helper functions to create UI from a JSON object tree:
//-----------------------------------------------------------------------------------------------//

type UIVector = mod.Vector | number[];

interface UIParams {
    name: string;
    type: string;
    position: any;
    size: any;
    anchor: mod.UIAnchor;
    parent: mod.UIWidget;
    visible: boolean;
    textLabel: string;
    textColor: UIVector;
    textAlpha: number;
    textSize: number;
    textAnchor: mod.UIAnchor;
    padding: number;
    bgColor: UIVector;
    bgAlpha: number;
    bgFill: mod.UIBgFill;
    imageType: mod.UIImageType;
    imageColor: UIVector;
    imageAlpha: number;
    teamId?: mod.Team;
    playerId?: mod.Player;
    children?: any[];
    buttonEnabled: boolean;
    buttonColorBase: UIVector;
    buttonAlphaBase: number;
    buttonColorDisabled: UIVector;
    buttonAlphaDisabled: number;
    buttonColorPressed: UIVector;
    buttonAlphaPressed: number;
    buttonColorHover: UIVector;
    buttonAlphaHover: number;
    buttonColorFocused: UIVector;
    buttonAlphaFocused: number;
}

function __asModVector(param: number[]|mod.Vector) {
    if (Array.isArray(param))
        return mod.CreateVector(param[0], param[1], param.length == 2 ? 0 : param[2]);
    else
        return param;
}

function __asModMessage(param: string|mod.Message) {
    if (typeof (param) === "string")
        return mod.Message(param);
    return param;
}

function __fillInDefaultArgs(params: UIParams) {
    if (!params.hasOwnProperty('name'))
        params.name = "";
    if (!params.hasOwnProperty('position'))
        params.position = mod.CreateVector(0, 0, 0);
    if (!params.hasOwnProperty('size'))
        params.size = mod.CreateVector(100, 100, 0);
    if (!params.hasOwnProperty('anchor'))
        params.anchor = mod.UIAnchor.TopLeft;
    if (!params.hasOwnProperty('parent'))
        params.parent = mod.GetUIRoot();
    if (!params.hasOwnProperty('visible'))
        params.visible = true;
    if (!params.hasOwnProperty('padding'))
        params.padding = (params.type == "Container") ? 0 : 8;
    if (!params.hasOwnProperty('bgColor'))
        params.bgColor = mod.CreateVector(0.25, 0.25, 0.25);
    if (!params.hasOwnProperty('bgAlpha'))
        params.bgAlpha = 0.5;
    if (!params.hasOwnProperty('bgFill'))
        params.bgFill = mod.UIBgFill.Solid;
}

function __setNameAndGetWidget(uniqueName: any, params: any) {
    let widget = mod.FindUIWidgetWithName(uniqueName) as mod.UIWidget;
    mod.SetUIWidgetName(widget, params.name);
    return widget;
}

const __cUniqueName = "----uniquename----";

function __addUIContainer(params: UIParams) {
    __fillInDefaultArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIContainer(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            restrict);
    } else {
        mod.AddUIContainer(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill);
    }
    let widget = __setNameAndGetWidget(__cUniqueName, params);
    if (params.children) {
        params.children.forEach((childParams: any) => {
            childParams.parent = widget;
            __addUIWidget(childParams);
        });
    }
    return widget;
}

function __fillInDefaultTextArgs(params: UIParams) {
    if (!params.hasOwnProperty('textLabel'))
        params.textLabel = "";
    if (!params.hasOwnProperty('textSize'))
        params.textSize = 0;
    if (!params.hasOwnProperty('textColor'))
        params.textColor = mod.CreateVector(1, 1, 1);
    if (!params.hasOwnProperty('textAlpha'))
        params.textAlpha = 1;
    if (!params.hasOwnProperty('textAnchor'))
        params.textAnchor = mod.UIAnchor.CenterLeft;
}

function __addUIText(params: UIParams) {
    __fillInDefaultArgs(params);
    __fillInDefaultTextArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIText(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            __asModMessage(params.textLabel),
            params.textSize,
            __asModVector(params.textColor),
            params.textAlpha,
            params.textAnchor,
            restrict);
    } else {
        mod.AddUIText(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            __asModMessage(params.textLabel),
            params.textSize,
            __asModVector(params.textColor),
            params.textAlpha,
            params.textAnchor);
    }
    return __setNameAndGetWidget(__cUniqueName, params);
}

function __fillInDefaultImageArgs(params: any) {
    if (!params.hasOwnProperty('imageType'))
        params.imageType = mod.UIImageType.None;
    if (!params.hasOwnProperty('imageColor'))
        params.imageColor = mod.CreateVector(1, 1, 1);
    if (!params.hasOwnProperty('imageAlpha'))
        params.imageAlpha = 1;
}

function __addUIImage(params: UIParams) {
    __fillInDefaultArgs(params);
    __fillInDefaultImageArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIImage(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.imageType,
            __asModVector(params.imageColor),
            params.imageAlpha,
            restrict);
    } else {
        mod.AddUIImage(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.imageType,
            __asModVector(params.imageColor),
            params.imageAlpha);
    }
    return __setNameAndGetWidget(__cUniqueName, params);
}

function __fillInDefaultArg(params: any, argName: any, defaultValue: any) {
    if (!params.hasOwnProperty(argName))
        params[argName] = defaultValue;
}

function __fillInDefaultButtonArgs(params: any) {
    if (!params.hasOwnProperty('buttonEnabled'))
        params.buttonEnabled = true;
    if (!params.hasOwnProperty('buttonColorBase'))
        params.buttonColorBase = mod.CreateVector(0.7, 0.7, 0.7);
    if (!params.hasOwnProperty('buttonAlphaBase'))
        params.buttonAlphaBase = 1;
    if (!params.hasOwnProperty('buttonColorDisabled'))
        params.buttonColorDisabled = mod.CreateVector(0.2, 0.2, 0.2);
    if (!params.hasOwnProperty('buttonAlphaDisabled'))
        params.buttonAlphaDisabled = 0.5;
    if (!params.hasOwnProperty('buttonColorPressed'))
        params.buttonColorPressed = mod.CreateVector(0.25, 0.25, 0.25);
    if (!params.hasOwnProperty('buttonAlphaPressed'))
        params.buttonAlphaPressed = 1;
    if (!params.hasOwnProperty('buttonColorHover'))
        params.buttonColorHover = mod.CreateVector(1,1,1);
    if (!params.hasOwnProperty('buttonAlphaHover'))
        params.buttonAlphaHover = 1;
    if (!params.hasOwnProperty('buttonColorFocused'))
        params.buttonColorFocused = mod.CreateVector(1,1,1);
    if (!params.hasOwnProperty('buttonAlphaFocused'))
        params.buttonAlphaFocused = 1;
}

function __addUIButton(params: UIParams) {
    __fillInDefaultArgs(params);
    __fillInDefaultButtonArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIButton(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.buttonEnabled,
            __asModVector(params.buttonColorBase), params.buttonAlphaBase,
            __asModVector(params.buttonColorDisabled), params.buttonAlphaDisabled,
            __asModVector(params.buttonColorPressed), params.buttonAlphaPressed,
            __asModVector(params.buttonColorHover), params.buttonAlphaHover,
            __asModVector(params.buttonColorFocused), params.buttonAlphaFocused,
            restrict);
    } else {
        mod.AddUIButton(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.buttonEnabled,
            __asModVector(params.buttonColorBase), params.buttonAlphaBase,
            __asModVector(params.buttonColorDisabled), params.buttonAlphaDisabled,
            __asModVector(params.buttonColorPressed), params.buttonAlphaPressed,
            __asModVector(params.buttonColorHover), params.buttonAlphaHover,
            __asModVector(params.buttonColorFocused), params.buttonAlphaFocused);
    }
    return __setNameAndGetWidget(__cUniqueName, params);
}

function __addUIWidget(params: UIParams) {
    if (params == null)
        return undefined;
    if (params.type == "Container")
        return __addUIContainer(params);
    else if (params.type == "Text")
        return __addUIText(params);
    else if (params.type == "Image")
        return __addUIImage(params);
    else if (params.type == "Button")
        return __addUIButton(params);
    return undefined;
}

export function ParseUI(...params: any[]) {
    let widget: mod.UIWidget|undefined;
    for (let a = 0; a < params.length; a++) {
        widget = __addUIWidget(params[a] as UIParams);
    }
    return widget;
}

function MakeMessage(message: string, ...args: any[]) {
    switch (args.length) {
        case 0:
            return mod.Message(message);
        case 1:
            return mod.Message(message, args[0]);
        case 2:
            return mod.Message(message, args[0], args[1]);
        default:
            return mod.Message(message, args[0], args[1], args[2]);
    }
}

