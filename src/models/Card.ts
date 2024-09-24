import {PassiveAbility, ActionAbility} from "./Abilities";
import {getModelForClass, prop} from "@typegoose/typegoose";

export class Card {

    @prop({required: true})
    public readonly id!: string;

    @prop({required: true})
    public readonly name!: string;

    @prop()
    public readonly deck!: string;

    @prop()
    public readonly attack!: number;

    @prop()
    public readonly defence!: number;

    @prop()
    public readonly cost!: number;

    @prop()
    public readonly passive!: PassiveAbility;

    @prop()
    public readonly action!: ActionAbility;

}

export const CardModel = getModelForClass(
    Card,
    {schemaOptions: {collection: 'cards'}}
);