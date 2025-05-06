import {prop} from "@typegoose/typegoose";
import {Card, Deck} from "./Card";
import {shuffleArray} from "../utils";
import {Battle} from "./Battle";
import {Ability, AbilityUsageType, DiscardRequirement, RequirementArgs, TriggerEvent} from "./Abilities";

export enum BattlefieldPos {
    attacker = "attacker",
    supporter = "supporter",
    defender = "defender",
    frontLiner = "frontLiner",
    vanguard = "vanguard",
    stormer = "stormer" //temporary position
}

export enum TurnStages {
    WAITING = 0,
    DRAW_AND_USE_PASSIVES = 1,
    ADVANCE_AND_STORM = 2,
    DEPLOY_AND_USE_ACTIONS = 3
}

/** Battlefield positions:
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

export class PlayerState {

    @prop()
    readonly deck: Deck;

    @prop({type: [String]})
    readonly drawingDeck: string[]; //array of cards which you draw from, length of array is your health (+ bonus health)

    @prop({type: [String]})
    readonly bonusHealth: string[]; //these cards function as health points but cannot be redrawn

    @prop({type: [String]})
    readonly casualties: string[]; //array of card ids in the discard pool

    @prop({type: [String]})
    readonly onHand: string[]; //array of card ids in the players hand

    @prop()
    private mana: number; //each member represents 1 mana, true if it is ready for use, false if not

    @prop({type: [String]})
    readonly manaCards: string[];

    @prop({type: Card, _id: false })
    readonly deployedCards: Map<BattlefieldPos, Card>;

    @prop()
    private turnStartedAt?: number;

    @prop()
    private timeLeft?: number; //milliseconds

    @prop()
    turnStage!: number;

    @prop()
    private drawsPerTurn!: number;

    private _battle?: Battle;
    private _id: string;

    constructor(battle: Battle, id: string, opponentId: string, deck: Deck, cards: CardWithPieces[], timeLeft?: number) {
        this.deck = deck;
        this.drawingDeck = this.assembleAndShuffleDeck(cards);
        this.casualties = [];
        this.onHand = [];
        this.mana = 0;
        this.manaCards = [];
        this.bonusHealth = [];
        this.deployedCards = new Map();
        this.turnStage = TurnStages.WAITING;
        this.drawsPerTurn = 0;
        if (timeLeft) {
            this.timeLeft = timeLeft;
        }

        this._battle = battle;
        this._id = id;
    }

    //game moves

    moveToFrontLine(card?: Card) {
        if (this.turnStage === TurnStages.ADVANCE_AND_STORM || !!card) {
            const cardToMove = card ? card : this.deployedCards.get(BattlefieldPos.stormer);
            let targetPos: BattlefieldPos.frontLiner | BattlefieldPos.vanguard;

            if (!this.deployedCards.has(BattlefieldPos.frontLiner)) {
                targetPos = BattlefieldPos.frontLiner;
            } else if (
                !this.deployedCards.has(BattlefieldPos.vanguard) &&
                !this._battle!.opponent(this._id)?.deployedCards.has(BattlefieldPos.vanguard)
            ) {
                targetPos = BattlefieldPos.vanguard;
            } else {
                return false;
            }

            if (cardToMove && targetPos) {
                this.deployedCards.set(targetPos, cardToMove);
                this.deployedCards.delete(BattlefieldPos.stormer);
                if (!card) {
                    this.nextTurnStage();
                }
                return true;
            }
        }
        return false;
    }

    async addToMana(position?: BattlefieldPos, forced?: boolean) {
        if (this.turnStage === TurnStages.ADVANCE_AND_STORM || forced) {
            const pos = position ? position : BattlefieldPos.stormer;
            const card = this.deployedCards.get(pos);

            if (card) {
                this.deployedCards.delete(pos);
                await this.removeBasicAndEventDrivenAbilities(card.passiveAbility);
                this.manaCards.push(card.id);
                this.mana = this.mana + 1;

                if (!forced) {
                    this.nextTurnStage();
                }
                return true;
            }
        }
        return false;
    }

    async drawCards(): Promise<string[] | undefined> {
        const drawnCards: string[] = [];
        const count = this._battle!.turn === 1 ? 1 : 2;

        if (this.drawsPerTurn < 1 && this.turnStage === TurnStages.DRAW_AND_USE_PASSIVES) {
            this.drawsPerTurn = 1;

            for (let i = 0; i < count; i++) {
                const card = this.drawingDeck.pop();
                if (card) {
                    drawnCards.push(card);
                    this.onHand.push(card);
                }
            }

            await this._battle!.abilities.applyEventDrivenAbilities(TriggerEvent.draw, this._id);
            return drawnCards;
        } else {
            return undefined;
        }
    }

    redrawCards(cardId?: string): string[] | undefined {
        const newCards: string[] = [];

        if (this.turnStage === TurnStages.DRAW_AND_USE_PASSIVES && this.drawsPerTurn === 1) {
            if (cardId) {
                if (this.onHand.slice(-2).includes(cardId)) {
                    const index = this.onHand.lastIndexOf(cardId);
                    this.onHand.splice(index, 1);

                    this.drawingDeck.unshift(cardId);
                    const newCard = this.drawingDeck.pop();
                    if (newCard) {
                        newCards.push(newCard);
                    }
                }
            } else {
                const cardsToChange = this.onHand.slice(-2);

                cardsToChange.forEach(card => {
                    const index = this.onHand.lastIndexOf(card);
                    this.onHand.splice(index, 1);

                    this.drawingDeck.unshift(card);
                    const newCard = this.drawingDeck.pop();
                    if (newCard) {
                        newCards.push(newCard);
                    }
                });
            }

            if (newCards.length > 0) {
                this.onHand.push(...newCards);
                this.drawsPerTurn = this.drawsPerTurn + 1;
                return newCards;
            }
        }
    }

    resetBeforeTurn() {
        this.mana = this.manaCards.length;
        this.drawsPerTurn = 0;
    }

    advanceCards() {
        if (this.turnStage === TurnStages.DRAW_AND_USE_PASSIVES) {
            const attacker = this.deployedCards.get(BattlefieldPos.attacker);
            if (attacker) {
                this.deployedCards.set(BattlefieldPos.stormer, attacker);
                this.deployedCards.delete(BattlefieldPos.attacker);
            }

            const supporter = this.deployedCards.get(BattlefieldPos.supporter);
            if (supporter) {
                this.deployedCards.set(BattlefieldPos.attacker, supporter);
                this.deployedCards.delete(BattlefieldPos.supporter);
            }

            const defender = this.deployedCards.get(BattlefieldPos.defender);
            if (defender) {
                this.deployedCards.set(BattlefieldPos.supporter, defender);
                this.deployedCards.delete(BattlefieldPos.defender);
            }

            if (!this.deployedCards.has(BattlefieldPos.stormer)) {
                this.turnStage = TurnStages.DEPLOY_AND_USE_ACTIONS;
            } else {
                this.nextTurnStage();
            }

            return true;
        } else {
            return false;
        }
    }

    async attack(actionArgs?: RequirementArgs, posToAttack?: BattlefieldPos.frontLiner | BattlefieldPos.vanguard) {
        if (this.deployedCards.has(BattlefieldPos.stormer)) {
            const opponent = this._battle!.opponent(this._id);
            const attacker = this.deployedCards.get(BattlefieldPos.stormer)

            if (opponent && attacker) {
                await this._battle!.abilities.applyEventDrivenAbilities(TriggerEvent.storm, this._id);

                if (posToAttack) {
                    const cardToAttack = opponent.deployedCards.get(posToAttack);

                    if (cardToAttack) {
                        if (attacker.attack >= cardToAttack.defence) {
                            await opponent.addToCasualties(posToAttack);
                        }
                    }
                } else {
                    const defender = opponent.deployedCards.get(BattlefieldPos.defender);
                    const damage = defender?.defence ?
                        attacker.attack - defender.defence : attacker.attack;

                    opponent.receiveDamage(damage);
                }

                if (attacker.actionAbility) {
                    await this._battle!.abilities.addAbility(this._id, attacker.actionAbility, actionArgs);
                }
                this.clearCard(BattlefieldPos.stormer);

                if (this.turnStage === TurnStages.ADVANCE_AND_STORM) {
                    this.nextTurnStage();
                }
                return true;
            }
        }
        return false;
    }

    async useAction(card: Card, args?: RequirementArgs, forced?: boolean) {
        if (
            (this.turnStage === TurnStages.DEPLOY_AND_USE_ACTIONS || forced) &&
            card.actionAbility &&
            this.onHand.indexOf(card.id) > -1
        ) {
            if (forced) {
                if (!card.actionAbility.requirements) {
                    card.actionAbility.requirements = {};
                }
                card.actionAbility.requirements.mana = 0;
            }

            this.onHand.splice(this.onHand.indexOf(card.id), 1);
            this.casualties.push(card.id);

            await this._battle!.abilities.applyEventDrivenAbilities(TriggerEvent.useAction, this._id);
            return await this._battle!.abilities.addAbility(this._id, card.actionAbility!, args);
        } else {
            return false;
        }
    }

    async usePassive(pos: BattlefieldPos, args?: RequirementArgs) {
        const card = this.deployedCards.get(pos);

        if (card) {
            return await this._battle!.abilities.addAbility(this._id, card.passiveAbility, args);
        } else {
            return false;
        }
    }

    async deploy(card: Card, useAsMana?: string[], forced?: boolean, onPos?: BattlefieldPos) {
        if (this.turnStage === TurnStages.DEPLOY_AND_USE_ACTIONS || forced) {
            const index = this.onHand.indexOf(card.id);
            let cost = this._battle!.abilities.applyCostModifiers(this._id, card.cost, TriggerEvent.deploy);

            if ((cost > 0 && this.useMana(cost, useAsMana)) || forced) {
                cost = 0;
            }

            if (
                index > -1 &&
                this.canDeploy() &&
                cost === 0
            ) {
                await this._battle!.abilities.applyEventDrivenAbilities(TriggerEvent.deploy, this._id);

                if (!card.passiveAbility.requirements && this._battle) {
                    await this._battle.abilities.addAbility(this._id, card.passiveAbility);
                }

                card.addTempId();
                this.deployedCards.set(forced && onPos ? onPos : BattlefieldPos.defender, card);
                this._battle!.abilities.applyAttributesOnDeployedCard(this._id);
                this.onHand.splice(this.onHand.indexOf(card.id), 1);
                return true;
            }
        }
        return false;
    }

    discard(cardToDiscard: string[] | BattlefieldPos) {
        const discardRequirement: DiscardRequirement = {
            player: this._id,
            amount: Array.isArray(cardToDiscard) ? cardToDiscard.length : 1,
            sacrifice: !Array.isArray(cardToDiscard)
        };

        const completeDiscardOperation = () => {
            this._battle!.abilities.applyEventDrivenAbilities(TriggerEvent.discard, this._id).then(() => {
                this._battle!.abilities.removeDiscardRequirement(discardRequirement);
                return true;
            });
        }

        if (JSON.stringify(this._battle!.abilities.discardRequirement) === JSON.stringify(discardRequirement)) {
            if (Array.isArray(cardToDiscard)) {
                if (cardToDiscard.every(card => this.onHand.includes(card))) {
                    cardToDiscard.forEach(card => {
                        const index = this.onHand.indexOf(card);
                        this.onHand.splice(index, 1);
                        this.casualties.push(card);
                    });
                    completeDiscardOperation();
                }
            } else {
                if (this.deployedCards.has(cardToDiscard)) {
                    const cardId = this.deployedCards.get(cardToDiscard)?.id;
                    this.casualties.push(cardId!);
                    this.deployedCards.delete(cardToDiscard);

                    completeDiscardOperation()
                }
            }
        }
        return false;
    }

    //helper functions

    async addToCasualties(pos: BattlefieldPos) {
        const card = this.deployedCards.get(pos);
        if (!!card) {
            this.removeBasicAndEventDrivenAbilities(card.passiveAbility);
            this.deployedCards.delete(pos);
            this.casualties.push(card.id);
            await this._battle!.abilities.applyEventDrivenAbilities(TriggerEvent.cardDeath, this.id);
        }
    }

    clearCard(pos?: BattlefieldPos) {
        const position = pos ? pos : BattlefieldPos.stormer;
        const card = this.deployedCards.get(position);

        if (card) {
            this.deployedCards.delete(position);
            this.removeBasicAndEventDrivenAbilities(card.passiveAbility);
            this.casualties.push(card.id);
        }
    }

    receiveDamage(damage: number) {
        for (let i = 0; i < damage; i++) {
            let casualty: string | undefined;

            if (this.bonusHealth.length > 0) {
                casualty = this.bonusHealth.pop();
            } else {
                casualty = this.drawingDeck.pop();
            }

            if (casualty) {
                this.casualties.push(casualty);
            } else {
                break;
            }
        }
    }

    removeBasicAndEventDrivenAbilities(ability: Ability) {
        if (
            ability.usageType === AbilityUsageType.basic ||
            ability.usageType === AbilityUsageType.eventDriven
        ) {
            this._battle!.abilities.removePassiveAbility(this._id, ability.cardId);
        }
    }

    private assembleAndShuffleDeck(cards: CardWithPieces[]): string[] {
        const drawingDeck: string[] = [];

        cards.forEach(card => {
            for (let i = 0; i < card.pieces; i++) {
                drawingDeck.push(card.id);
            }
        });

        return shuffleArray(drawingDeck);
    }

    canDeploy() {
        return !this.deployedCards.has(BattlefieldPos.defender);
    }

    sacrificeCard(pos: BattlefieldPos) {
        const card = this.deployedCards.get(pos);

        if (card) {
            this.removeBasicAndEventDrivenAbilities(card.passiveAbility);
            this.deployedCards.delete(pos);
            this.casualties.push(card.id);
        }
    }

    nextTurnStage() {
        switch (this.turnStage) {
            case TurnStages.WAITING:
                this.turnStage = TurnStages.DRAW_AND_USE_PASSIVES;
                break;
            case TurnStages.DRAW_AND_USE_PASSIVES:
                this.turnStage = TurnStages.ADVANCE_AND_STORM;
                break;
            case TurnStages.ADVANCE_AND_STORM:
                this.turnStage = TurnStages.DEPLOY_AND_USE_ACTIONS;
                break;
            case TurnStages.DEPLOY_AND_USE_ACTIONS:
                this.turnStage = TurnStages.WAITING;
                break;
            default:
                break;
        }
    }

    //mana management

    private useCardsAsMana(cards: string[]): number {
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

    private canUseCardsAsMana(cards: string[]): number {
        let count = 0;

        cards.forEach(card => {
            const index = this.onHand.indexOf(card);
            count += index > -1 ? 1 : 0;
        });

        return count;
    }

    useMana(amount: number, cards?: string[]): boolean {
        if (cards && cards.length > 0 && this.canUseCardsAsMana(cards) + this.mana >= amount) {
            this.mana = this.mana - (amount - this.useCardsAsMana(cards));
            return true;
        }
        else if (this.mana >= amount) {
            this.mana = this.mana - amount;
            return true;
        } else {
            return false;
        }
    }

    removeMana() {
        const manaCard = this.manaCards.pop();
        if (manaCard) {
            this.casualties.push(manaCard);
            this.mana = this.mana - 1;
        }
    }

    addMana(cards: string[]) {
        cards.forEach(card => {
            this.manaCards.push(card);
            this.mana = this.mana + 1;
        });

    }

    //other functions

    startTurn() {
        this.nextTurnStage();
        if (this.timeLeft) {
            this.turnStartedAt = Date.now();
        }
    }

    endTurn() {
        this.nextTurnStage();
        if (this.timeLeft && this.turnStartedAt) {
            this.timeLeft = this.timeLeft - (Date.now() - this.turnStartedAt);
        }
    }

    hasTimeLeft(): boolean {
        if (this.timeLeft && this.turnStartedAt) {
            return this.timeLeft - (Date.now() - this.turnStartedAt) > 999;
        } else {
            return true;
        }
    }

    get id() {
        return this._id
    }

    get battle() {
        return this._battle;
    }

    setBattleRefAndIds(battle: Battle, id: string) {
        this._battle = battle;
        this._id = id;
    }

    clearBattleRef() {
        this._battle = undefined;
    }
}

export interface CardWithPieces {
    id: string;
    pieces: number;
}