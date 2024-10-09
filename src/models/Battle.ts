import {prop, PropType} from "@typegoose/typegoose";
import {Deck} from "./Card";
import {shuffleArray} from "../utils";
import {Error} from "mongoose";

enum CardPosition {
    ATTACKER = "attacker",
    SUPPORTER = "supporter",
    DEFENDER = "defender",
    FRONT_LINER = "frontLiner",
    VANGUARD = "vanguard"
}

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

    @prop({ type: String, _id: false }, PropType.MAP)
    readonly deployedCards: Map<CardPosition, string>;

    @prop()
    private drawsPerTurn!: number;

    @prop({ _id: false })
    readonly timeLeft?: TimeLeft; //milliseconds

    constructor(deckId: Deck, timeLeft?: number) {
        this.deck = deckId;
        this.drawingDeck = this.assembleAndShuffleDeck(deckId);
        this.casualties = [];
        this.onHand = [];
        this.mana = [];
        this.deployedCards = new Map<CardPosition, string>();
        this.drawsPerTurn = 0;
        if (timeLeft) {
            this.timeLeft = new TimeLeft(timeLeft);
        }
    }

    deployCard(cardId: string, position: CardPosition) {
        if (!this.deployedCards.get(position)) {
            this.deployedCards.set(position, cardId);
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

        if (this.timeLeft) {
            this.timeLeft.startTurn();
        }
    }
}

export class Battle {

    @prop({ type: String, _id: false })
    readonly playerStates!: Map<string, PlayerState>;

    @prop()
    private _turnOfPlayer: string;

    constructor(player2Id?: string) {
        this._turnOfPlayer = player2Id ? player2Id : "";
    }

    isTurnOfPlayer(playerId: string): boolean {
        return this._turnOfPlayer === playerId;
    }

    endTurn(): boolean {
        const players = Array.from(this.playerStates.keys());

        if (players.length === 2) {
            const currentTurnPlayer = this.playerStates.get(this._turnOfPlayer);
            players.splice(players.indexOf(this._turnOfPlayer), 1);
            const nextTurnPlayer = this.playerStates.get(players[0]);

            if (currentTurnPlayer && nextTurnPlayer) {
                this._turnOfPlayer = players[0];
                nextTurnPlayer.resetBeforeTurn();

                if (currentTurnPlayer.timeLeft) {
                    currentTurnPlayer.timeLeft.endTurn();
                }

                return (nextTurnPlayer.timeLeft && !nextTurnPlayer.timeLeft.hasTimeLeft()) || nextTurnPlayer.drawingDeck.length < 1;
            } else {
                throw new Error("The game has not started yet");
            }
        } else
            throw new Error("The game has not started yet");
    }

    hasStarted(): boolean {
        return this.playerStates.size === 2;
    }

    initPlayerState(playerId: string, deckId: Deck, timeLeft?: number) {
        if (this.playerStates.size < 2) {
            this.playerStates.set(playerId, new PlayerState(deckId, timeLeft));
        }
    }
}
