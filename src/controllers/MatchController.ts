import {Request, Response} from "express";
import {getUserId, handleServerError} from "../middleware";
import {UserService} from "../services/UserService";
import {MatchService} from "../services/MatchService";
import {UserModel} from "../models/User";
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
                match.battle.clearRefs();

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

    abandon = async(req: Request, res: Response) => {
        try {
            const userId = getUserId(req);
            const key = req.query.key;

            if (typeof key === "string") {
                const abandon = await this.matchService.abandon(userId as string, key);

                if (abandon === 0) {
                    res.status(200).json({ message: "The match was successfully abandoned" });
                }
                else if (abandon === 1) {
                    res.status(403).json({ message: "You cannot abandon this match" });
                } else {
                    res.status(204).json({ message: "The match does not exists or has already been deleted" });
                }
            } else {
                res.status(400).json({ message: "'key' param is missing" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    isAbandoned = async(req: Request, res: Response) => {
        try {
            const key = req.query.key;

            if (typeof key === "string") {
                const isAbandoned = await this.matchService.isAbandoned(key);
                res.status(200).json({ isAbandoned });
            } else {
                res.status(400).json({ message: "'key' param is missing" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    getMatches = async (req: Request, res: Response)=> {
        try {
            const userId = getUserId(req);
            const lastCreateMatch = await this.matchService.getLastCreatedMatch(userId);
            const activeMatch = await this.matchService.getActiveMatchByUser(userId);
            const inQueue = await this.matchService.isInQueue(userId);

            res.json({
               created: lastCreateMatch,
               active: activeMatch,
               inQueue: inQueue,
            });
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    getByKey = async (req: Request, res: Response)=> {
        try {
            const match = await this.matchService.getByKey(req.query.key as string);

            if (match) {
                match.battle.clearRefs();
                res.status(200).json(match);
            } else {
                res.status(404).json({message: "The match was not found"});
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    join = async (req: Request, res: Response)=> {
        try {
            const userId = getUserId(req);
            const key = req.query.key;

                if (typeof key === "string") {
                    const hasUnfinishedMatch = await this.matchService.hasUnfinishedMatch(userId, key);

                    if (hasUnfinishedMatch) {
                        res.status(409).json({ message: "You are already in a match" });
                    } else {
                        const hostPlayerId = await this.matchService.join(userId, key);

                        if (hostPlayerId) {
                            if (hostPlayerId !== userId) {
                                await this.notificationService.acceptedMatchInvite(hostPlayerId, key);
                            }
                            res.status(200).json({ message: "You have successfully joined the game" });
                        } else {
                            res.status(403).json({ message: "You cannot join this game" });
                        }
                    }
                } else {
                    res.status(400).json({ message: "'key' param is missing" });
                }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    leave = async (req: Request, res: Response) => {
        try {
            const userId = getUserId(req);
            const leaveMatch = await this.matchService.leave(userId);

            if (leaveMatch) {
                res.status(200).json({ message: "You have successfully left the match" });
            } else {
                res.status(403).json({ message: "You are not in a match" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    joinRandom = async (req: Request, res: Response)=> {
        try {
            const userId = getUserId(req);

            if (!await this.matchService.isInGame(userId)) {
                const join = await this.matchService.joinQueue(userId);

                if (join.joined) {
                    res.status(201).json({ message: "You have successfully joined the queue" });

                    if (join.match) {
                        await this.notificationService.notifyPlayersInQueue(
                            [userId, join.match.opponentId],
                            join.match.key
                        );
                    }
                } else {
                    res.status(202).json({ message: "The server is busy, try again later" });
                }
            } else {
                res.status(409).json({ message: "You are already in a match" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    leaveRandom = async (req: Request, res: Response) => {
        try {
            const userId = getUserId(req);
            const leaveQueue = await this.matchService.leaveQueue(userId);

            if (leaveQueue) {
                res.status(200).json({ message: "You have successfully left the queue" });
            } else {
                res.status(403).json({ message: "You are not in the queue" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    decline = async (req: Request, res: Response) => {
        try {
            const key = req.query.key;
            const userId = getUserId(req);

            const user = await this.userService.getUserByUserId(userId);
            const hostPlayerId = await this.matchService.getHost(key as string);

            if (hostPlayerId && user) {
                await this.matchService.delete(key as string);
                await this.notificationService.declinedMatchInvite(hostPlayerId, user);
                res.status(200).json({ message: "The invite was successfully declined" });
            } else {
                res.status(404).json({ message: "The invite, you are trying to decline was not found" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    private async hasPenalty(userId: string) {
        try {
            const user = await UserModel.findOne({userId}, "penaltyCreatedAt").lean();
            const timeout = require("../../game-rules.json").penaltyTimeout;

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