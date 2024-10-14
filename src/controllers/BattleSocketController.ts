import {BattleService} from "../services/BattleService";
import {Server, Namespace, Socket} from "socket.io";
import {busyStatusIndicator, pubRedisClient} from "../redis";
import {Deck} from "../models/Card";
import {Battle} from "../models/Battle";

class BattleSocketController {

    private readonly nsp!: Namespace;
    private battleService!: BattleService;
    private key!: string;
    private userId!: string;
    private userSocket!: string;
    private opponentId!: string;

    constructor(io: Server) {
        this.nsp = io.of("/battle");
    }

    setUp = () => {
        const nsp: Namespace = this.nsp;

        nsp.on("connection", async (socket: Socket) => {
            const userId = socket.handshake.auth.userId;
            const key = socket.handshake.query.key as string;
            const opponentId = "x" //await BattleService.getOpponentId(userId, key);

            if (!opponentId) {
                nsp.to(socket.id).emit(
                    "connection-fail",
                    { message: "Failed to connect" }
                );
            } else {
                this.userSocket = socket.id;
                this.key = key;
                this.userId = userId;
                this.opponentId = opponentId;
                this.battleService = new BattleService(userId, key);

                //basic events for starting the game

                socket.on("join", async () => await this.joinMatchRoom(socket.id));

                socket.on("disconnect", async () => await this.leaveMatchRoom());

                socket.on("deck-select", async (data: { deck: string }) => await this.selectDeck(data));

                socket.on("ready", async (data: { deck: string }) => await this.setReadyState(data));

                //basic game events

                socket.on("start-turn", async () => await this.startTurn());

                socket.on("end-turn", async () => await this.endTurn());

                socket.on("draw", async () => await this.drawCards());

                //advanced game events

                socket.on("redraw", async (data: { cardId: string }) => await this.redrawCards(data));

                socket.on("deploy", async (data: { cardId: string, sacrificeCards?: string[]}) => await this.deployCard(data))

                socket.on("add-mana", async () => await this.addStormerToMana());

                socket.on("move-to-front", async () => await this.moveToFrontLine());

                socket.on("activate-effect", async (data: { position: string, sacrificeCards: string[], target?: string }) => await this.activateEffect(data));
            }
        });
    }

    //basic game operations

    private async deployCard(data: { cardId: string, sacrificeCards?: string[], position?: string}) {
        const battle = await this.battleService.deployCard(data.cardId, data.sacrificeCards, data.position);
        if (battle) {
            this.emitToSelf("deployed", { battle: battle });
            await this.emitToOpponent("opponent-deployed", { battle: battle });
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
        const move = await this.battleService.addStormerToMana();
        if (move) {
            this.emitToSelf("moved-to-front", {});
            await this.emitToOpponent("opponent-moved-to-front", {});
        } else {
            this.emitErrorMessage();
        }
    }

    private async activateEffect(data: { position: string, sacrificeCards: string[], target?: string }) {
        const battle = await this.battleService.activatePassiveEffect(data.position, data.sacrificeCards, data.target);
        if (battle) {
            this.emitToSelf("activated-effect", { battle: battle });
            await this.emitToOpponent("opponent-activated-effect", { battle: battle });
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
            const setPlayer = await this.battleService.setPlayer(deck);

            if (setPlayer) {
                const { battle, arePlayersReady } = setPlayer;

                if (battle && arePlayersReady) {
                    await this.emitToOpponent("ready", { battle: battle });
                    await this.emitToSelf("ready", { battle: battle });
                    await pubRedisClient.hset(this.key, "started", 1);
                } else {
                    await this.emitToOpponent("opponent-ready", data);
                }
            } else {
                await this.emitErrorMessage();
            }
        }
    }

    private async selectDeck(data: { deck: string }) {
        if ((<any>Object).values(Deck).includes(data.deck)) {
            await this.emitToOpponent("deck-select", data);
        } else {
            await this.emitErrorMessage();
        }
    }

    private async joinMatchRoom(socketId: string) {
        const room = await pubRedisClient.hgetall(this.key);
        if (room && room["started"]) {
            const battle = await this.battleService.getBattle();
            this.emitToSelf("reconnect", { battle: battle });

            if (!room[this.opponentId]) {
                this.emitToSelf("opponent-offline", { message: "Your opponent is offline" });
            }
        }

        await pubRedisClient.set(this.userId, busyStatusIndicator);
        await pubRedisClient.hset(this.key, { [this.userId]: socketId });
    }

    private async leaveMatchRoom() {
        await pubRedisClient.hdel(this.key, this.userId);
        await pubRedisClient.del(this.userId);
        await this.emitToOpponent("opponent-left", { message: "Your opponent has left the game" });
    }

    //event emitting

    private emitToSelf(ev: string, data: any) {
        if (data.battle && data.battle instanceof Battle) {
            data.battle.hideOnHandCards(this.opponentId);
            data.battle.hideDrawingDeckCards();
        }

        this.nsp.to(this.userSocket).emit(ev, data);
    }

    private async emitToOpponent(ev: string, data: any) {
        const opponentSocketId = await pubRedisClient.hget(this.key, this.opponentId);
        if (data.battle && data.battle instanceof Battle) {
            data.battle.hideOnHandCards(this.userId);
            data.battle.hideDrawingDeckCards();
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