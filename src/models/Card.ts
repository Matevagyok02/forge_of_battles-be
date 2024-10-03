import {IAbility} from "./Ability";
import {getModelForClass, prop} from "@typegoose/typegoose";

export class Card {

    @prop({required: true})
    readonly id!: string;

    @prop({required: true})
    readonly name!: string;

    @prop()
    readonly deck!: string;

    @prop()
    readonly attack!: number;

    @prop()
    readonly defence!: number;

    @prop()
    readonly cost!: number;

    @prop()
    readonly passive!: IAbility;

    @prop()
    readonly action!: IAbility;

}

export const CardModel = getModelForClass(
    Card,
    {schemaOptions: {collection: 'cards'}}
);