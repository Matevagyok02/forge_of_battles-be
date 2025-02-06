import {IAbility} from "../models/Abilities";
import {CardModel, Deck} from "../models/Card";

const cardIdSeparator = '-';

export class CardService {

    async add(
        name: string,
        deck: string,
        pieces: number,
        attack: number,
        defence: number,
        cost: number,
        passiveAbility: IAbility,
        actionAbility: IAbility
    ): Promise<boolean> {
        try {
            const nextIdNumber = await this.getLastIdFromDeck(deck as Deck) + 1;

            if (nextIdNumber < 1 || nextIdNumber > 999) {
                return false;
            }

            const id = deck + cardIdSeparator + nextIdNumber;
            passiveAbility.cardId = id;
            actionAbility.cardId = id;

            await CardModel.create({
                id: id,
                name: name,
                deck: deck,
                pieces: pieces,
                attack: attack,
                defence: defence,
                cost: cost,
                passiveAbility: passiveAbility,
                actionAbility: actionAbility
            });
            return true;
        } catch (e: any) {
            console.error(e);
            return false;
        }
    }

    async getLastIdFromDeck(deck: Deck): Promise<number> {
        try {
            const cards = await CardModel.find({ deck: deck }).select('id').lean().exec();
            const ids = cards.map(card => parseInt(card.id.split(cardIdSeparator)[1], 10));
            return ids.length > 0 ? Math.max(...ids) : 0;
        } catch (e: any) {
            console.error(e);
            return -1;
        }
    }

    async getAllFromDeck(deck: Deck) {
        try {
            return await CardModel.find({ deck: deck }).select(['id', 'pieces']).lean().exec();
        } catch (e: any) {
            console.error(e);
            return [];
        }
    }

    async getByIds(ids: string[]) {
        try {
            return await CardModel.find({ id: { $in: ids } }).lean().exec();
        } catch (e: any) {
            console.error(e);
            return [];
        }
    }
}