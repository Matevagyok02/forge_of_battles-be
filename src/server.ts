import express from "express";
import http from "http";
import cors from "cors";
import "./mongo";
import "./redis";
import router from "./routes";
import { auth } from "express-oauth2-jwt-bearer";
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import {pubRedisClient, subRedisClient} from "./redis";

const port = 3000;
const corsConfig = require("../cors.config.json");
const authConfig = require("../auth.config.json");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: corsConfig});

io.adapter(createAdapter(pubRedisClient, subRedisClient));

// Handle Socket.IO connections
io.on('connection', (socket: any) =>{
    const userId = socket.handshake.auth.userId;

    socket.on('register', async () => {
        await pubRedisClient.set(userId, socket.id);
        console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    socket.on('disconnect', async () => {
        await pubRedisClient.del(userId); // Delete the user ID key
        console.log(`User ${userId} disconnected`);
    });
});

app.use(express.json());
app.use(cors(corsConfig));
app.use(auth(authConfig));
app.use('/', router);

server.listen(port, () => {
    console.log(`The server is LIVE`);
})

export const friendReqNotification = async (receiverId: string, senderId: string, type: notificationType) => {
    const receiverSocketId: any = await pubRedisClient.get(receiverId);
    if (receiverSocketId) {
        io.to(receiverSocketId).emit('receive-friend-request', {
            sender: senderId,
            type: type
        });
    }
}

export const getActiveFriends = async (friendIds: any): Promise<string[]> => {
    const activeFriends: string[] = [];
    const activeValues = await pubRedisClient.mget(friendIds);
    friendIds.forEach((friend: string, index: number) => {
        if (activeValues[index]) {
            activeFriends.push(friend);
        }
    })
    return activeFriends;
}

export enum notificationType { received = "RECEIVED", accepted = "ACCEPTED", declined = "DECLINED"}