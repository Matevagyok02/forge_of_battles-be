import {BattleService, RawRequirementArgs} from "../services/BattleService";
import {Namespace, Socket} from "socket.io";
import {busyStatusIndicator, pubRedisClient} from "../redis";
import {Deck} from "../models/Card";
import {Battle} from "../models/Battle";
import {MatchStage} from "../models/Match";
import {CardService} from "../services/CardService";

class BattleSocketController {

    private readonly nsp: Namespace;
    private readonly key: string;
    private readonly userId: string;
    private userSocket: string;
    private battleService!: BattleService;
    private cardService!: CardService;
    private opponentId!: string;

    constructor(nsp: Namespace, socket: Socket) {
        this.nsp = nsp;
        this.userSocket = socket.id;
        this.userId = socket.handshake.auth.userId;
        this.key = socket.handshake.query.key as string;
        this.setUp(socket);
    }

    private async setUp(socket: Socket) {
        const opponentId = await BattleService.getOpponentId(this.userId, this.key);

        if (!opponentId) {
            this.nsp.to(socket.id).emit("connection-fail", { message: "Failed to connect" });
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
        }
    }

    //basic game operations

    private async useAction(data: { cardId: string, args?: RawRequirementArgs }) {
        const object = await this.battleService.useAction(data.cardId, data.args);
        const battle = object?.battle;

        if (battle) {
            if (object?.discardForced) {
                this.emitToSelf("opponent-forced-to-discard", { battle: battle });
                await this.emitToOpponent("forced-to-discard", { battle: battle });
            } else {
                this.emitToSelf("used-action", { battle: battle });
                await this.emitToOpponent("opponent-used-action", { battle: battle });
            }
        } else {
            this.emitErrorMessage();
        }
    }

    private async usePassive(data: { pos: string, args?: RawRequirementArgs }) {
        const battle = await this.battleService.usePassive(data.pos, data.args);
        if (battle) {
            this.emitToSelf("used-passive", { battle: battle });
            await this.emitToOpponent("opponent-used-passive", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async deploy(data: { cardId: string, useAsMana?: string[] }) {
        const battle = await this.battleService.deploy(data.cardId, data.useAsMana);
        if (battle) {
            this.emitToSelf("deployed", { battle: battle });
            await this.emitToOpponent("opponent-deployed", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async storm(data: { posToAttack?: string, args?: RawRequirementArgs }) {
        const battle = await this.battleService.storm(data.posToAttack, data.args);
        if (battle) {
            this.emitToSelf("stormed", { battle: battle });
            await this.emitToOpponent("opponent-stormed", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async redrawCards(data?: { cardId: string }) {
        const drawnCards = await this.battleService.redrawCards(data?.cardId);
        if (drawnCards) {
            this.emitToSelf("redrawn", {drawnCards: drawnCards });
            await this.emitToOpponent("opponent-redrawn", {drawnCards: drawnCards.length });
        } else {
            this.emitErrorMessage();
        }
    }

    private async discard(data: { cardToDiscard: string[] | string }){
        const battle = await this.battleService.discard(data.cardToDiscard);

        if (battle) {
            await this.emitToOpponent("opponent-discarded", { battle: battle });
            this.emitToSelf("discarded", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async advanceCards() {
        const drawnCards = await this.battleService.advanceCards();
        if (drawnCards) {
            this.emitToSelf("advanced", {});
            await this.emitToOpponent("opponent-advanced", {});
        } else {
            this.emitErrorMessage();
        }
    }

    private async addStormerToMana() {
        const add = await this.battleService.addStormerToMana();
        if (add) {
            this.emitToSelf("added-mana", {});
            await this.emitToOpponent("opponent-added-mana", {});
        } else {
            this.emitErrorMessage();
        }
    }

    private async moveToFrontLine() {
        const move = await this.battleService.moveToFrontLine();
        if (move) {
            this.emitToSelf("moved-to-front", {});
            await this.emitToOpponent("opponent-moved-to-front", {});
        } else {
            this.emitErrorMessage();
        }
    }

    //basic game operations

    private async drawCards() {
        const drawnCards = await this.battleService.drawCards();
        if (drawnCards) {
            this.emitToSelf("drawn", {drawnCards: drawnCards });
            await this.emitToOpponent("opponent-drawn", {drawnCards: drawnCards.length });
        } else {
            this.emitErrorMessage();
        }
    }

    private async startTurn() {
        const battle = await this.battleService.startTurn();

        if (battle) {
            this.emitToSelf("turn-started", { battle: battle });
            await this.emitToOpponent("opponent-turn-started", { battle: battle })
        } else {
            this.emitErrorMessage();
        }
    }

    private async endTurn() {
        const battle = this.battleService.endTurn();

        if (battle) {
            await this.emitToOpponent("turn-ended", { battle: battle });
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
                await this.emitToOpponent("opponent-ready", "Your opponent is ready");

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
            const battle = await this.battleService.getBattle();
            this.emitToSelf("reconnect", { battle: battle });

            if (!room[this.opponentId]) {
                this.emitToSelf("opponent-offline", { message: "Your opponent is offline" });
            } else {
                await this.emitToOpponent("opponent-reconnected", { message: "Your opponent has reconnected" })
            }
        }

        await pubRedisClient.set(this.userId, busyStatusIndicator);
        await pubRedisClient.hset(this.key, { [this.userId]: this.userSocket });
    }

    private async leaveMatchRoom() {
        await pubRedisClient.hdel(this.key, this.userId);
        await pubRedisClient.del(this.userId);
        await this.emitToOpponent("opponent-left", { message: "Your opponent has left the game" });
    }

    //event emitting

    private emitToSelf(ev: string, data: any) {
        if (data && data.battle && data.battle instanceof Battle) {
            (data.battle as Battle).clearRefs();
            (data.battle as Battle).hideOnHandCards(this.opponentId);
            (data.battle as Battle).hideDrawingDeckCards();
        }

        this.nsp.to(this.userSocket).emit(ev, data);
    }

    private async emitToOpponent(ev: string, data: any) {
        const opponentSocketId = await pubRedisClient.hget(this.key, this.opponentId);
        if (data && data.battle && data.battle instanceof Battle) {
            (data.battle as Battle).clearRefs();
            (data.battle as Battle).hideOnHandCards(this.userId);
            (data.battle as Battle).hideDrawingDeckCards();
        }

        if (opponentSocketId) {
            this.nsp.to(opponentSocketId).emit(ev, data);
        }
    }

    private emitErrorMessage() {
        this.emitToSelf("error", { message: "Completing your previous action has failed" });
    }
}

export default BattleSocketController;