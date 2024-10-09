import {Ability, IAbility} from "./Ability";
import {getModelForClass, prop} from "@typegoose/typegoose";

export class Card {

    @prop({required: true})
    readonly id!: string;

    @prop({required: true})
    readonly name!: string;

    @prop()
    readonly deck!: Deck;

    @prop()
    readonly attack!: number;

    @prop()
    readonly defence!: number;

    @prop()
    readonly cost!: number;

    @prop({ type: Ability, _id: false })
    readonly passive!: IAbility;

    @prop({ type: Ability, _id: false })
    readonly action!: IAbility;

}

export const CardModel = getModelForClass(
    Card,
    {schemaOptions: {collection: 'cards'}}
);

export enum Deck {
    LIGHT = "light",
    SHADOW = "shadow"
}