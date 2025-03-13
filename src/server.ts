import express from "express";
import http from "http";
import cors from "cors";
import router from "./routes";
import { auth } from "express-oauth2-jwt-bearer";
import {Server, Socket} from "socket.io";
import {createAdapter} from "@socket.io/redis-adapter";
import {pubRedisClient, subRedisClient} from "./redis";
import BattleController from "./controllers/BattleController";
import Mongo from "./Mongo";
import NotificationService from "./services/NotificationService";
import {FriendController} from "./controllers/FriendController";
import {FriendService} from "./services/FriendService";
import {RANDOM_MATCH_QUEUE_KEY} from "./services/MatchService";

const port = 3000;
const corsConfig = require("../cors-config.json");
const authConfig = require("../auth-config.json");

const app = express();
app.use(express.json());
app.use(cors(corsConfig));
app.use(auth(authConfig));
app.use("/", router);

const server = http.createServer(app);
const io = new Server(
    server,
    { cors: corsConfig }
);

io.adapter(createAdapter(pubRedisClient, subRedisClient));

io.on("connection", (socket: Socket) => {
    const userId = socket.handshake.auth.userId;
    if (typeof userId !== "string")
        return;

    socket.on("register", async () => {
        await pubRedisClient.set(userId, socket.id);
    });

    socket.on("disconnect", async () => {
        await pubRedisClient.del(userId);
        await pubRedisClient.srem(RANDOM_MATCH_QUEUE_KEY, userId);

        await new FriendController(
            new FriendService(),
            new NotificationService()
        ).notifyFriendsAtDisconnection(userId);
    });
});

io.of("/battle").on("connection", (socket: Socket) => {
    const battleSocket = new BattleController(io.of("/battle"), socket);
    battleSocket.init(socket);
});

export {io}

server.listen(port, () => {
    new Mongo();
    console.log("The server is LIVE");
});
