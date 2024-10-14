import {prop, PropType} from "@typegoose/typegoose";
import {Card, Deck} from "./Card";
import {shuffleArray} from "../utils";
import {
    Effect,
    EffectSubtype,
    EffectType,
    EventDrivenEffects,
    IAttributeModifier,
    IDeploymentModifier,
    IEventDrivenEffect,
    ModifierEffects,
    TriggerEvent
} from "./Effect";

export enum Pos {
    ATTACKER = "attacker",
    SUPPORTER = "supporter",
    DEFENDER = "defender",
    FRONT_LINER = "frontLiner",
    VANGUARD = "vanguard",
    STORMER = "stormer",
    ALL = "*",
    UNDEFINED = "?"
}

/** War Track positions:
 *      ---              ---          [p1-Stormer]
 *
 *  p2-Defender     p2-Front liner     p1-Attacker
 *
 *                    Vanguard
 *  p2-Supporter    (only one player   p1-Supporter
 *                   can take it)
 *
 *  p2-Attacker     p1-Front liner     p1-Defender
 *
 * [p2-Stormer]          ---               ---
* */

const placeholder = "card";

class TimeLeft {

    @prop()
    private turnStartedAt: number;

    @prop()
    private timeLeft: number;

    constructor(timeLeft: number) {
        this.turnStartedAt = 0;
        this.timeLeft = timeLeft;
    }

    startTurn() {
        this.turnStartedAt = new Date().getTime()
    }

    endTurn() {
        this.timeLeft = new Date().getTime() - this.turnStartedAt;
    }

    hasTimeLeft(): boolean {
        return this.timeLeft > 1000;
    }
}

class PlayerState {

    @prop()
    readonly deck: Deck;

    @prop({type: [String]})
    readonly drawingDeck: string[];

    @prop({type: [String]})
    readonly casualties: string[]; //array of card ids in the discard pool

    @prop({type: [String]})
    readonly onHand: string[]; //array of card ids in the players hand

    @prop({type: [Boolean]})
    readonly mana: boolean[]; //each member represents 1 mana, true if it is ready for use, false if not

    @prop({type: String, _id: false }, PropType.MAP)
    readonly deployedCards: Map<Pos, Card>;

    @prop()
    private drawsPerTurn!: number;

    @prop({ _id: false })
    readonly modifierEffects: ModifierEffects;

    @prop({ _id: false })
    readonly timeLeft?: TimeLeft; //milliseconds

    constructor(deckId: Deck, timeLeft?: number) {
        this.deck = deckId;
        this.drawingDeck = this.assembleAndShuffleDeck(deckId);
        this.casualties = [];
        this.onHand = [];
        this.mana = [];
        this.deployedCards = new Map<Pos, Card>();
        this.modifierEffects = new ModifierEffects();
        this.drawsPerTurn = 0;
        if (timeLeft) {
            this.timeLeft = new TimeLeft(timeLeft);
        }
    }

    moveToFrontLine() {
        const stormer = this.deployedCards.get(Pos.STORMER);
        if (stormer) {
            if (!this.deployedCards.get(Pos.FRONT_LINER)) {
                this.deployedCards.set(Pos.FRONT_LINER, stormer);
                this.deployedCards.delete(Pos.STORMER);
                return true;
            } else if (!this.deployedCards.get(Pos.VANGUARD)) {
                this.deployedCards.set(Pos.VANGUARD, stormer);
                this.deployedCards.delete(Pos.STORMER);
                return true;
            }
        }
        return false;
    }

    addToMana(position?: Pos): Card | null {
        const pos = position ? position : Pos.STORMER;
        const card = this.deployedCards.get(pos);

        if (card) {
            this.mana.push(true);
            this.deployedCards.delete(pos);
            return card;
        } else {
            return null;
        }
    }

