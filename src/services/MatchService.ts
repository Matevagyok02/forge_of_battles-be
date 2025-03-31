import {Match, MatchModel, MatchStage} from "../models/Match";
import {generateKey} from "../utils";
import {pubRedisClient} from "../redis";

export const RANDOM_MATCH_QUEUE_KEY = "RANDOM_MATCH_QUEUE";
const REDIS_LOCK_KEY = "LOCK";
const RANDOM_MATCH_TIME_LIMIT = 900000;

export class MatchService {

    async isInGame(userId: string): Promise<boolean> {
        try {
            const matchStageOptions = {
                $nin: [MatchStage.finished, MatchStage.abandoned]
            }

            const filter = {
                $or: [{
                    player1Id: userId,
                    stage: matchStageOptions
                }, {
                    player2Id: userId,
                    stage: matchStageOptions
                }]
            };

            return await MatchModel.countDocuments(filter).lean() > 0;
        } catch (e: any) {
            console.error(e);
            return false;
        }
    }

    async getActiveMatchByUser(userId: string) {
        try {
            const matchStageOptions = [
                { stage: MatchStage.preparing },
                { stage: MatchStage.started }
            ]
            const filter = {
                $or: [{
                    player2Id: userId,
                    $or: matchStageOptions
                }, {
                    player1Id: userId,
                    $or: matchStageOptions
                }]
            }

            return await MatchModel.findOne(filter).sort({ createdAt: -1 }).exec()
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    async getByKey(key: string) {
        try {
            return await MatchModel.findOne({key}).exec();
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    async create(player1Id: string, player2Id?: string, timeLimit?: number) {
        await this.leaveQueue(player1Id);

        try {
            const key = await this.getKey();
            const match = new Match(key, false, player1Id, player2Id, timeLimit);
            await MatchModel.create(match);
            return match;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    async createRandomMatch(player1Id: string, player2Id: string) {
        try {
            const key = await this.getKey();
            const match = new Match(key, true, player1Id, player2Id, RANDOM_MATCH_TIME_LIMIT);
            await MatchModel.create(match);
            return match;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    async hasUnfinishedMatch(userId: string, key: string) {
        try {
            const filter = {
                key: { $ne: key },
                player2Id: userId,
                $or: [{ stage: MatchStage.preparing }, { stage: MatchStage.started }]
            }
            const unfinishedMatch = await MatchModel.exists(filter).exec();
            return !!unfinishedMatch;
        } catch (e: any) {
            console.log(e);
            return false;
        }
    }

    async join(userId: string, key: string) {
        await this.leaveQueue(userId);

        try {
            const match = await MatchModel.findOne({key}).exec();

            if (match) {
                const player1Id = match.player1Id;
                const player2Id = match.getPlayer2Id();

                if (player1Id === userId) {
                    if (player2Id) {
                        match.setStage(MatchStage.preparing);
                        await match.save();
                    }
                    return player1Id;
                }

                if (player2Id) {
                    if (player2Id === userId) {
                        match.setStage(MatchStage.preparing);
                        await match.save();
                        return player1Id;
                    }
                    else
                        return null;
                }
                else {
                    match.setPlayer2Id(userId);
                    match.setStage(MatchStage.preparing);
                    await match.save();
                    return player1Id;
                }
            } else
                return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    async joinQueue(userId: string): Promise<{ joined: boolean, match?: { key: string, opponentId: string } }> {
        const acquireLock = await pubRedisClient.setnx(REDIS_LOCK_KEY, 1);

        if (acquireLock) {
            try {
                const queue = await pubRedisClient.smembers(RANDOM_MATCH_QUEUE_KEY);

                if (queue.length > 0) {
                    const opponentId = queue[0];
                    await pubRedisClient.srem(RANDOM_MATCH_QUEUE_KEY, opponentId);

                    const match = await this.createRandomMatch(opponentId, userId);

                    if (match && opponentId) {
                        return { joined: true, match: { key: match.key, opponentId } };
                    } else {
                        return { joined: false };
                    }
                } else {
                    await pubRedisClient.sadd(RANDOM_MATCH_QUEUE_KEY, userId);
                    return { joined: true };
                }
            } catch (e: any) {
                console.log(e);
                return { joined: false };
            } finally {
                await pubRedisClient.del(REDIS_LOCK_KEY);
            }
        } else {
            return { joined: false };
        }
    }

    async leaveQueue(userId: string) {
        try {
            await pubRedisClient.srem(RANDOM_MATCH_QUEUE_KEY, userId);
            return true;
        } catch (e: any) {
            console.log(e);
            return false;
        }
    }

    async isInQueue(userId: string) {
        try {
            return await pubRedisClient.sismember(RANDOM_MATCH_QUEUE_KEY, userId);
        } catch (e: any) {
            console.log(e);
            return false;
        }
    }

    async leave(userId: string) {
        try {
            const matchStageOptions = [
                { stage: MatchStage.preparing },
                { stage: MatchStage.started },
                { stage: MatchStage.abandoned }
            ]
            const filter = {
                $or: [{
                    player2Id: userId,
                    $or: matchStageOptions
                }, {
                    player1Id: userId,
                    randomMatch: true,
                    $or: matchStageOptions
                }]
            }

            const match = await MatchModel.findOne(filter).exec();

            if (match) {
                if (match.getMatchStage() === MatchStage.abandoned) {
                    await this.delete(match.key);
                    return true;
                } else {
                    match.setStage(MatchStage.abandoned);
                    await match.save();
                    return true;
                }
            } else {
                return false;
            }
        } catch (e: any) {
            console.log(e);
            return false;
        }
    }

    async delete(key: string) {
        try {
            await  pubRedisClient.del(key);
            return await MatchModel.deleteOne({key}).lean();
        } catch (e: any) {
            console.log(e);
        }
    }

    async getLastCreatedMatch(userId: string) {
        try {
            return await MatchModel.findOne({
                player1Id: userId,
                stage: { $ne: MatchStage.finished },
                randomMatch: false
            }).sort({createdAt: -1}).exec();
        } catch (e: any) {
            console.log(e);
        }
    }

    async abandon(userId: string, key: string) {
        const inactivityTimeReq = require("../../game-rules.json").abandonInactivityTime;
        const filter = {
            player1Id: userId,
            key: key
        };

        try {
            const match = await MatchModel.findOne(filter).exec();

            if (
                match &&
                (
                    (
                        match.getMatchStage() === MatchStage.pending ||
                        match.getPlayer2Id() === ""
                    )
                     ||
                    (
                        ((match.getMatchStage() === MatchStage.preparing && match.battle.playerStates.has(userId)) ||
                            (match.getMatchStage() === MatchStage.started && !match.battle.isTurnOfPlayer(userId)))
                        &&
                        Date.now() - match.updatedAt.getTime() > inactivityTimeReq
                    ) || (
                        match.getMatchStage() === MatchStage.abandoned ||
                        !await pubRedisClient.hget(key, match.getPlayer2Id())
                    )
                )
            ) {
                const deleteMatch = await MatchModel.deleteOne(filter).lean();
                return deleteMatch.deletedCount > 0 ? 0 : 2;
            } else {
                return 1;
            }
        } catch (e: any) {
            console.log(e);
            return 2;
        }
    }

    async getHost(key: string) {
        try {
            const match = await MatchModel.findOne({key}, "player1Id").lean()
            return match?.player1Id;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    private async getKey() {
        let key = generateKey();

        while (await pubRedisClient.exists(key) || await MatchModel.exists({key})) {
            key = generateKey();
        }
        return key;
    }
}