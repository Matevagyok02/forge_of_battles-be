import {Battle} from "./Battle";
import {modelOptions, prop, Severity} from "@typegoose/typegoose";
import {BattlefieldPos, TurnStages} from "./PlayerState";
import {AbilityService} from "../services/AbilityService";

@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class Abilities {

    @prop()
    readonly activatedAbilities: Ability[];

    @prop()
    discardRequirement?: DiscardRequirement;

    private battle?: Battle;

    constructor(battle: Battle) {
        this.battle = battle;
        this.activatedAbilities = [];
    }

    setBattleRef(battle: Battle) {
        this.battle = battle;
    }

    clearBattleRef() {
        this.battle = undefined;
    }

    async addAbility(cardHolderId: string, ability: Ability, args?: RequirementArgs): Promise<boolean> {
        ability.cardHolderId = cardHolderId;

        if (ability.requirements) {
            const resolvedAbility = this.resolveAbilityRequirements(ability, args);
            if (!resolvedAbility) {
                return false;
            } else {
                ability = resolvedAbility;
            }
        }

        if (ability.cardHolderId) {
            if (ability.usageType === AbilityUsageType.eventDriven) {
                const eventDrivenAbility = ability as EventDrivenAbility;
                eventDrivenAbility.triggeredBy = eventDrivenAbility.selfTriggered ?
                    cardHolderId : this.battle!.getOpponentId(cardHolderId);
                this.activatedAbilities.push(ability);
            }
            else if (ability.subtype === AbilitySubtype.costModifier) {
                this.activatedAbilities.push(ability as CostModifierAbility);
            }
            else if (ability.subtype === AbilitySubtype.attributeModifier) {
                this.applyAttributeModifier(ability as AttributeModifierAbility);
                if (ability.usageType === AbilityUsageType.basic || ability.usageType === AbilityUsageType.turnBased) {
                    this.activatedAbilities.push(ability as AttributeModifierAbility);
                }
            } else if (ability.usageType === AbilityUsageType.instant) {
                await AbilityService.executeAbility(this.battle!, ability as InstantAbility);
            }
        }
        return true;
    }

    removePassiveAbility(cardHolderId: string, cardId: string) {
        const index = this.activatedAbilities.findIndex(
            e => e.cardHolderId === cardHolderId && e.cardId === cardId
        );

        if (index > -1) {
            const ability: Ability = this.activatedAbilities[index];
            this.activatedAbilities.slice(index, 1);

            if (ability.subtype === AbilitySubtype.attributeModifier) {
                this.removeAttributeModifier(ability as AttributeModifierAbility);
            }
        }
    }

    async applyEventDrivenAbilities(event: TriggerEvent, triggeredBy: string) {
        const eventDrivenAbilities = this.activatedAbilities.filter(a =>
            a.usageType === AbilityUsageType.eventDriven
        );

        for (const a of eventDrivenAbilities) {
            const ability = a as EventDrivenAbility;
            if (ability.event?.includes(event) && ability.triggeredBy === triggeredBy) {
                await AbilityService.executeAbility(this.battle!, ability as InstantAbility);
            }
        }
    }

    clearTurnBasedAttributeModifiers() {
        const turnBasedAttributeModifiers = this.activatedAbilities.filter(a =>
            a.usageType === AbilityUsageType.turnBased && a.subtype === AbilitySubtype.attributeModifier
        );

        turnBasedAttributeModifiers.forEach(a => {
            const ability = a as AttributeModifierAbility;

            if (a.cardHolderId) {
                if (ability.targetPositions?.self && ability.targetPositions.self.length === 1) {
                    const player = this.battle!.player(a.cardHolderId);
                    if (player) {
                        const pos = getNextPos(ability.targetPositions.self[0]);
                        if (pos) {
                            const card = player.deployedCards.get(pos);
                            if (card) {
                                card.attack = card.attack - ability.attack;
                                card.defence = card.defence - ability.defence;
                            }
                        }
                    }
                }
                else if (ability.targetPositions?.opponent && ability.targetPositions.opponent.length === 1) {
                    const opponent = this.battle!.opponent(a.cardHolderId);
                    if (opponent) {
                        const pos = getNextPos(ability.targetPositions.opponent[0]);
                        if (pos) {
                            const card = opponent.deployedCards.get(pos);
                            if (card) {
                                card.attack = card.attack - ability.attack;
                                card.defence = card.defence - ability.defence;
                            }
                        }
                    }
                }
            }
        });
    }

    applyAttributesOnDeployedCard(deployerId: string) {
        const attributeModifiers = this.activatedAbilities.filter(a =>
            a.subtype === AbilitySubtype.attributeModifier
        );

        attributeModifiers.forEach(a => {
            const ability = a as AttributeModifierAbility;

            if (ability.cardHolderId === deployerId && ability.targetPositions?.self?.includes(BattlefieldPos.defender)) {
                const card = this.battle!.player(deployerId)?.deployedCards.get(BattlefieldPos.defender);
                if (card) {
                    card.modifyAttributes(ability);
                }
            }
            if (ability.cardHolderId != deployerId && ability.targetPositions?.opponent?.includes(BattlefieldPos.defender)) {
                const card = this.battle!.player(deployerId)?.deployedCards.get(BattlefieldPos.defender);
                if (card) {
                    card.modifyAttributes(ability);
                }
            }
        });
    }

    addDiscardRequirement(playerId: string, amount: number, sacrifice?: boolean) {
        this.discardRequirement = {
            player: playerId,
            amount: amount,
            sacrifice: sacrifice ? sacrifice : false
        };

        if (this.battle!.timeLimit) {
            const player = this.battle!.player(playerId);
            const opponent = this.battle!.opponent(playerId);
            player?.endTurn();
            opponent?.startTurn();
        }
    }

    removeDiscardRequirement(discardReq: DiscardRequirement) {
        this.discardRequirement = undefined;

        if (this.battle!.timeLimit) {
            const player = this.battle!.player(discardReq.player);
            const opponent = this.battle!.opponent(discardReq.player);
            player?.startTurn();
            opponent?.endTurn();
        }
    }

    private resolveAbilityRequirements(
        ability: Ability,
        args?: RequirementArgs
    ): Ability | null {
        const requirements = ability.requirements;
        let mana = requirements?.mana;
        const sacrifice = requirements?.sacrifice;
        const targetPositions = requirements?.selectablePositions;
        const targetCardAmount = requirements?.selectedCardAmount;

        const player = this.battle!.player(ability.cardHolderId as string);

        if (player) {
            if (player.turnStage === TurnStages.ADVANCE_AND_STORM && ability.type === AbilityType.action) {
                mana = 0;
            }

            const checkSacrifice =
                !sacrifice ||
                (sacrifice && args?.cardToSacrifice && player.deployedCards.has(args?.cardToSacrifice as BattlefieldPos));

            const checkTargetPositions =
                !targetPositions ||
                (targetPositions && this.validateTarget(player.id ,targetPositions, args?.targetPositions));

            const checkTargetCards =
                !targetCardAmount ||
                (targetCardAmount > 0 && args?.targetCards?.length === targetCardAmount)

            const checkEmptyDeployZone =
                !requirements?.emptyDeployZone
                || player.canDeploy()
                || (sacrifice && args?.cardToSacrifice === BattlefieldPos.defender);

            const checkNestedArgs =
                !requirements?.nestedArgs
                || args?.nestedArgs

            if (
                checkSacrifice &&
                checkTargetPositions &&
                checkEmptyDeployZone &&
                checkTargetCards &&
                checkNestedArgs
            ) {
                let hasEnoughMana;

                if (mana && mana > 0) {
                    const event = ability.type === AbilityType.action ?
                        TriggerEvent.useAction : TriggerEvent.usePassive;
                    const manaCost = this.applyCostModifiers(player.id, mana, event);

                    hasEnoughMana = player.useMana(manaCost ,args?.useAsMana);
                } else {
                    hasEnoughMana = true;
                }

                if (hasEnoughMana) {
                    if (sacrifice && args?.cardToSacrifice) {
                        player.sacrificeCard(args.cardToSacrifice);
                    }
                    if (targetPositions && args?.targetPositions && !ability.targetPositions) {
                        ability.targetPositions = {
                            self: args.targetPositions.self,
                            opponent: args.targetPositions.opponent
                        }
                    }
                    if (targetCardAmount && targetCardAmount > 0) {
                        ability.targetCards = args?.targetCards;
                    }
                    if (requirements?.nestedArgs) {
                        ability.nestedArgs = args!.nestedArgs;
                    }

                    return ability;
                }
            }
        }
        return null;
    }

    private validateTarget(
        cardHolderId: string,
        targetReq: { self: BattlefieldPos[], opponent: BattlefieldPos[], allowCrossTarget: boolean, targetAmount: number },
        targetArg?: { self: BattlefieldPos[], opponent: BattlefieldPos[] }
    ): boolean {
        if (targetArg) {
            let validTarget;

            if (targetReq.allowCrossTarget) {
                validTarget =
                    targetArg.self.length > 0
                    && targetArg.opponent.length > 0
                    && targetArg.self.length + targetArg.opponent.length === targetReq.targetAmount;
            } else {
                validTarget =
                    (targetArg.self.length === targetReq.targetAmount
                        && targetReq.self.length > 0) ||
                    (targetArg.opponent.length === targetReq.targetAmount
                        && targetReq.opponent.length > 0);
            }

            const targetExists =
                targetArg.self.every(pos =>
                    this.battle!.player(cardHolderId)?.deployedCards.has(pos)
                ) &&
                targetArg.opponent.every(pos =>
                    this.battle!.opponent(cardHolderId)?.deployedCards.has(pos)
                );

            return validTarget && targetExists;
        } else {
            return false;
        }
    }

    applyCostModifiers(
        cardHolderId: string,
        cost: number,
        event: TriggerEvent.deploy | TriggerEvent.useAction | TriggerEvent.usePassive,
    ): number {
        let newCost = cost;

        const applyCostModifiers = (modifiers: Ability[]) => {
            modifiers.forEach(m => {
                let amount;
                m = m as CostModifierAbility;

                if (newCost === 0) {
                    return;
                }

                switch (event) {
                    case TriggerEvent.useAction:
                        amount = m.action;
                        break;
                    case TriggerEvent.usePassive:
                        amount = m.passive;
                        break;
                    case TriggerEvent.deploy:
                        amount = m.deploy ;
                        break;
                }

                if (m.usageType === AbilityUsageType.turnBased) {
                    this.removePassiveAbility(m.cardHolderId as string, m.cardId);
                }

                if (amount > -1) {
                    newCost += amount;
                } else {
                    newCost = 0;
                }
            });
        }

        const turnBasedCostModifiers = this.activatedAbilities.filter(a =>
            a.subtype === AbilitySubtype.costModifier
            && a.usageType === AbilityUsageType.turnBased
            && a.cardHolderId === cardHolderId
        );

        applyCostModifiers(turnBasedCostModifiers);

        if (newCost > 0) {
            const costModifiers = this.activatedAbilities.filter(a =>
                a.subtype === AbilitySubtype.costModifier
                && a.usageType === AbilityUsageType.basic
                && a.cardHolderId === cardHolderId
            );
            applyCostModifiers(costModifiers);
        }

        return newCost;
    }

    private applyAttributeModifier(ability: AttributeModifierAbility) {
        if (ability.cardHolderId) {
            if (ability.targetPositions?.self && ability.targetPositions?.self.length > 0) {
                const player = this.battle!.player(ability.cardHolderId);

                ability.targetPositions.self.forEach(target => {
                    const card = player?.deployedCards.get(target);
                    if (card) {
                        card.modifyAttributes(ability);
                    }
                });
            }

            if (ability.targetPositions?.opponent && ability.targetPositions?.opponent.length > 0) {
                const opponent = this.battle!.opponent(ability.cardHolderId);

                ability.targetPositions.opponent.forEach(target => {
                    const card = opponent?.deployedCards.get(target);
                    if (card) {
                        card.modifyAttributes(ability);
                    }
                });
            }
        }
    }

    private removeAttributeModifier(ability: AttributeModifierAbility) {
        if (ability.cardHolderId) {
            if (ability.targetPositions?.self && ability.targetPositions?.self.length > 0) {
                const player = this.battle!.player(ability.cardHolderId);

                ability.targetPositions?.self.forEach(target => {
                    const card = player?.deployedCards.get(target);
                    if (card) {
                        card.attack = card.attack - ability.attack;
                        card.defence = card.defence - ability.defence;
                    }
                });
            }
            if (ability.targetPositions?.opponent && ability.targetPositions?.opponent.length > 0) {
                const opponent = this.battle!.opponent(ability.cardHolderId);

                ability.targetPositions?.self.forEach(target => {
                    const card = opponent?.deployedCards.get(target);
                    if (card) {
                        card.attack = card.attack - ability.attack;
                        card.defence = card.defence - ability.defence;
                    }
                });
            }
        }
    }
}

