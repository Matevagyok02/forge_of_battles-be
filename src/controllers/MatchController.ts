import {Request, Response} from "express";
import {getUserId, handleServerError} from "../middleware";
import {UserService} from "../services/UserService";
import {MatchService} from "../services/MatchService";
import {UserModel} from "../models/User";
import {isUpdateSuccessful} from "../utils";
import {busyStatusIndicator, pubRedisClient} from "../redis";
import NotificationService from "../services/NotificationService";

export class MatchController {

    private matchService: MatchService;
    private userService: UserService;
    private notificationService: NotificationService;

    constructor(matchService: MatchService, userService: UserService, notificationService: NotificationService) {
        this.userService = userService;
        this.matchService = matchService;
        this.notificationService = notificationService;
    }

    create = async(req: Request, res: Response)=> {
        try {
            const creatorId = getUserId(req);
            let invitedPlayerId = req.query.invite;
            const timeLimitRaw = req.query.timeLimit;
            let timeLimit;

            if (await this.matchService.isInGame(creatorId) || await this.hasPenalty(creatorId)) {
                res.status(409).json({ message: "You are either inside an ongoing match or you still have an active penalty" });
                return;
            }

            if (typeof invitedPlayerId === "string") {
                if (!await this.userService.areFriends(creatorId, invitedPlayerId)) {
                    res.status(409).json({ message: "The invited player is not on your friend list" });
                    return;
                }
                if (!await this.isAvailable(invitedPlayerId)) {
                    res.status(409).json({ message: "The invited player is not available" });
                    return;
                }
            } else {
                invitedPlayerId = undefined;
            }

            if (!isNaN(Number(timeLimitRaw)) && typeof timeLimitRaw === "string") {
                timeLimit = Math.abs(Number.parseInt(timeLimitRaw)) * 60 * 1000;
            } else {
                timeLimit = undefined;
            }

            const match = await this.matchService.create(creatorId, invitedPlayerId, timeLimit);

            if (match) {
                if (invitedPlayerId) {
                    await this.notificationService.sendMatchInvite(invitedPlayerId, match);
                }
                res.status(201).json(match);
            } else {
                res.status(500).json({ message: "Unexpected server error" })
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    getActiveMatches = async(req: Request, res: Response)=> {
        try {
            const userId = getUserId(req);
            const matches = await this.matchService.getActiveMatchesByUser(userId as string);

            if (matches && matches.length > 0)
                res.status(200).json(matches);
            else
                res.status(404).json({ message: "No active match was found" });
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    join = async(req: Request, res: Response)=> {
        try {
            const userId = getUserId(req);
            const key = req.query.key;

            if (typeof key === "string") {
                const hostPlayerId = await this.matchService.join(userId, key);

                if (hostPlayerId) {
                    await this.notificationService.acceptedMatchInvite(hostPlayerId, key);
                    res.status(200).json({ message: "You have successfully joined the game" });
                } else {
                    res.status(403).json({ message: "You cannot join this game" });
                }
            } else {
                res.status(400).json({ message: "'key' param is missing" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    decline = async(req: Request, res: Response) => {
        try {
            const key = req.query.key;

            const hostPlayerId = await this.matchService.getHost(key as string);

            if (hostPlayerId) {
                await this.matchService.delete(key as string);
                await this.notificationService.declinedMatchInvite(hostPlayerId, key as string);
                res.status(200).json({ message: "The invite was successfully declined" });
            } else {
                res.status(404).json({ message: "The invite, you are trying to decline was not found" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    private async setPenalty(userId: string) {
        try {
            const update = await UserModel.updateOne(
                {userId},
                {penaltyCreatedAt: new Date()}
            ).lean();

            return isUpdateSuccessful(update);
        } catch (error: any) {
            console.error(error);
            return false;
        }
    }

    private async hasPenalty(userId: string) {
        try {
            const user = await UserModel.findOne({userId}, "penaltyCreatedAt").lean();
            const timeout = require("../../game-rules.json").penaltyTimeout * 1000 * 60;

            if (user?.penaltyCreatedAt) {
                return user.penaltyCreatedAt.getTime() + timeout < Date.now();
            } else {
                return false;
            }
        } catch (error: any) {
            console.error(error);
            return true;
        }
    }

    private async isAvailable(userId: string): Promise<boolean> {
        const userValue = await pubRedisClient.get(userId);
        return !!userValue && userValue !== busyStatusIndicator;
    }
}