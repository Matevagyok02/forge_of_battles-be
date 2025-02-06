import {Match, MatchModel, MatchStage} from "../models/Match";
import {generateKey} from "../utils";
import {pubRedisClient} from "../redis";

export class MatchService {

    async isInGame(userId: string): Promise<boolean> {
        try {
            const filter = {$or: [
                    { player1Id: userId},
                    { player2Id: userId}
                ]};

            return await MatchModel.countDocuments(filter).lean() > 0;
        } catch (e: any) {
            console.error(e);
            return false;
        }
    }

    async getActiveMatchByUser(userId: string) {
        try {
            const filter = {
                player2Id: userId,
                $or: [
                    {stage: MatchStage.preparing},
                    {stage: MatchStage.started}
                ]
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

    async hasUnfinishedMatch(userId: string) {
        try {
            const filter = {
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

    async leave(userId: string) {
        try {
            const filter = {
                player2Id: userId,
                $or: [{ stage: MatchStage.preparing }, { stage: MatchStage.started }]
            }

            const deleteMatch = await MatchModel.deleteOne(filter).lean();
            return deleteMatch.deletedCount > 0;
        } catch (e: any) {
            console.log(e);
            return false;
        }
    }

    async delete(key: string) {
        try {
            await MatchModel.deleteOne({key}).lean();
        } catch (e: any) {
            console.log(e);
        }
    }

    async getLastCreatedMatch(userId: string) {
        try {
            return await MatchModel.findOne({player1Id: userId}).sort({createdAt: -1}).exec();
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
                    match.getMatchStage() === MatchStage.pending ||
                    match.getPlayer2Id() === "" ||
                    (
                        ((match.getMatchStage() === MatchStage.preparing && match.battle.playerStates.has(userId)) ||
                            (match.getMatchStage() === MatchStage.started && !match.battle.isTurnOfPlayer(userId)))
                        &&
                        Date.now() - match.updatedAt.getTime() > inactivityTimeReq
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