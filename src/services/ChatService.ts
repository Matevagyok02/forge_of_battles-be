import {Chat, ChatModel, Message} from "../models/Chat";
import {UserService} from "./UserService";
import {isUpdateSuccessful} from "../utils";

const userService = new UserService();

export class ChatService {

    async insertMessage(senderId: string, receiverId: string, messageText: string): Promise<boolean> {
        try {
            if (await userService.areFriends(senderId, receiverId)) {
                const message = new Message(
                    senderId,
                    messageText
                );

                const insertValues = {
                    $push: { messages: message },
                    $setOnInsert: {
                        user1Id: senderId,
                        user2Id: receiverId
                    }
                }

                const update = await ChatModel.updateOne(
                    this.constructChatFilter(senderId, receiverId),
                    insertValues,
                    { upsert: true }
                ).lean();

                return isUpdateSuccessful(update);
            } else {
                return false;
            }
        } catch (error: any) {
            console.error(error);
            return false;
        }
    }

    async getMessages(user1Id: string, user2Id: string): Promise<Chat | null> {
        try {
            return await ChatModel.findOne(this.constructChatFilter(user1Id, user2Id)).lean();
        } catch (error: any) {
            console.error(error);
            return null;
        }
    }

    private constructChatFilter(user1Id: string, user2Id: string) {
        return { $or: [
                { user1Id: user1Id, user2Id: user2Id },
                { user1Id: user2Id, user2Id: user1Id }
            ] }
    }
}