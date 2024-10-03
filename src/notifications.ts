import {pubRedisClient} from "./redis";
import {io} from "./server";

export const friendRequest = async (receiverId: string, senderId: string, type: NotificationType) => {
    const receiverSocketId: any = await pubRedisClient.get(receiverId);
    if (receiverSocketId) {
        io.to(receiverSocketId).emit('friend-request', {
            sender: senderId,
            type: type
        });
    }
}

export const chatMessage = async (receiverId: string, senderId: string, message: string) => {
    const receiverSocketId: any = await pubRedisClient.get(receiverId);
    if (receiverSocketId) {
        io.to(receiverSocketId).emit('chat-message', {
            sender: senderId,
            message: message
        });
    }
}

export const getActiveFriends = async (friendIds: any): Promise<OnlineFriend[]> => {
    const activeFriends: OnlineFriend[] = [];
    const activeValues = await pubRedisClient.mget(friendIds);
    friendIds.forEach((friend: string, index: number) => {
        if (activeValues[index] !== undefined) {
            const busy = activeValues[index] === ".";
            activeFriends.push({userId: friend, busy: busy});
        }
    })
    return activeFriends;
}

interface OnlineFriend {
    userId: string;
    busy: boolean;
}

export enum NotificationType {
    Received = "RECEIVED",
    Accepted = "ACCEPTED",
    Declined = "DECLINED",
}