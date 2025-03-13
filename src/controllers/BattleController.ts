import {BattleService, RawRequirementArgs} from "../services/BattleService";
import {Namespace, Socket} from "socket.io";
import {busyStatusIndicator, pubRedisClient} from "../redis";
import {Deck} from "../models/Card";
import {Battle} from "../models/Battle";
import {Match, MatchStage} from "../models/Match";
import {CardService} from "../services/CardService";
import {MatchService} from "../services/MatchService";

type BattleData = Match | { battle: Battle } | { message: string };

class BattleController {

    private readonly nsp: Namespace;
    private readonly key: string;
    private readonly userId: string;
    private readonly userSocket: string;
    private battleService!: BattleService;
    private cardService!: CardService;
    private opponentId!: string;

    constructor(nsp: Namespace, socket: Socket) {
        this.nsp = nsp;
        this.userSocket = socket.id;
        this.userId = socket.handshake.auth.userId;
        this.key = socket.handshake.query.key as string;
    }

    public init(socket: Socket) {
        this.setUpSocket(socket).then(match => {
            if (match) {
                this.emitToSelf("connected", match);
            }
        });
    }

    private async setUpSocket(socket: Socket) {
        const opponentId = await BattleService.getOpponentId(this.userId, this.key);

        if (!opponentId) {
            this.emitToSelf("connection-fail", { message: "Failed to connect" });
        } else {
            this.opponentId = opponentId;
            this.battleService = new BattleService(this.userId, this.key);
            this.cardService = new CardService();
            await this.joinMatchRoom();

            //basic events for starting the game
            socket.on("ready", async (data: { deck: string }) => await this.setReadyState(data));
            socket.on("disconnect", async () => await this.leaveMatchRoom());

            //basic game events
            socket.on("start-turn", async () => await this.startTurn());
            socket.on("end-turn", async () => await this.endTurn());

            //advanced game events
            socket.on("draw", async () => await this.drawCards());
            socket.on("redraw", async (data: { cardId: string }) => await this.redrawCards(data));
            socket.on("advance", async () => await this.advanceCards());
            socket.on("deploy", async (data: { cardId: string, sacrificeCards?: string[]}) => await this.deploy(data));
            socket.on("storm", async (data: { posToAttack?: string, args?: RawRequirementArgs }) => await this.storm(data));
            socket.on("use-action", async (data: { cardId: string, args?: RawRequirementArgs })=> this.useAction(data));
            socket.on("use-passive", async (data: { pos: string, args?: RawRequirementArgs })=> this.usePassive(data));
            socket.on("add-mana", async () => await this.addStormerToMana());
            socket.on("move-to-front", async () => await this.moveToFrontLine());
            socket.on("discard", async (data: { cardToDiscard: string[] | string }) => await this.discard(data));

            //other events
            socket.on("message", (data: { message: string, emitter: string }) => this.sendMessage(data));

            return await new MatchService().getByKey(this.key);
        }
    }

    //basic game operations

    private async useAction(data: { cardId: string, args?: RawRequirementArgs }) {
        const object = await this.battleService.useAction(data.cardId, data.args);
        const battle = object?.battle;

        if (battle) {
            if (object?.discardForced) {
                await this.emitToPlayers("forced-to-discard", { battle: battle });
            } else {
                await this.emitToPlayers("used-action", { battle: battle });
            }
        } else {
            this.emitErrorMessage();
        }
    }

