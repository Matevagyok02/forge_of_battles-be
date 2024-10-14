import {busyStatusIndicator, pubRedisClient} from "../redis";
import {io} from "../server";

class NotificationService {

    private getSocketIfAvailable = async (userId: string): Promise<string | null> => {
        const socketId = await pubRedisClient.get(userId);
        const isAvailable = typeof socketId === "string" && socketId !== busyStatusIndicator;
        return isAvailable ? socketId : null;
    }

    sendFriendRequest = async (receiverId: string, sender: any) => {
        const socket = await this.getSocketIfAvailable(receiverId);
        if (socket) {
            io.to(socket).emit("friend-request", sender);
        }
    }

    acceptedFriendRequest = async (receiverId: string, acceptor: any) => {
        const socket = await this.getSocketIfAvailable(receiverId);
        if (socket) {
            io.to(socket).emit("friend-request-accepted", acceptor);
        }
    }

    declinedFriendRequest = async (receiverId: string, decliner: any) => {
        const socket = await this.getSocketIfAvailable(receiverId);
        if (socket) {
            io.to(socket).emit("friend-request-declined", decliner);
        }
    }

    sendMatchInvite = async (receiverId: string, match: any) => {
        const socket = await this.getSocketIfAvailable(receiverId);
        if (socket) {
            io.to(socket).emit("match-invite", match);
        }
    }

    acceptedMatchInvite = async (receiverId: string, match: any) => {
        const socket = await this.getSocketIfAvailable(receiverId);
        if (socket) {
            io.to(socket).emit("match-invite-accepted", match);
        }
    }

    declinedMatchInvite = async (receiverId: string, match: any) => {
        const socket = await this.getSocketIfAvailable(receiverId);
        if (socket) {
            io.to(socket).emit("match-invite-declined", match);
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
}

export default NotificationService;