const getNextPos = (pos: BattlefieldPos): BattlefieldPos | undefined => {
    switch (pos) {
        case BattlefieldPos.defender: return BattlefieldPos.supporter;
        case BattlefieldPos.supporter: return BattlefieldPos.attacker;
        case BattlefieldPos.attacker: return BattlefieldPos.stormer;
        default: return undefined;
    }
}

export interface RequirementArgs {
    cardToSacrifice?: BattlefieldPos;
    useAsMana?: string[];
    targetPositions?: {
        self: BattlefieldPos[],
        opponent: BattlefieldPos[]
    },
    targetCards?: string[];
    nestedArgs?: RequirementArgs;
}

export interface AbilityRequirements {
    mana?: number;
    sacrifice?: boolean;
    emptyDeployZone?: boolean;
    nestedArgs?: boolean;
    selectablePositions?: {
        self: BattlefieldPos[],
        opponent: BattlefieldPos[],
        allowCrossTarget: boolean,
        targetAmount: number
    };
    selectedCardAmount?: number
}

export interface IAbility {
    cardId: string;
    description: string;
    type: AbilityType;
    usageType: AbilityUsageType;
    subtype: AbilitySubtype;
    requirements?: AbilityRequirements;

    //value of these is assigned by the player
    cardHolderId?: string;
    targetPositions?: {
        self: BattlefieldPos[],
        opponent: BattlefieldPos[]
    },
    targetCards?: string[];
    nestedArgs?: RequirementArgs;
}

