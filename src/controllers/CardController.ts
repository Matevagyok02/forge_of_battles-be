import {Request, Response} from "express";
import {getUserId, handleServerError} from "../middleware";
import {CardService} from "../services/CardService";

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
            const cardsQueryString = req.query.cards as string;
            const cardIds = cardsQueryString ? cardsQueryString.split(",") : [];


            if (Array.isArray(cardIds) && cardIds.length > 0) {
                const cards = await this.cardService.getByIds(cardIds);

                if (cards && cards.length > 0) {
                    res.status(200).json(cards);
                } else {
                    res.status(404).json({ message: "Cards not found" });
                }
            } else {
                res.status(400).json({ message: "Invalid card ids" });
            }
        } catch (e: any) {
            handleServerError(e, res);
        }
    }
}