    drawCards(count: number) {
        const drawnCards: string[] = [];

        if (this.drawsPerTurn < 1) {
            for (let i = 0; i < count; i++) {
                const card = this.drawingDeck.pop();
                if (card) {
                    drawnCards.push(card);
                    this.onHand.push(card);
                }
            }
        }

        return drawnCards;
    }

    redrawCards(cardId?: string): string[] {
        const newCards: string[] = [];

        if (this.drawsPerTurn < 2) {
            const cardsToChange = cardId ? [cardId] : this.onHand.slice(0, 2);

            if (cardId && (this.onHand.indexOf(cardId) !== 0 || this.onHand.indexOf(cardId) !== 1)) {
                return newCards;
            } else {
                cardsToChange.forEach(card => {
                   this.onHand.splice(this.onHand.indexOf(card), 1);
                   this.drawingDeck.unshift(card);
                   const newCard = this.drawingDeck.pop();
                   if (newCard) {
                       newCards.push(newCard);
                   }
                });
            }
        } else {
            return newCards;
        }

        this.drawsPerTurn = this.drawsPerTurn + 1;
        return newCards;
    }

    assembleAndShuffleDeck(deckId: Deck): string[] {
        const drawingDeck: string[] = [];
        const cards: { id: string, count: number }[] = require("../../decks.json")[deckId];

        cards.forEach(card => {
            for (let i = 0; i < card.count; i++) {
                drawingDeck.push(card.id);
            }
        });

        return shuffleArray(drawingDeck);
    }

    resetBeforeTurn() {
        this.drawsPerTurn = 0;
        this.mana.fill(true);
        this.advanceCards();
    }

    advanceCards() {
        const attacker = this.deployedCards.get(Pos.ATTACKER);
        if (attacker) {
            this.deployedCards.set(Pos.STORMER, attacker);
        }

        const supporter = this.deployedCards.get(Pos.SUPPORTER);
        if (supporter) {
            this.deployedCards.set(Pos.ATTACKER, supporter);
        }

        const defender = this.deployedCards.get(Pos.DEFENDER);
        if (defender) {
            this.deployedCards.set(Pos.SUPPORTER, defender);
        }
    }

    deploy(card: Card, sacrificeCards?: string[], position?: Pos): boolean {
        const index = this.onHand.indexOf(card.id);
        let cost = card.cost;

        cost = this.applyCostModifiers(cost, TriggerEvent.DEPLOY);

        if (cost > 0 && sacrificeCards) {
            cost = cost - this.sacrificeCards(sacrificeCards);
        }

        if (cost > 0 && this.useMana(cost)) {
            cost = 0;
        }

        const deployOnPos = position ? position : Pos.DEFENDER;

        if (
            index > -1 &&
            !this.deployedCards.get(deployOnPos) &&
            cost === 0 &&
            this.applyDeployPosModifiers(deployOnPos)
        ) {
            this.deployedCards.set(deployOnPos, card);
            this.onHand.splice(index, 1);
            return true;
        } else {
            return false;
        }
    }

    sacrificeCards(cards: string[]): number {
        let count = 0;

        cards.forEach(card => {
           const index = this.onHand.indexOf(card);
           if (index > -1) {
               this.onHand.splice(index, 1);
               this.casualties.push(card);
               count++;
           }
        });

        return count;
    }

    useMana(amount: number): boolean {
        const manaLeft = this.mana.filter(mana => mana);

        if (manaLeft.length >= amount) {
            const startIndex = this.mana.indexOf(true);
            for (let i = startIndex; i < amount; i++) {
                this.mana[i] = false;
            }
            return true;
        } else {
            return false;
        }
    }

    applyDeployPosModifiers(posToDeployOn: Pos): boolean {
        if (posToDeployOn === Pos.DEFENDER) {
            return true;
        } else {
            let canDeploy = false;

            const modifiers = this.modifierEffects.deploymentModifiers.filter(m => m.positions);
            for (let i = 0; i < modifiers.length; i++) {
                const modPositions = modifiers[i]?.positions;
                if (modPositions && modPositions.indexOf(posToDeployOn) > -1) {
                    canDeploy = true;
                    break;
                }
            }
            return canDeploy;
        }
    }