    private async usePassive(data: { pos: string, args?: RawRequirementArgs }) {
        const battle = await this.battleService.usePassive(data.pos, data.args);
        if (battle) {
            await this.emitToPlayers("used-passive", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async deploy(data: { cardId: string, sacrificeCards?: string[] }) {
        const battle = await this.battleService.deploy(data.cardId, data.sacrificeCards);
        if (battle) {
            await this.emitToPlayers("deployed", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async storm(data: { posToAttack?: string, args?: RawRequirementArgs }) {
        const battle = await this.battleService.storm(data?.posToAttack, data?.args);
        if (battle) {
            await this.emitToPlayers("stormed", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async redrawCards(data?: { cardId: string }) {
        const battle = await this.battleService.redrawCards(data?.cardId);
        if (battle) {
            this.emitToSelf("redrawn", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async discard(data: { cardToDiscard: string[] | string }){
        const battle = await this.battleService.discard(data.cardToDiscard);

        if (battle) {
            await this.emitToPlayers("discarded", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async advanceCards() {
        const battle = await this.battleService.advanceCards();
        if (battle) {
            await this.emitToPlayers("advanced", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async addStormerToMana() {
        const add = await this.battleService.addStormerToMana();
        if (add) {
            await this.emitToPlayers("added-mana", { battle: add });
        } else {
            this.emitErrorMessage();
        }
    }

    private async moveToFrontLine() {
        const move = await this.battleService.moveToFrontLine();
        if (move) {
            await this.emitToPlayers("moved-to-front", { battle: move });
        } else {
            this.emitErrorMessage();
        }
    }

    //basic game operations

    private async drawCards() {
        const battle = await this.battleService.drawCards();

        if (battle) {
            await this.emitToPlayers("turn-ended", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async startTurn() {
        const battle = await this.battleService.startTurn();

        if (battle) {
            await this.emitToPlayers("turn-started", { battle: battle });
        }
    }

    private async endTurn() {
        const battle = await this.battleService.endTurn();

        if (battle) {
            await this.emitToPlayers("turn-ended", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    //connection management + game initialization

    private async setReadyState(data: { deck: string }) {
        if ((<any>Object).values(Deck).includes(data.deck)) {
            const deck = Deck[data.deck as keyof typeof Deck];
            const cards = await this.cardService.getAllFromDeck(deck);
            const setPlayer = await this.battleService.setPlayer(deck, cards);

            if (typeof setPlayer === "boolean") {
                this.emitToSelf("ready", "You are ready");
                await this.emitToOpponent("opponent-ready", { message: "Your opponent is ready" });

                if (setPlayer) {
                    await pubRedisClient.hset(this.key, "stage", MatchStage.started);
                }
            } else {
                await this.emitErrorMessage();
            }
        }
    }

    private async joinMatchRoom() {
        const room = await pubRedisClient.hgetall(this.key);

        if (room && room["stage"] === MatchStage.started) {
            if (!room[this.opponentId]) {
                this.emitToSelf("opponent-offline", { message: "Your opponent is offline" });
            } else {
                await this.emitToOpponent("opponent-connected", { message: "Your opponent has reconnected" })
            }
        }

        await pubRedisClient.set(this.userId, busyStatusIndicator);
        await pubRedisClient.hset(this.key, { [this.userId]: this.userSocket });
    }

    public async leaveMatchRoom() {
        await pubRedisClient.hdel(this.key, this.userId);
        await pubRedisClient.del(this.userId);
        await this.emitToOpponent("opponent-left", { message: "Your opponent has left the game" });
    }

    private async sendMessage(data: { message: string, emitter: string }) {
        await this.emitToOpponent("message", data);
    }

    //event emitting

    private emitToSelf(ev: string, data: any) {
        this.nsp.to(this.userSocket).emit(ev, this.cleanBattleObj(data, this.opponentId));
    }

    private async emitToOpponent(ev: string, data: BattleData) {
        const opponentSocketId = await pubRedisClient.hget(this.key, this.opponentId);

        if (opponentSocketId) {
            this.nsp.to(opponentSocketId).emit(ev, this.cleanBattleObj(data, this.userId));
        }
    }

    private async emitToPlayers(ev: string, data: BattleData) {
        await this.emitToSelf(ev, data);
        await this.emitToOpponent("opponent-" + ev, data);

        await this.emitSignalIfFinished(data);
    }

    private emitErrorMessage() {
        this.emitToSelf("error", { message: "Completing your previous action has failed" });
    }

    private cleanBattleObj(data: any, hideCardsOf: string) {
        if (data?.battle) {
            data.battle.clearRefs();
            data.battle.hideDrawingDeckCards();

            const newData = JSON.parse(JSON.stringify(data));

            if (hideCardsOf in newData.battle.playerStates) {
                const playerState = newData.battle.playerStates[hideCardsOf];
                playerState.onHand.fill("card");
            }

            return newData;
        } else {
            return data;
        }
    }

    private async emitSignalIfFinished(data: any) {
        if (data?.battle) {
            const battle = data.battle as Battle;

            if (battle.hasEnded()) {
                const finishedMatch = await this.battleService.finishMatch();
                if (finishedMatch) {
                    await this.emitToSelf("match-ended", finishedMatch);
                    await this.emitToOpponent("match-ended", finishedMatch);
                }
            }
        }
    }
}

export default BattleController;