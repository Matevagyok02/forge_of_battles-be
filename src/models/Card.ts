import {Ability} from "./Ability";
import {getModelForClass, modelOptions, prop, Severity} from "@typegoose/typegoose";
import {Effect} from "./Effect";

@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class Card {

    @prop({required: true})
    readonly id!: string;

    @prop({required: true})
    readonly name!: string;

    @prop()
    readonly deck!: Deck;

    @prop()
    attack!: number;

    @prop()
    defence!: number;

    @prop()
    cost!: number;

    @prop({ _id: false })
    readonly passiveEffect!: Effect ;

    @prop({ _id: false })
    readonly actionAbility!: Ability;
}

export const CardModel = getModelForClass(
    Card,
    { schemaOptions: {collection: 'cards' } }
);

export enum Deck {
    LIGHT = "light",
    SHADOW = "shadow"
}