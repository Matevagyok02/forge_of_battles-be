import {Match, MatchModel} from "../models/Match";
import {Card, CardModel, Deck} from "../models/Card";
import {Pos} from "../models/PlayerState";
import {RequirementArgs} from "../models/Abilities";

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

    setPlayer = async (deck: Deck): Promise<boolean | null> => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match) {
                match.battle.initPlayerState(this.playerId, deck);
                await match.save();

                return match.battle.hasStarted();
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

            if (match && this.isPlayerOnTurn(match)) {
                const player = match.battle.player(this.playerId);

                if (player) {
                    const addToMana = player.addToMana();

                    if (addToMana) {
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

    deploy = async (cardId: string, useAsMana?: string[]) => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && this.isPlayerOnTurn(match)) {
                const card = await BattleService.getCardById(cardId);

                if (card) {
                    const player = match.battle.player(this.playerId);
                    if (player) {
                        const deploy = player.deploy(card, useAsMana);

                        if (deploy) {
                            await match.save();
                            return match.battle;
                        }
                    }
                }
            }
            return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    discard = async (cardToDiscard: string[] | string)=> {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match) {
                const discard = await match.battle.player(this.playerId)?.discard(
                        Array.isArray(cardToDiscard) ? cardToDiscard : Pos[cardToDiscard as keyof typeof Pos]
                    );
                if (discard) {
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

    storm = async (posToAttack?: string | Pos, rawArgs?: RawRequirementArgs) => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();
            const args = this.formatRequirementArgs(rawArgs);

            if (match && this.isPlayerOnTurn(match)) {
                const player = match.battle.player(this.playerId);
                if (player) {
                    let storm;

                    const position = Pos[posToAttack as keyof typeof Pos];
                    if (position === Pos.frontLiner || position === Pos.vanguard) {
                        storm = player.storm(args, position);
                    } else {
                        storm = player.storm(args);
                    }

                    if (storm) {
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

    useAction = async (cardId: string, args?: RawRequirementArgs) => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();
            const card = await BattleService.getCardById(cardId);

            if (match && card && this.isPlayerOnTurn(match)) {
                const player = match.battle.player(this.playerId);

                if (card.actionAbility!.requirements) {
                    card.actionAbility!.requirements!.mana = card.cost;
                } else {
                    card.actionAbility!.requirements = {};
                    card.actionAbility!.requirements.mana = card.cost;
                }

                if (player) {
                    const useAction = player.useAction(card, this.formatRequirementArgs(args))

                    if (useAction) {
                        await match.save();
                        return {
                            battle: match.battle,
                            discardForced: !!match.battle.abilities.discardRequirement
                        };
                    }
                }
            }
            return null;
        } catch (e: any) {
            console.log(e);
            return null;
        }
    }

    usePassive = async (pos: string, args?: RawRequirementArgs) => {
        try {
            const position: Pos| undefined = Pos[pos as keyof typeof Pos];
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && position && this.isPlayerOnTurn(match)) {
                const player = match.battle.player(this.playerId);
                if (player) {
                    const useAction = player.usePassive(position, this.formatRequirementArgs(args))

                    if (useAction) {
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

    advanceCards = async () => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && this.isPlayerOnTurn(match)) {
                const player = match.battle.player(this.playerId);
                if (player) {
                    const advance = player.advanceCards();

                    if (advance) {
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

            if (match && this.isPlayerOnTurn(match)) {
                const drawnCards = match.battle.player(this.playerId)?.drawCards();
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

            if (match && this.isPlayerOnTurn(match)) {
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

    moveToFrontLine = async () => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && this.isPlayerOnTurn(match)) {
                const player = match.battle.player(this.playerId);

                if (player) {
                    const move = player.moveToFrontLine();

                    if (move) {
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

    private formatRequirementArgs = (rawArgs: RawRequirementArgs | undefined): RequirementArgs | undefined => {
        if (!rawArgs) {
            return undefined;
        }

        try {
            if (rawArgs.cardToSacrifice) {
                rawArgs.cardToSacrifice = Pos[rawArgs.cardToSacrifice as keyof typeof Pos];
            }

            if (rawArgs.targetPositions?.self) {
                let selfTargets: Pos[] = [];
                rawArgs.targetPositions.self.forEach(t => {
                    const target: Pos = Pos[t as keyof typeof Pos];
                    if (target) {
                        selfTargets.push(target);
                    }
                });

                rawArgs.targetPositions.self = selfTargets;
            }

            if (rawArgs.targetPositions?.opponent) {
                let opponentTargets: Pos[] = [];
                rawArgs.targetPositions.opponent.forEach(t => {
                    const target: Pos = Pos[t as keyof typeof Pos];
                    if (target) {
                        opponentTargets.push(target);
                    }
                });

                rawArgs.targetPositions.opponent = opponentTargets;
            }

            if (rawArgs.nestedArgs) {
                rawArgs.nestedArgs = this.formatRequirementArgs(rawArgs.nestedArgs);
            }

            return rawArgs as RequirementArgs;
        } catch (e: any) {
            console.log(e);
            return undefined;
        }
    }

    private isPlayerOnTurn(matchDocument: any) {
        const match = matchDocument as Match;
        return  match.battle.isTurnOfPlayer(this.playerId)
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
            let match = await MatchModel.findOne(filter, "player1Id player2Id").exec();

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

    static getCardById = async (id: string): Promise<Card | null> => {
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
}

export interface RawRequirementArgs {
    cardToSacrifice?: Pos | string;
    useAsMana?: string[];
    targetPositions?: {
        self: Pos[] | string[],
        opponent: Pos[] | string[]
    },
    targetCards?: string[];
    nestedArgs?: RawRequirementArgs | RequirementArgs;
}