import {Request, Response} from "express";
import {getUserId, handleServerError} from "../middleware";
import {FriendService} from "../services/FriendService";
import NotificationService from "../services/NotificationService";
import notificationService from "../services/NotificationService";

export class FriendController {

    private friendService: FriendService;
    private notificationService: NotificationService;

    constructor(friendService: FriendService, notificationService: NotificationService) {
        this.friendService = friendService;
        this.notificationService = notificationService;
    }

    getOnlineFriends = async (req: Request, res: Response)=> {
        try {
            const userId = getUserId(req);
            const onlineFriends = await this.friendService.getOnlineFriends(userId);

            if (onlineFriends && onlineFriends.length > 0) {

                let notBusyFriends: string[] = [];
                onlineFriends.forEach(friend => {
                   if (!friend.busy) {
                       notBusyFriends.push(friend.userId);
                   }
                });
                await this.notificationService.notifyFriendsAtConnection(userId, notBusyFriends);
                res.status(200).json({ onlineFriends: onlineFriends });
            } else {
                res.status(204).json({ message: "No online friends were found" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    sendFriendRequest = async(req: Request, res: Response)=> {
        try {
            const toId = req.query.to;
            const fromId = getUserId(req);

            if (typeof toId === "string") {
                if (toId === fromId) {
                    res.status(409).json({message: "You cannot send an invite to yourself :( "});
                } else {
                    const requestSender = await this.friendService.sendFriendRequest(fromId, toId);

                    if (requestSender) {
                        res.status(201).json({message: "The invite was successfully sent" });
                        await this.notificationService.sendFriendRequest(toId, requestSender);
                    } else
                        res.status(409).json({message: "The user you want to invite is already your friend or an invite has been issued between you" });
                }
            } else
                res.status(400).json({ message: "'to' param is missing"});
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    acceptFriendRequest = async(req: Request, res: Response) => {
        try {
            const toId = getUserId(req);
            const fromId = req.query.from;

            if (typeof fromId === "string") {
                const acceptor = await this.friendService.acceptFriendRequest(fromId, toId);

                if (acceptor) {
                    res.status(200).json({ message: "The request was successfully accepted" });
                    await this.notificationService.acceptedFriendRequest(fromId, acceptor);
                } else
                    res.status(409).json({ message: "There is no request issued by this user" });
            } else
                res.status(400).json({message: "'from' param is missing"});
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    declineFriendRequest = async(req: Request, res: Response) => {
        try {
            const toId = getUserId(req);
            const fromId = req.query.from;

            if (typeof fromId === "string") {
                const decliner = await this.friendService.declineFriendRequest(fromId, toId);

                if (decliner) {
                    res.status(200).json({ message: "The request was successfully declined" });
                    await this.notificationService.declinedFriendRequest(fromId, decliner);
                } else
                    res.status(404).json({ message: "There is no request issued by this user" });
            } else {
                res.status(400).json({message: "'from' param is missing" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }
}