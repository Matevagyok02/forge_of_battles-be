import {MatchModel} from "../models/Match";
import {Card, CardModel, Deck} from "../models/Card";
import {Battle, Pos} from "../models/Battle";

export class BattleService {

    private readonly playerId: string;
    private readonly key: string;
    private readonly filter;

    constructor(playerId: string, key: string) {
        this.playerId = playerId;
        this.key = key;
        this.filter = {
            key: this.key,
            $or: [
                { player1Id: this.playerId },
                { player2Id: this.playerId }
            ]
        }
    }

    setPlayer = async (deck: Deck): Promise<{ battle: Battle | null, arePlayersReady: boolean } | null> => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match) {
                match.battle.initPlayerState(this.playerId, deck, match.timeLimit);
                await match.save();
                if (match.battle.hasStarted()) {
                    return {battle: match.battle, arePlayersReady: true};
                }
                else
                    return { battle: null, arePlayersReady: false };
            } else {
                return null;
            }
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    startTurn = async () => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && match.battle.startTurn(this.playerId)) {
                await match.save();
                return match.battle;
            } else {
                return null;
            }
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    endTurn = async () => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && match.battle.endTurn(this.playerId)) {
                match.battle.removeTurnBasedAttributeModifiers(this.playerId);
                await match.save();
                return match.battle;
            } else {
                return null;
            }
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    addStormerToMana = async () => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match) {
                const addToMana = match.battle.addToMana(this.playerId);

                if (addToMana) {
                    await match.save();
                    return match.battle;
                }
            }
            return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    deployCard = async (cardId: string, sacrificeCards?: string[], position?: string) => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match) {
                const card = await this.getCardById(cardId);

                if (card && (!position || (<any>Object).values(Pos).includes(position))) {
                    const deploy = match.battle.deployCard(
                        this.playerId,
                        { card: card, sacrificeCards: sacrificeCards, position: Pos[position as keyof typeof Pos] }
                    );

                    if (deploy) {
                        await match.save();
                        return match.battle;
                    }
                }
            }
            return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    getBattle = async () => {
        try {
            const match = await MatchModel.findOne(this.filter).lean();

            if (match && match.battle) {
                return match.battle;
            } else {
                return null;
            }
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    drawCards = async () => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && match.battle) {
                const drawnCards = match.battle.player(this.playerId)?.drawCards(2);
                await match.save();
                return drawnCards;
            }
            return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    redrawCards = async (cardId?: string) => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && match.battle) {
                const drawnCards = match.battle.player(this.playerId)?.redrawCards(cardId);
                await match.save();
                return drawnCards;
            }
            return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    activatePassiveEffect = async (position: string, sacrificeCards?: string[], target?: string) => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match) {
                const activate = match.battle.activatePassiveEffect(
                    this.playerId,
                    Pos[position as keyof typeof Pos],
                    sacrificeCards,
                    Pos[target as keyof typeof Pos]
                );

                if (activate) {
                    await match.save();
                    return match.battle;
                }
            }
            return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    moveToFrontLine = async () => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match) {
                const move = match.battle.player(this.playerId)?.moveToFrontLine();

                if (move) {
                    await match.save();
                    return match.battle;
                }
            }
            return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    private getCardById = async (id: string): Promise<Card | null> => {
        try {
            const card = await CardModel.findOne({id: id}).exec();
            if (card)
                return card;
            else
                return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    private getCardsById = async (idList: string[]):Promise<Card[] | null> => {
        try {
            const cards = await CardModel.find({ id: { $in: idList } }).exec();
            if (cards)
                return cards;
            else
                return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    static getOpponentId = async (userId: string, key: string)=> {
        try {
            const filter = {
                key: key,
                $or: [
                    { player1Id: userId },
                    { player2Id: userId }
                ]
            };
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
}