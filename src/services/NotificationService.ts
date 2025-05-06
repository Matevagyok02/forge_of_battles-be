import {busyStatusIndicator, pubRedisClient} from "../redis";
import {io} from "../server";
import {User} from "../models/User";

class NotificationService {

    private getSocketId = async (userId: string): Promise<string | null> => {
        const socketId = await pubRedisClient.get(userId);
        const isAvailable = typeof socketId === "string" && socketId !== busyStatusIndicator;
        return isAvailable ? socketId : null;
    }

    sendFriendRequest = async (receiverId: string, sender: object) => {
        const socket = await this.getSocketId(receiverId);
        if (socket) {
            io.to(socket).emit("friend-request", sender);
        }
    }

    acceptedFriendRequest = async (receiverId: string, acceptor: any) => {
        const socket = await this.getSocketId(receiverId);
        if (socket) {
            io.to(socket).emit("friend-request-accepted", acceptor);
        }
    }

    declinedFriendRequest = async (receiverId: string, decliner: any) => {
        const socket = await this.getSocketId(receiverId);
        if (socket) {
            io.to(socket).emit("friend-request-declined", decliner);
        }
    }

    sendMatchInvite = async (receiverId: string, match: any) => {
        const socket = await this.getSocketId(receiverId);
        if (socket) {
            io.to(socket).emit("match-invite", match);
        }
    }

    acceptedMatchInvite = async (receiverId: string, key: string) => {
        const socket = await this.getSocketId(receiverId);
        if (socket) {
            io.to(socket).emit("match-invite-accepted", key);
        }
    }

    declinedMatchInvite = async (receiverId: string, decliner: User) => {
        const socket = await this.getSocketId(receiverId);
        if (socket) {
            io.to(socket).emit("match-invite-declined", decliner);
        }
    }

    sendChatMessage = async (senderId: string, receiverId: string, text: string, receiverSocketId: string) => {
        io.to(receiverSocketId).emit(
            "chat-message",
            {
                from: senderId,
                text: text
            }
        );
    }

    notifyFriendsAtConnection = async (userId: string, friends: string[]) => {
        if (friends.length > 0) {
            const friendSockets = await pubRedisClient.mget(friends);

            friendSockets.forEach(socket => {
                if (socket) {
                    io.to(socket).emit("friend-connected", { userId: userId});
                }
            });
        }
    }

    notifyFriendsAtDisconnection = async (userId: string, friends: string[]) => {
        const friendSockets = await pubRedisClient.mget(friends);

        friendSockets.forEach(socket => {
            if (socket) {
                io.to(socket).emit("friend-disconnected", { userId: userId});
            }
        })
    }

    notifyPlayersInQueue = async (users: string[], matchKey: string) => {
        const sockets = await pubRedisClient.mget(users);
        sockets.forEach(socket => {
            if (socket) {
                io.to(socket).emit("random-match-found", matchKey);
            }
        });
    }
}

export default NotificationService;