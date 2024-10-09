import {prop} from "@typegoose/typegoose";
import {Battle} from "./Battle";

export interface IAbility {
    description: string;
    selectableTarget: boolean;
    targets: string[];
    cost?: number;
    useAbility(): Battle | null;
}

 export abstract class Ability implements IAbility{

    @prop()
    readonly description!: string;

    @prop()
    readonly selectableTarget!: boolean;

    @prop({type: [String]})
    readonly targets!: string[];

    @prop()
    readonly cost?: number;

    abstract useAbility(): Battle | null;
}

export class Kill extends Ability {
    useAbility(): Battle | null {
        return null;
    }
}