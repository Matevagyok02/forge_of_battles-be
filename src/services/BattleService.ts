import {MatchModel} from "../models/Match";

export class BattleService {

    async getOpponentId(userId: string, key: string) {
        try {
            const filter = {
                key: key,
                $or: [
                    { player1Id: userId },
                    { player2Id: userId }
                ]
            }
            let match = await MatchModel.findOne(filter, "player1Id player2Id").lean();

            if (match) {
                const player1Id = match.player1Id;
                if (match.getPlayer2Id()) {
                    const player2Id = match.getPlayer2Id();
                    return player1Id !== userId ? player1Id : player2Id;
                } else {
                    return null;
                }
            }
            else
                return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    async getBattleByKeyAndUser(userId: string, key: string) {
        try {
            const filter = {
                key: key,
                $or: [
                    { player1Id: userId },
                    { player2Id: userId }
                ]
            }
            const battle = await MatchModel.findOne(filter).exec();

            if (battle)
                return battle;
            else
                return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }


}