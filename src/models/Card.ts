import {getModelForClass, modelOptions, prop, Severity} from "@typegoose/typegoose";
import {Ability} from "./Abilities";

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
    readonly passiveAbility!: Ability ;

    @prop({ _id: false })
    actionAbility?: Ability;
}

export const CardModel = getModelForClass(
    Card,
    { schemaOptions: {collection: 'cards' } }
);

export enum Deck {
    light = "light",
    shadow = "shadow"
}