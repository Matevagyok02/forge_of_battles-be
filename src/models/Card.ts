import {getModelForClass, modelOptions, prop, Severity} from "@typegoose/typegoose";
import {Ability, AttributeModifierAbility} from "./Abilities";
import {generateKey} from "../utils";

@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class Card {

    @prop({required: true})
    readonly id!: string;

    @prop({required: true})
    readonly name!: string;

    @prop()
    private tempId?: string;

    @prop()
    readonly deck!: Deck;

    @prop()
    readonly pieces!: number;

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

    addTempId() {
        this.tempId = generateKey();
    }

    modifyAttributes(ability: AttributeModifierAbility) {
        this.attack = Math.max(this.attack + ability.attack, 0);
        this.defence = Math.max(this.defence + ability.defence, 0);
    }
}

export const CardModel = getModelForClass(
    Card,
    { schemaOptions: {collection: 'cards' } }
);

export enum Deck {
    light = "light",
    darkness = "darkness",
    venom = "venom"
}