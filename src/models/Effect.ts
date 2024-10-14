import {Battle, Pos} from "./Battle";
import {prop, PropType} from "@typegoose/typegoose";

export class Effects {

    private eventInitiatorId!: string;
    private battle!: Battle;
    private args!: any;
    private opponentId?: string;

    applyEffect = (effectId: string, evenInitiator: string, battle: Battle, args: any, opponentId?: string) => {
        this.eventInitiatorId = evenInitiator;
        this.battle = battle;
        this.args = args;
        this.opponentId = opponentId;

        const effect = this.effects.get(effectId);
        if (effect)
            return effect();
        else
            return null;
    }

    private damage = (): Battle | null => {
        if (this.opponentId) {
            const damageTaker = this.battle.player(this.opponentId);
            const { damage } = this.args;

            if (damageTaker && typeof damage === "number") {
                for (let i = 0; i < damage; i++) {
                    damageTaker.drawingDeck.pop();
                }
                return this.battle;
            }
        }
        return null;
    }

    private heal = (): Battle | null => {
        const playerToHeal = this.battle.player(this.eventInitiatorId);
        const { heal } = this.args;

        if (playerToHeal && typeof heal === "number") {
            for (let i = 0; i < heal; i++) {
                const healCard = playerToHeal.casualties.pop();
                if (healCard) {
                    playerToHeal.drawingDeck.unshift(healCard);
                }
            }
            return this.battle;
        } else {
            return null;
        }
    }

    private returnToDrawingDeck = (): Battle | null => {
        const player = this.battle.player(this.eventInitiatorId);
        const stormer = player?.deployedCards.get(Pos.STORMER)?.id;

        if (player && stormer) {
            player.drawingDeck.unshift(stormer);
            return this.battle;
        } else {
            return null;
        }
    }

    private draw = ():Battle | null => {
        const player = this.battle.player(this.eventInitiatorId);
        const { draw } = this.args;

        if (player && typeof draw === "number") {
            player.drawCards(draw);
            return this.battle;
        } else {
            return null;
        }
    }

    private addToMana = (): Battle | null => {
        const player = this.battle.player(this.eventInitiatorId);
        const stormer = player?.deployedCards.get(Pos.STORMER);

        if (player && stormer) {
            player.mana.push(true);
            return this.battle;
        } else {
            return null;
        }
    }

    private backToHand = (): Battle | null => {
        const player = this.battle.player(this.eventInitiatorId);
        const cardToRevive = player?.deployedCards.get(Pos.STORMER) ?
            player?.deployedCards.get(Pos.STORMER)?.id : player?.casualties.pop();

        if (player && cardToRevive) {
            player.onHand.push(cardToRevive);
            return this.battle;
        } else {
            return null;
        }
    }

    readonly effects = new Map<string, Function>([
        ["heal", this.heal],
        ["damage", this.damage],
        ["returnToDrawingDeck", this.returnToDrawingDeck],
        ["draw", this.draw],
        ["addToMana", this.addToMana],
        ["backToHand", this.backToHand]
    ]);
}

export class ModifierEffects {

    @prop()
    readonly attributeModifiers!: IAttributeModifier[];
    /*
    The value of attack and defence is applied on card(s) in the specified position.
    New modifiers are applied when the card with the modifier effect is deployed.
    Cards deployed afterward will be also modified(if they pass the position criteria),
    when the card with the modifier effect is removed, the other cards will also lose the effect.
    */

    @prop()
    readonly deploymentModifiers!: IDeploymentModifier[];
    /*
    These modifiers get evaluated at every deploy event.
    If the modifier value is 0, cards can be deployed for free,
    if the value is negative, it will be subtracted from the cost,
    if positive, it is added to the cost.
    */

    @prop()
    readonly turnBasedAttributeModifiers!: IAttributeModifier[];
    /*
    Modifiers are instantly applied and removed when the turn ends.
    */

    @prop()
    readonly turnBasedDeploymentModifiers!: IDeploymentModifier[];
    /*
    These will be active till the next deploy/use-action event.
    */

    constructor() {
        this.deploymentModifiers = [];
        this.attributeModifiers = [];
        this.turnBasedAttributeModifiers = [];
        this.turnBasedDeploymentModifiers = [];
    }

    addDeploymentModifier(modifier: IDeploymentModifier) {
        if (this.deploymentModifiers.findIndex(existingModifier => existingModifier.cardId === modifier.cardId) === -1) {
            this.deploymentModifiers.push(modifier);
        }
    }

    removeDeploymentModifier(cardId: string) {
        const index = this.deploymentModifiers?.findIndex(modifier => modifier.cardId === cardId);
        if (index > -1) {
            this.deploymentModifiers.slice(index, 1);
        }
    }

    addAttributeModifier(modifier: IAttributeModifier) {
        if (this.attributeModifiers.findIndex(existingModifier => existingModifier.cardId === modifier.cardId) === -1) {
            this.attributeModifiers.push(modifier);
        }
    }

