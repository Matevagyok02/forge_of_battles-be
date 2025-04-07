import {Request, Response} from "express";
import {getUserId, handleServerError} from "../middleware";
import {CardService} from "../services/CardService";
import {Deck} from "../models/Card";

export class CardController {

    private cardService: CardService;

    constructor(cardService: CardService) {
        this.cardService = cardService;
    }

    add = async(req: Request, res: Response)=>  {
        try {
            const userId = getUserId(req);
            const card: {
                name: string,
                deck: string,
                pieces: number,
                attack: number,
                defence: number,
                cost: number,
                passiveAbility: any,
                actionAbility: any
            } = req.body;

            if (userId === require("../../admin.json").adminId) {
                const created = await this.cardService.add(
                    card.name,
                    card.deck,
                    card.pieces,
                    card.attack,
                    card.defence,
                    card.cost,
                    card.passiveAbility,
                    card.actionAbility
                );

                if (created) {
                    res.status(200).json({ message: "Card inserted" });
                } else {
                    res.status(500).json({ message: "An error occurred while inserting the card" });
                }
            } else {
                res.status(401).json({ message: "Unauthorized" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }

    getByIds = async(req: Request, res: Response)=>  {
        try {
            const cardsQueryString = req.query.cards;
            const deckQueryString = req.query.deck;

            if (deckQueryString && Object.keys(Deck).includes(deckQueryString as string)) {
                const cards = await this.cardService.getByDeck(deckQueryString as string);
                res.json(cards);
            } else
                if (cardsQueryString && Array.isArray((cardsQueryString as string).split(","))) {
                    const cardIds = (cardsQueryString as string).split(",");
                    const cards = await this.cardService.getByIds(cardIds);
                    res.json(cards);
            } else {
                res.status(400).json({ message: "Search params are missing or have been malformed" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }
}