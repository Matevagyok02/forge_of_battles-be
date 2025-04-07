import {Chat, ChatModel, ChatUser, Message} from "../models/Chat";
import {UserService} from "./UserService";
import {isUpdateSuccessful} from "../utils";

const userService = new UserService();

export class ChatService {

    async insertMessage(senderId: string, receiverId: string, messageText: string, activeReceiver: boolean): Promise<boolean> {
        try {
            if (await userService.areFriends(senderId, receiverId)) {
                const message = new Message(
                    senderId,
                    messageText
                );

                const filter = this.constructChatFilter(senderId, receiverId);

                const update = await ChatModel.updateOne(
                    filter,
                    {
                        $push: { messages: message }, // Add the new message to the messages array
                        $set: {
                            'users.$[sender].lastSeenAt': new Date(), // Update lastSeenAt for sender
                            ...(activeReceiver ? { 'users.$[receiver].lastSeenAt': new Date() } : {}), // Conditionally update lastSeenAt for receiver
                        },
                    },
                    {
                        arrayFilters: [
                            { 'sender.userId': senderId }, // Match the sender in the users array
                            { 'receiver.userId': receiverId } // Match the receiver in the users array
                        ]
                    }
                ).lean();

                if (isUpdateSuccessful(update)) {
                    return true;
                } else {
                    const insertUpdate = await ChatModel.updateOne(
                        filter,
                        {
                            $push: { messages: message },
                            $setOnInsert: {
                                users: [ new ChatUser(senderId, true), new ChatUser(receiverId, activeReceiver) ]
                            },
                        },
                        { upsert: true }
                    ).lean();

                    return isUpdateSuccessful(insertUpdate);
                }
            } else {
                return false;
            }
        } catch (error: any) {
            console.error(error);
            return false;
        }
    }

    async getMessages(userId: string, fromId: string): Promise<Message[]> {
        try {
            const chat = await ChatModel.findOneAndUpdate(
                this.constructChatFilter(userId, fromId),
                {
                    $set: {
                        'users.$[user1].lastSeenAt': new Date()
                    }
                },
                {
                    arrayFilters: [{ 'user1.userId': userId }],
                    returnDocument: 'after'
                }
            ).lean().exec();

            if (chat) {
                return chat.messages;
            } else {
                return [];
            }
        } catch (error: any) {
            console.error(error);
            return [];
        }
    }

    async getUnseenMessages(userId: string) {
        try {
            const unseenMessages = await ChatModel.aggregate([
                {
                    $match: {
                        'users.userId': userId // Match documents with the specified userId
                    }
                },
                {
                    $unwind: '$messages' // Unwind messages to process them individually
                },
                {
                    $sort: { 'messages.createdAt': -1 } // Sort messages by createdAt descending
                },
                {
                    $group: {
                        _id: '$_id', // Group by document ID
                        latestMessage: { $first: '$messages' }, // Get the latest message
                        users: { $first: '$users' } // Get the users array
                    }
                },
                {
                    $match: {
                        $expr: {
                            $gt: ['$latestMessage.createdAt', { $ifNull: [{ $arrayElemAt: ['$users.lastSeenAt', { $indexOfArray: ['$users.userId', userId] }] }, new Date(0) ] }] }
                    }
                },
                {
                    $project: {
                        otherUserId: {
                            $filter: {
                                input: '$users',
                                as: 'user',
                                cond: { $ne: ['$$user.userId', userId] } // Filter out the current userId
                            }
                        },
                        _id: 0, // Exclude _id from the result if not needed
                    }
                }
            ]).exec();

            return unseenMessages.flat(1)
                .map((message: any) => ({
                    userId: message.otherUserId[0].userId,
                    lastSeenAt: message.otherUserId[0].lastSeenAt,
                }));
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    private constructChatFilter(user1Id: string, user2Id: string) {
        return {
            users: {
                $all: [
                    { $elemMatch: { userId: user1Id } },
                    { $elemMatch: { userId: user2Id } }
                ]
            }
        }
    }
}