    removeAttributeModifier(cardId: string) {
        const index = this.attributeModifiers?.findIndex(modifier => modifier.cardId === cardId);
        if (index > -1) {
            this.attributeModifiers.slice(index, 1);
        }
    }

    addTurnBasedAttributeModifier(modifier: IAttributeModifier) {
        this.turnBasedAttributeModifiers.push(modifier);
    }

    removeTurnBasedAttributeModifier(cardId: string) {
        const index = this.turnBasedAttributeModifiers?.findIndex(modifier => modifier.cardId === cardId);
        if (index > -1) {
            this.turnBasedAttributeModifiers.slice(index, 1);
        }
    }

    addTurnBasedDeploymentModifier(modifier: IDeploymentModifier) {
        this.turnBasedDeploymentModifiers.push(modifier);
    }

    removeTurnBasedDeploymentModifier(cardId: string) {
        const index = this.turnBasedDeploymentModifiers?.findIndex(modifier => modifier.cardId === cardId);
        if (index > -1) {
            this.turnBasedDeploymentModifiers.slice(index, 1);
        }
    }
}

export class EventDrivenEffects {

    @prop({ type: String, _id: false }, PropType.MAP)
    activeTriggersEffects: Map<TriggerEvent, IEventDrivenEffect[]>;

    constructor() {
        this.activeTriggersEffects = new Map<TriggerEvent, IEventDrivenEffect[]>();
    }

    addTriggerEffect(playerId: string , opponentId: string, effect: IEventDrivenEffect) {
        effect.cardHolderId = playerId;

        const effects = this.activeTriggersEffects.get(effect.event);
        if (effects?.findIndex(e => e.cardId === effect.cardId ) === -1) {
            effect.triggeredBy = effect.triggeredBy === "self" ? playerId : opponentId;
            effects.push(effect);
        }
    }

    removeTriggerEffect(playerId: string, cardId: string) {
        for (const effects of this.activeTriggersEffects.values()) {
            const index = effects.findIndex(e => e.cardId === cardId && e.cardHolderId === playerId);
            if (index > -1) {
                effects.splice(index, 1);
                break;
            }
        }
    }

    applyTriggeredEffects(playerId: string, event: TriggerEvent, battle: Battle): Battle | null {
        const allEventEffects: IEventDrivenEffect[] | undefined = this.activeTriggersEffects.get(event);
        const effects =
            allEventEffects && allEventEffects.filter(e => e.triggeredBy === playerId);

        let updatedBattle = battle;

        effects?.forEach(e => {
            const callback = this.effectMap.get(e.name);
            if (callback) {
                updatedBattle = callback(e.triggeredBy ,updatedBattle);
            }
        });

        return updatedBattle;
    }

    private backToHandAfterStorming(playerId: string, battle: Battle) {
        const player = battle.player(playerId);
        const cardToRevive = player?.deployedCards.get(Pos.STORMER) ?
            player?.deployedCards.get(Pos.STORMER)?.id : player?.casualties.pop();

        if (player && cardToRevive) {
            player.onHand.push(cardToRevive);
            return battle;
        } else {
            return null;
        }
    }

    readonly effectMap = new Map<string, Function>([
        ["backToHandAfterStorming", this.backToHandAfterStorming]
    ]);
}

export interface IEffect {
    cardId: string;
    cardHolderId?: string;
    requirements?: { mana?: number, sacrifice?: number };
    type: EffectType;
    subtype: EffectSubtype;
}

export interface IDeploymentModifier extends IEffect {
    cost?: {
        modifier: number;
        deploy: boolean;
        action: boolean;
    }
    positions?: Pos[];
}

export interface IAttributeModifier extends IEffect {
    attack: number;
    defence: number;
    position: Pos;
    applyOnSelf: boolean;
}

export interface IEventDrivenEffect extends IEffect {
    event: TriggerEvent;
    triggeredBy: string;
    name: string;
}

export interface IInstantEffect extends IEffect {
    name: string;
    target?: string;
    applyOnSelf: boolean;
}

export type Effect = IDeploymentModifier | IAttributeModifier | IEventDrivenEffect | IInstantEffect;

export enum EffectType {
    BASIC = "basic", //automatically applied when the card is placed on the war track and removed together with the card
    EVENT_DRIVEN = "event", //effect is applied when the specified event occurs
    TURN_BASED = "turn", //lasts till the end of the turn/till the effect is used (these effects have a cost)
    INSTANT = "instant" //the effect is instantly applied after paying the cost (and lasts forever)
}

export enum EffectSubtype {
    ATTRIBUTE_MODIFIER = "attribute",
    DEPLOYMENT_MODIFIER = "deployment",
}

export enum TriggerEvent {
    DRAW = "draw",
    DEPLOY = "deploy",
    STORM = "storm",
    DISCARD = "discard",
    TURN = "turn",
}