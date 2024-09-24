import {prop} from "@typegoose/typegoose";

export interface Ability {
    readonly group: string,
    readonly description: string,
    readonly selectableTarget: boolean,
    readonly targets: string[],
    readonly cost?: number
}

export class ActionAbility implements Ability {

    @prop()
    public readonly description!: string;

    @prop()
    public readonly group!: string;

    @prop()
    public readonly selectableTarget!: boolean;

    @prop({type: [String]})
    public readonly targets!: string[];

}

export class PassiveAbility implements Ability {

    @prop()
    public readonly cost!: number;

    @prop()
    public readonly description!: string;

    @prop()
    public readonly group!: string;

    @prop()
    public readonly selectableTarget!: boolean;

    @prop({type: [String]})
    public readonly targets!: string[];
}