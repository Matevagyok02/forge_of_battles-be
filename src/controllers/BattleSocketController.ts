import {BattleService} from "../services/BattleService";
import {Server, Namespace, Socket} from "socket.io";
import {busyStatusIndicator, pubRedisClient} from "../redis";

class BattleSocketController {

    readonly nsp: Namespace;
    private battleService: BattleService;
    private key!: string;
    private userId!: string;
    private userSocket!: string;
    private opponentId!: string;

    constructor(io: Server, battleService: BattleService) {
        this.battleService = battleService;
        this.nsp = io.of("/battle");
    }

    private async joinMatchRoom(socketId: string) {
        await pubRedisClient.set(this.userId, busyStatusIndicator);
        await pubRedisClient.hset(this.key, { [this.userId]: socketId });
    }

    private async leaveMatchRoom() {
        await pubRedisClient.hdel(this.key, this.userId);
        await pubRedisClient.del(this.userId);
    }

    private async emitToOpponent(ev: string, data: any) {
        const opponentSocketId = await pubRedisClient.hget(this.key, this.opponentId);
        if (opponentSocketId) {
            this.nsp.to(opponentSocketId).emit(ev, data);
        }
    }

    private emitToSelf(ev: string, data: any) {
        this.nsp.to(this.userSocket).emit(ev, data);
    }

    setUp = () => {
        const nsp: Namespace = this.nsp;

        nsp.on("connection", async (socket: Socket) => {
            const userId = socket.handshake.auth.userId;
            const key = socket.handshake.query.key as string;
            const opponentId = "x" //await battleService.getOpponentId(userId, key);

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

                socket.on("join", async () => {
                    await this.joinMatchRoom(socket.id)
                });

                socket.on("disconnect", async () => {
                    await this.leaveMatchRoom();
                });

                socket.on("deck-select", async (data) => {
                    await this.emitToOpponent("deck-select", data);
                });

                socket.on("ready", async (data) => {

                });
            }
        });
    }
}

export default BattleSocketController;