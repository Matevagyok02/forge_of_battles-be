import {prop} from "@typegoose/typegoose";
import {Deck} from "./Card";
import {PlayerState, Pos} from "./PlayerState";
import {Abilities, TriggerEvent} from "./Abilities";

const placeholder = "card";

export class Battle {

    @prop({ type: String, _id: false })
    readonly playerStates!: Map<string, PlayerState>;

    @prop()
    private turnOfPlayer: string;

    @prop({ _id: false })
    readonly abilities: Abilities;

    @prop()
    readonly timeLimit?: number; //milliseconds per player

    @prop()
    turn: number;

    constructor(player2Id?: string, timeLimit?: number) {
        this.turnOfPlayer = player2Id ? player2Id : "";
        this.abilities = new Abilities(this);
        this.timeLimit = timeLimit;
        this.turn = 0;
    }

    setRefProps() {
        for (const [key, value] of this.playerStates.entries()) {
            value.setBattleRefAndIds(this, key);
        }

        this.abilities.setBattleRef(this);
    }

    endTurn(playerId: string): boolean {
        if (this.turnOfPlayer === playerId) {
            const players = Array.from(this.playerStates.keys());

            if (players.length === 2) {
                this.abilities.clearTurnBasedAttributeModifiers();

                const currentTurnPlayer = this.player(this.turnOfPlayer);
                players.splice(players.indexOf(this.turnOfPlayer), 1);
                const nextTurnPlayer = this.playerStates.get(players[0]);

                if (currentTurnPlayer && nextTurnPlayer) {
                    this.turnOfPlayer = players[0];
                    nextTurnPlayer.resetBeforeTurn();
                    currentTurnPlayer.deployedCards.delete(Pos.stormer);

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

        if (player && this.turnOfPlayer === playerId) {
            if (player.timeLeft) {
                player.timeLeft.startTurn();
            }
            this.turn += 1;
            player.nextTurnStage();
            this.abilities.applyEventDrivenAbilities(TriggerEvent.turn, player.id);
            return true;
        } else {
            return false;
        }
    }

    hasStarted(): boolean {
        return this.playerStates.size === 2;
    }

    initPlayerState(playerId: string, deckId: Deck) {
        if (this.playerStates.size < 2) {
            this.playerStates.set(playerId, new PlayerState(this, playerId, this.getOpponentId(playerId), deckId, this.timeLimit));
        }
    }

    setTurnOfPlayer(playerId: string) {
        this.turnOfPlayer = playerId;
    }

    hideDrawingDeckCards() {
        this.playerStates.forEach(player => player.drawingDeck.fill(placeholder));
    }

    clearRefs() {
        if (this.abilities) {
            this.abilities.clearBattleRef();
        }
        if (this.playerStates) {
            this.playerStates.forEach(player => player.clearBattleRef());
        }
    }

    hideOnHandCards(playerId: string) {
        const player = this.player(playerId);
        if (player) {
            player.onHand.fill(placeholder);
        }
    }

    isTurnOfPlayer(playerId: string) {
        return this.turnOfPlayer === playerId;
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
}
