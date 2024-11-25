import {Match, MatchModel} from "../models/Match";
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

    async getActiveMatchesByUser(userId: string) {
        try {
            const filter = { $or: [
                    { player1Id: userId },
                    { player2Id: userId }
                ]}
            return await MatchModel.find(filter).exec();
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

    async join(userId: string, key: string) {
        try {
            const match = await MatchModel.findOne({key}, "player1Id player2Id").exec();

            if (match) {
                const player1Id = match.player1Id;
                const player2Id = match.getPlayer2Id();

                if (player2Id) {
                    if (player2Id === userId)
                        return player1Id;
                    else
                        return null;
                }
                else {
                    match.setPlayer2Id(userId);
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

    async abandonPendingMatch(userId: string, key: string)  {
        try {
            const deleteMatch = await MatchModel.deleteOne({
                    player1Id: userId,
                    key: key
                }
            ).lean();

            return deleteMatch.deletedCount > 0;
        } catch (e: any) {
            console.log(e);
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