    applyCostModifiers(cost: number, event: TriggerEvent): number {
        let newCost = cost;
        const modifiers= event === TriggerEvent.DEPLOY ?
            this.modifierEffects.deploymentModifiers.filter(m => m.cost && m.cost.deploy) :
            this.modifierEffects.deploymentModifiers.filter(m => m.cost && m.cost.action);
        const turnBasedModifiers= event === TriggerEvent.DEPLOY ?
            this.modifierEffects.turnBasedDeploymentModifiers.filter(m => m.cost && m.cost.deploy) :
            this.modifierEffects.turnBasedDeploymentModifiers.filter(m => m.cost && m.cost.action);

        if (turnBasedModifiers.length > 0) {
            for (let i = 0; i < turnBasedModifiers.length; i++) {
                const mod = modifiers[i].cost?.modifier;
                if (!mod)
                    continue;

                if (mod === 0) {
                    newCost = 0;
                } else {
                    newCost = newCost + mod;
                    this.modifierEffects.removeTurnBasedDeploymentModifier(turnBasedModifiers[i].cardId);
                }

                if (newCost === 0) {
                    break;
                }
            }
        }

        if (newCost > 0 && modifiers.length > 0) {
            for (let i = 0; i < modifiers.length; i++) {
                const mod = modifiers[i].cost?.modifier;
                if (!mod)
                    continue;

                if (mod === 0) {
                    newCost = 0;
                } else {
                    newCost = newCost + mod;
                }

                if (newCost === 0) {
                    break;
                }
            }
        }

        return newCost;
    }

    addToCasualties(position?: Pos): Card | null {
        const pos = position ? position : Pos.DEFENDER;
        const card = this.deployedCards.get(pos);
        if (card) {
            this.deployedCards.delete(pos);
            this.casualties.push(card.id);
            return card;
        } else {
            return null;
        }
    }

    //modifier management methods for deployed cards

    applyModifierOnPosition(position: string, mod: { attack: number, defence: number }) {
        const pos: Pos = Pos[position as keyof typeof Pos];
        const card = this.deployedCards.get(pos);

        if (card) {
            card.attack = card.attack + mod.attack;
            card.defence = card.defence + mod.defence;
        }
    }

    applyModifierOnAllCards(mod: { attack: number, defence: number }) {
        for (const pos in Pos) {
            if (pos !== Pos.ALL && pos !== Pos.UNDEFINED ) {
                this.applyModifierOnPosition(pos, mod);
            }
        }
    }

    removeModifierOnPosition(position: Pos, mod: { attack: number, defence: number }) {
        const card = this.deployedCards.get(position);

        if (card) {
            card.attack = card.attack - mod.attack;
            card.defence = card.defence - mod.defence;
        }
    }

    removeModifierOnAllCards(mod: { attack: number, defence: number }) {
        for (const pos in Pos) {
            this.applyModifierOnPosition(pos, mod);
        }
    }
}

export class Battle {

    @prop({ type: String, _id: false })
    readonly playerStates!: Map<string, PlayerState>;

    @prop()
    private turnOfPlayer: string;

    @prop({ _id: false })
    readonly eventDrivenEffects: EventDrivenEffects;

    constructor(player2Id?: string) {
        this.turnOfPlayer = player2Id ? player2Id : "";
        this.eventDrivenEffects = new EventDrivenEffects();
    }

