import {Match, MatchModel, MatchStage, setRefs} from "../models/Match";
import {Card, CardModel, Deck} from "../models/Card";
import {CardWithPieces, BattlefieldPos} from "../models/PlayerState";
import {RequirementArgs} from "../models/Abilities";
import {Battle} from "../models/Battle";
import {pubRedisClient} from "../redis";

const deleteFinishedMatchTimeout = 300000;

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

    setPlayer = async (deck: Deck, cards: CardWithPieces[]): Promise<{ matchStarted: boolean } | null> => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match) {
                match.battle.initPlayerState(this.playerId, deck, cards);
                if (match.battle.hasStarted()) {
                    match.setStage(MatchStage.started);
                }

                await match.save();

                return { matchStarted: match.battle.hasStarted() };
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

            if (match && await match.battle.startTurn(this.playerId)) {
                await match.save();
                return match.battle;
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    endTurn = async () => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && match.battle.endTurn(this.playerId)) {
                await match.save();
                return match.battle;
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    addStormerToMana = async () => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && this.isPlayerOnTurn(match)) {
                const player = setRefs(match).battle.player(this.playerId);

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
                    const player = setRefs(match).battle.player(this.playerId);
                    if (player) {
                        const deploy = await player.deploy(card, useAsMana);

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
                const discard = await setRefs(match).battle.player(this.playerId)?.discard(
                        Array.isArray(cardToDiscard) ? cardToDiscard : BattlefieldPos[cardToDiscard as keyof typeof BattlefieldPos]
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

    storm = async (posToAttack?: string, rawArgs?: RawRequirementArgs) => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();
            const args = this.formatRequirementArgs(rawArgs);

            if (match && this.isPlayerOnTurn(match)) {
                const player = setRefs(match).battle.player(this.playerId);
                if (player) {
                    let storm;

                    const position = posToAttack ? BattlefieldPos[posToAttack as keyof typeof BattlefieldPos] : null;

                    if (position && (position === BattlefieldPos.frontLiner || position === BattlefieldPos.vanguard)) {
                        storm = await player.storm(args, position);
                    } else {
                        storm = await player.storm(args);
                    }

                    if (storm) {
                        await match.save();
                        return match.battle;
                    }
                }
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    useAction = async (cardId: string, args?: RawRequirementArgs) => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();
            const card = await BattleService.getCardById(cardId);

            if (match && card && this.isPlayerOnTurn(match)) {
                const player = setRefs(match).battle.player(this.playerId);

                if (card.actionAbility!.requirements) {
                    card.actionAbility!.requirements!.mana = card.cost;
                } else {
                    card.actionAbility!.requirements = {};
                    card.actionAbility!.requirements.mana = card.cost;
                }

                if (player) {
                    const useAction = await player.useAction(card, this.formatRequirementArgs(args))

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
            const position: BattlefieldPos| undefined = BattlefieldPos[pos as keyof typeof BattlefieldPos];
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && position && this.isPlayerOnTurn(match)) {
                const player = setRefs(match).battle.player(this.playerId);
                if (player) {
                    const useAction = await player.usePassive(position, this.formatRequirementArgs(args))

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
                const player = setRefs(match).battle.player(this.playerId);
                if (player) {
                    const advance = player.advanceCards();

                    if (advance) {
                        await match.save();
                        return match.battle;
                    }
                }
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    drawCards = async (): Promise<Battle | undefined> => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();
            const player = setRefs(match).battle.player(this.playerId);

            if (match && this.isPlayerOnTurn(match) && player) {
                const drawnCards = await player.drawCards();
                await match.save();
                if (drawnCards) {
                    return match.battle;
                }
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    redrawCards = async (cardId?: string) => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && this.isPlayerOnTurn(match)) {
                const drawnCards = setRefs(match).battle.player(this.playerId)?.redrawCards(cardId);

                if (drawnCards && drawnCards.length > 0) {
                    await match.save();
                    return match.battle;
                }
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    moveToFrontLine = async () => {
        try {
            const match = await MatchModel.findOne(this.filter).exec();

            if (match && this.isPlayerOnTurn(match)) {
                const player = setRefs(match).battle.player(this.playerId);

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
                rawArgs.cardToSacrifice = BattlefieldPos[rawArgs.cardToSacrifice as keyof typeof BattlefieldPos];
            }

            if (rawArgs.targetPositions?.self) {
                let selfTargets: BattlefieldPos[] = [];
                rawArgs.targetPositions.self.forEach(t => {
                    const target: BattlefieldPos = BattlefieldPos[t as keyof typeof BattlefieldPos];
                    if (target) {
                        selfTargets.push(target);
                    }
                });

                rawArgs.targetPositions.self = selfTargets;
            }

            if (rawArgs.targetPositions?.opponent) {
                let opponentTargets: BattlefieldPos[] = [];
                rawArgs.targetPositions.opponent.forEach(t => {
                    const target: BattlefieldPos = BattlefieldPos[t as keyof typeof BattlefieldPos];
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

    finishMatch = async () => {
        try {
            const match = await MatchModel.findOne({key: this.key}).exec();

            if (match && match.isFinished()) {
                await match.save();

                setTimeout( async () => {
                    try {
                        await MatchModel.deleteOne({key: this.key}).exec();
                        await pubRedisClient.del(this.key);
                    } catch (e: any) {
                        console.log(e);
                    }
                }, deleteFinishedMatchTimeout);

                return match;
            }
        } catch (e: any) {
            console.log(e);
        }
    }
}

export interface RawRequirementArgs {
    cardToSacrifice?: BattlefieldPos | string;
    useAsMana?: string[];
    targetPositions?: {
        self: BattlefieldPos[] | string[],
        opponent: BattlefieldPos[] | string[]
    },
    targetCards?: string[];
    nestedArgs?: RawRequirementArgs | RequirementArgs;
}