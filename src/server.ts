import express from "express";
import http from "http";
import cors from "cors";
import "./Mongo";
import router from "./routes";
import { auth } from "express-oauth2-jwt-bearer";
import {Server} from "socket.io";
import {createAdapter} from "@socket.io/redis-adapter";
import {pubRedisClient, subRedisClient} from "./redis";
import BattleSocketController from "./controllers/BattleSocketController";
import {BattleService} from "./services/BattleService";

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

io.on("connection", (socket: any) => {
    const userId = socket.handshake.auth.userId;
    if (typeof userId !== "string")
        return;

    socket.on("register", async () => {
        await pubRedisClient.set(userId, socket.id);
    });

    socket.on("disconnect", async () => {
        await pubRedisClient.del(userId);
    });


    new BattleSocketController(io, new BattleService()).setUp();
});

export const sendChatMessage = async (senderId: string, receiverId: string, text: string, receiverSocketId: string) => {
    io.to(receiverSocketId).emit(
        "chat-message",
        {
            from: senderId,
            text: text
        }
    );
}

export {io}

server.listen(port, () => {
    console.log("The server is LIVE");
});
