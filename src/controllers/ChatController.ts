import {ChatService} from "../services/ChatService";
import {Request, Response} from "express";
import {getUserId, handleServerError} from "../utils";
import {chatMessage} from "../notifications";

const chatService = new ChatService();

interface Message {
    to: string;
    text: string;
}

export class ChatController {

    async sendMessage(req: Request, res: Response){
        try {
            const senderId = getUserId(req);
            const message: Message = await req.body;

            if (senderId && message) {
                const save = await chatService.insertMessage(senderId, message.to, message.text);
                if (save) {
                    await chatMessage(message.to, senderId, message.text);
                    res.status(200).json({ message: "The message was successfully sent" });
                } else {
                    res.status(409).json({ message: "Messages can only be sent to friends" });
                }
            } else {
                res.status(400).json({ message: "The message was malformed, hence could not be delivered" });
            }
        } catch (error: any) {
            handleServerError(error, res);
        }
    }

    async getMessages(req: Request, res: Response) {
        try {
            const userId = getUserId(req);
            const fromId = req.query.from;

            if (userId && typeof fromId === "string") {
                const chat = await chatService.getMessages(userId, fromId);

                if (chat && chat.messages.length > 0) {
                    res.json({ messages: chat.messages });
                } else {
                    res.status(204).json({ message: "No messages were sent to/sent by this user" });
                }

            } else {
                res.status(400).json({ message: "Required request params are missing" });
            }
        } catch (error: any) {
            handleServerError(error, res);
        }
    }
}