    endTurn(playerId: string): boolean {
        if (this.turnOfPlayer === playerId) {
            this.removeTurnBasedAttributeModifiers(this.turnOfPlayer);
            const players = Array.from(this.playerStates.keys());

            if (players.length === 2) {
                const currentTurnPlayer = this.player(this.turnOfPlayer);
                players.splice(players.indexOf(this.turnOfPlayer), 1);
                const nextTurnPlayer = this.playerStates.get(players[0]);

                if (currentTurnPlayer && nextTurnPlayer) {
                    this.turnOfPlayer = players[0];
                    nextTurnPlayer.resetBeforeTurn();
                    currentTurnPlayer.deployedCards.delete(Pos.STORMER);

                    if (currentTurnPlayer.timeLeft) {
                        currentTurnPlayer.timeLeft.endTurn();
                    }
                    return (nextTurnPlayer.timeLeft && !nextTurnPlayer.timeLeft.hasTimeLeft()) || nextTurnPlayer.drawingDeck.length < 1;
                }
            }
        }
        return false;
    }

    startTurn(playerId: string): boolean {
        const player = this.player(playerId);

        if (player) {
            if (player.timeLeft) {
                player.timeLeft.startTurn();
            }
            return true;
        } else {
            return false;
        }
    }

    hasStarted(): boolean {
        return this.playerStates.size === 2;
    }

    initPlayerState(playerId: string, deckId: Deck, timeLeft?: number) {
        if (this.playerStates.size < 2) {
            this.playerStates.set(playerId, new PlayerState(deckId, timeLeft));
        }
    }

    hideDrawingDeckCards() {
        this.playerStates.forEach(player => player.drawingDeck.fill(placeholder));
    }

    hideOnHandCards(playerId: string) {
        const player = this.player(playerId);
        if (player) {
            player.onHand.fill(placeholder);
        }
    }

    player(playerId: string) {
        return this.playerStates.get(playerId);
    }

    opponent(playerId: string) {
        const playerIds = Array.from(this.playerStates.keys());
        playerIds.splice(playerIds.indexOf(playerId), 1);
        return this.playerStates.get(playerIds[0]);
    }

    getOpponentId(playerId: string) {
        const playerIds = Array.from(this.playerStates.keys());
        playerIds.splice(playerIds.indexOf(playerId), 1);
        return playerIds[0];
    }

    deployCard(playerId: string, deployParams: { card: Card, sacrificeCards?: string[], position?: Pos}): boolean {
        const deploy =
            this.player(playerId)?.deploy(deployParams.card, deployParams.sacrificeCards, deployParams.position);

        if (deploy) {
            this.addPassiveEffect(playerId, deployParams.card.passiveEffect);
            return true;
        } else
            return false;
    }

    addPassiveEffect(playerId: string ,effect: Effect) {
        if (effect.type === EffectType.BASIC) {
            if (effect.subtype === EffectSubtype.ATTRIBUTE_MODIFIER) {
                this.addAttributeModifier(playerId ,effect as IAttributeModifier);
            }
            else if (effect.subtype === EffectSubtype.DEPLOYMENT_MODIFIER) {
                this.addDeploymentModifier(playerId ,effect as IAttributeModifier);
            }
        } else if (effect.type === EffectType.EVENT_DRIVEN) {
            const opponentId = this.getOpponentId(playerId);
            this.eventDrivenEffects.addTriggerEffect(playerId, opponentId, effect as IEventDrivenEffect);
        }
    }

    removeEffectOfCard(playerId: string, card: Card) {
        const player = this.player(playerId);

        if (card.passiveEffect.type === EffectType.BASIC) {
            if (card.passiveEffect.subtype === EffectSubtype.ATTRIBUTE_MODIFIER) {
                const attributeModifiers = player?.modifierEffects.attributeModifiers;

                if (attributeModifiers && player) {
                    const modifier = attributeModifiers.find(m => m.cardId === card.id);
                    if (modifier) {
                        player.modifierEffects.removeAttributeModifier(card.id);
                        if (modifier.position !== Pos.ALL) {
                            player.removeModifierOnPosition(modifier.position, modifier);
                        } else {
                            player.removeModifierOnAllCards(modifier);
                        }
                    }
                }
            } else if (card.passiveEffect.subtype === EffectSubtype.DEPLOYMENT_MODIFIER) {
                player?.modifierEffects.removeDeploymentModifier(card.id);
            }
        }

        if (card.passiveEffect.type === EffectType.EVENT_DRIVEN) {
            this.eventDrivenEffects.removeTriggerEffect(playerId, card.id);
        }
    }

