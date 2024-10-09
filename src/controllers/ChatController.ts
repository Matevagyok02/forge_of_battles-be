import {ChatService} from "../services/ChatService";
import {Request, Response} from "express";
import {getUserId, handleServerError} from "../middleware";
import {busyStatusIndicator, pubRedisClient} from "../redis";
import {sendChatMessage} from "../server";

interface OutgoingMessage {
    to: string;
    text: string;
}

export class ChatController {

    private chatService: ChatService;

    constructor(chatService: ChatService) {
        this.chatService = chatService;
    }

    send = async (req: Request, res: Response) =>{
        try {
            const senderId = getUserId(req);
            const message: OutgoingMessage = await req.body;

            if (message) {
                const receiverSocketId = await pubRedisClient.get(message.to);
                const isReceiverAvailable =
                    typeof receiverSocketId === "string"
                    && receiverSocketId !== busyStatusIndicator;

                const save = await this.chatService.insertMessage(
                    senderId,
                    message.to,
                    message.text,
                    isReceiverAvailable
                );

                if (save) {
                    res.status(200).json({ message: "The message was successfully sent" });
                    if (isReceiverAvailable) {
                        await sendChatMessage(message.to, senderId, message.text, receiverSocketId);
                    }
                } else {
                    res.status(409).json({ message: "Messages can only be sent to friends" });
                }
            } else {
                res.status(400).json({ message: "The message was malformed, hence could not be delivered" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    get = async (req: Request, res: Response)=> {
        try {
            const userId = getUserId(req);
            const fromId = req.query.from;

            if (typeof fromId === "string") {
                const chat = await this.chatService.getMessages(userId, fromId);

                if (chat && chat.messages.length > 0) {
                    res.json({ messages: chat.messages });
                } else {
                    res.status(204).json({ message: "No messages were sent to/sent by this user" });
                }
            } else {
                res.status(400).json({ message: "'from' parameter is missing" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    getUnseenMessages = async (req: Request, res: Response)=> {
        try {
            const userId = getUserId(req);
            const unseenMessages = await this.chatService.getUnseenMessages(userId);

            console.log(unseenMessages);

            if (unseenMessages && unseenMessages.length > 0)
                res.status(200).json(unseenMessages);
            else
                res.status(204).json({ message: "You do not have any unseen messages" });
        } catch (e: any) {
            handleServerError(e, res);
        }
    }
}