export interface DiscardRequirement {
    player: string;
    amount: number;
    sacrifice: boolean;
}

export interface CostModifierAbility extends IAbility {
    deploy: number;
    action: number;
    passive: number;
}

export interface AttributeModifierAbility extends IAbility {
    attack: number;
    defence: number;
}

export interface InstantAbility extends IAbility {
    name: string;
    args?: object;
}

export interface EventDrivenAbility extends InstantAbility {
    event: TriggerEvent[];
    selfTriggered: boolean;
    triggeredBy?: string;
}

export type Ability = CostModifierAbility | AttributeModifierAbility | EventDrivenAbility | InstantAbility;

export enum AbilityType {
    action = "action",
    passive = "passive"
}

export enum AbilityUsageType {
    basic = "basic", //automatically applied when the card is placed on the war track and removed together with the card
    eventDriven = "eventDriven", //effect is applied when the specified event occurs
    turnBased = "turnBased", //lasts till the end of the turn/till the effect is used (these effects have a cost and always have modifier subtype)
    instant = "instant", //the effect is instantly applied after paying the cost (and lasts forever)
}

export enum AbilitySubtype {
    attributeModifier = "attributeModifier",
    costModifier = "costModifier",
    instant = "instant"
}

export enum TriggerEvent {
    draw = "draw",
    deploy = "deploy",
    useAction = "useAction",
    usePassive = "usePassive",
    storm = "storm",
    discard = "discard",
    cardDeath = "cardDeath",
    turn = "turn",
}