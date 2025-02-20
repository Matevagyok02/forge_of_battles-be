import {BattleService, RawRequirementArgs} from "../services/BattleService";
import {Namespace, Socket} from "socket.io";
import {busyStatusIndicator, pubRedisClient} from "../redis";
import {Deck} from "../models/Card";
import {Battle} from "../models/Battle";
import {MatchStage} from "../models/Match";
import {CardService} from "../services/CardService";
import {MatchService} from "../services/MatchService";
import {TurnStages} from "../models/PlayerState";

const timeLeftSuffix = "-timeLeft";

class BattleController {

    private readonly nsp: Namespace;
    private readonly key: string;
    private readonly userId: string;
    private readonly userSocket: string;
    private battleService!: BattleService;
    private cardService!: CardService;
    private opponentId!: string;

    private emitTimeLeft?: NodeJS.Timeout;
    private timeLeft?: number;

    constructor(nsp: Namespace, socket: Socket) {
        this.nsp = nsp;
        this.userSocket = socket.id;
        this.userId = socket.handshake.auth.userId;
        this.key = socket.handshake.query.key as string;
    }

    public init(socket: Socket) {
        this.setUpSocket(socket).then(match => {
            if (match) {
                if (match.battle.timeLimit) {
                    this.setUpTimer(match.battle);
                }
                this.nsp.to(socket.id).emit("connected", match);
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

    private async setUpTimer(battle: Battle) {
        await this.initTimeLeft(battle);
        const turnStage = battle.playerStates.get(this.userId)?.turnStage;

        if (
            battle.isTurnOfPlayer(this.userId) &&
            (turnStage && turnStage != TurnStages.WAITING)
        ) {
            await this.initTimeLeftEmitter();
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
            await this.emitToOpponent("opponent-discarded", { battle: battle });
            this.emitToSelf("discarded", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async advanceCards() {
        const battle = await this.battleService.advanceCards();
        if (battle) {
            this.emitToSelf("advanced", { battle: battle });
            await this.emitToOpponent("opponent-advanced", { battle: battle });
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
        const battle = await this.battleService.drawCards();

        if (battle) {
            this.emitToSelf("drawn", { battle: battle });
            await this.emitToOpponent("opponent-drawn", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async startTurn() {
        const battle = await this.battleService.startTurn(this.timeLeft);

        if (battle) {
            if (battle.timeLimit) {
                await this.initTimeLeftEmitter();
            }

            this.emitToSelf("turn-started", { battle: battle });
            await this.emitToOpponent("opponent-turn-started", { battle: battle });
        } else {
            this.emitErrorMessage();
        }
    }

    private async endTurn(gameOver?: boolean) {
        const battle = await this.battleService.endTurn(this.timeLeft);

        if (battle) {
            if (battle.timeLimit && this.emitTimeLeft) {
                await pubRedisClient.hset(this.key, this.userId + timeLeftSuffix, battle.playerStates.get(this.userId)!.getTimeLeft()!);
                clearInterval(this.emitTimeLeft);
            }

            if (!gameOver) {
                this.emitToSelf("turn-ended", null);
                await this.emitToOpponent("opponent-turn-ended", null);
            } else {
                //TODO
            }
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

        if (this.emitTimeLeft && this.timeLeft) {
            await pubRedisClient.hset(this.key, this.userId + timeLeftSuffix, this.timeLeft);
            clearInterval(this.emitTimeLeft);
        }

        await this.emitToOpponent("opponent-left", { message: "Your opponent has left the game" });
    }

    private async sendMessage(data: { message: string, emitter: string }) {
        await this.emitToOpponent("message", data);
    }

    //event emitting

    private emitToSelf(ev: string, data: any) {
        data = this.cleanBattleObj(data);

        this.nsp.to(this.userSocket).emit(ev, data);
    }

    private async emitToOpponent(ev: string, data: any) {
        const opponentSocketId = await pubRedisClient.hget(this.key, this.opponentId);
        data = this.cleanBattleObj(data, true);

        if (opponentSocketId) {
            this.nsp.to(opponentSocketId).emit(ev, data);
        }
    }

    private emitErrorMessage() {
        this.emitToSelf("error", { message: "Completing your previous action has failed" });
    }

    private cleanBattleObj(data: any, forSelf?: boolean) {
        if (data?.battle && data?.battle instanceof Battle) {
            (data.battle as Battle).clearRefs();
            (data.battle as Battle).hideOnHandCards(forSelf ? this.opponentId : this.userId);
            (data.battle as Battle).hideDrawingDeckCards();
        }

        return data;
    }

    private async initTimeLeft(battle: Battle) {
        if (battle.timeLimit) {
            const prevTimeLeftString = await pubRedisClient.hget(this.key, this.userId + timeLeftSuffix);

            if (prevTimeLeftString && !isNaN(parseInt(prevTimeLeftString))) {
                this.timeLeft = parseInt(prevTimeLeftString);
            }
            else {
                const timeLeft = battle.playerStates.get(this.userId)?.getTimeLeft();
                this.timeLeft = timeLeft ? timeLeft : battle.timeLimit;
            }
        }
    }

    private async initTimeLeftEmitter() {
        if (this.emitTimeLeft) {
            clearInterval(this.emitTimeLeft);
            this.timeLeft = undefined;
        }

        this.emitTimeLeft = setInterval(async () => {
            this.timeLeft = this.timeLeft! - 1000 > 0 ? this.timeLeft! - 1000 : 0;

            if (this.timeLeft <= 0 && this.emitTimeLeft) {
                clearInterval(this.emitTimeLeft);
                await this.endTurn(true);
            }

            await this.emitToSelf("time-left", { timeLeft: this.timeLeft });
            await this.emitToOpponent("opponent-time-left", { timeLeft: this.timeLeft });
        }, 1000);
    }
}

export default BattleController;