    addAttributeModifier(playerId: string, modifier: IAttributeModifier) {
        const player = modifier.applyOnSelf ?
            this.player(playerId) : this.opponent(playerId);

        const { attack, defence, position } = modifier;
        const mod = { attack: attack, defence: defence };
        if (position === Pos.ALL)
            player?.applyModifierOnAllCards(mod);
        else
            player?.applyModifierOnPosition(position as string, mod);


        if (modifier.type === EffectType.TURN_BASED) {
            player?.modifierEffects.addTurnBasedAttributeModifier(modifier);
        } else if (modifier.type === EffectType.BASIC) {
            player?.modifierEffects.addAttributeModifier(modifier);
        }
    }

    addDeploymentModifier(playerId: string, modifier: IDeploymentModifier) {
        const player = this.player(playerId);

        if (modifier.type === EffectType.TURN_BASED) {
            player?.modifierEffects.addTurnBasedDeploymentModifier(modifier);
        } else if (modifier.type === EffectType.BASIC) {
            player?.modifierEffects.addDeploymentModifier(modifier);
        }
    }

    removeTurnBasedAttributeModifiers(playerId: string) {
        const currentPlayer = this.playerStates.get(playerId);
        const modifiers = currentPlayer?.modifierEffects.turnBasedAttributeModifiers;

        modifiers?.forEach(modifier  => {
            const player = modifier.applyOnSelf ?
                this.player(playerId) : this.opponent(playerId);

            const { cardId, attack, defence, position } = modifier;
            const mod = { attack: attack, defence: defence };
            if (position === Pos.ALL)
                player?.removeModifierOnAllCards(mod);
            else
                player?.removeModifierOnPosition(position, mod);

            currentPlayer?.modifierEffects.removeTurnBasedAttributeModifier(cardId);
        });
    }

    addToMana(playerId: string, position?: Pos) {
        const card = this.player(playerId)?.addToMana(position);
        if (card) {
            this.removeEffectOfCard(playerId, card);
            return true;
        } else {
            return false;
        }
    }

    activatePassiveEffect(playerId: string, position: Pos, sacrificeCards?: string[], target?: Pos) {
        const player = this.player(playerId);
        const card = player?.deployedCards.get(position);
        const effect = card?.passiveEffect;
        const cost = effect?.requirements;
        let requirementsMet = false;

        if (sacrificeCards && cost?.sacrifice) {
            const sacrificedCount = player?.sacrificeCards(sacrificeCards);
            if (sacrificedCount && sacrificedCount >= cost.sacrifice) {
                requirementsMet = true;
            }
        } else if (cost?.mana) {
            if (player?.useMana(cost.mana)) {
                requirementsMet = true;
            }
        }

        if (requirementsMet) {
            if (effect?.type === EffectType.TURN_BASED) {
                if (effect.subtype === EffectSubtype.ATTRIBUTE_MODIFIER) {
                    const attributeModifier = effect as IAttributeModifier;

                    if (target && attributeModifier.position === Pos.UNDEFINED) {
                        attributeModifier.position = target;
                    }

                    attributeModifier.cardHolderId = playerId;

                    this.addAttributeModifier(playerId, attributeModifier);
                } else if (effect.subtype === EffectSubtype.DEPLOYMENT_MODIFIER) {
                    this.addDeploymentModifier(playerId, effect as IDeploymentModifier);
                }
            } else if (effect?.type === EffectType.INSTANT) {
                //TO DO
            }
            return true;
        } else {
            return false;
        }
    }
}
