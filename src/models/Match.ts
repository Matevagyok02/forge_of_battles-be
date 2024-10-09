import {getModelForClass, modelOptions, prop} from "@typegoose/typegoose";
import {Battle} from "./Battle";

@modelOptions({
    schemaOptions: {
        timestamps: true
    }
})

export class Match {

    @prop({unique: true})
    readonly key!: string;

    @prop({ _id: false })
    readonly battle!: Battle;

    @prop()
    readonly randomMatch!: boolean;

    @prop()
    readonly player1Id!: string;

    @prop()
    private player2Id!: string;

    @prop()
    readonly timeLimit?: number; //milliseconds per player

    @prop()
    readonly started!: boolean;

    setPlayer2Id(player2Id: string) {
        this.player2Id = player2Id;
    }

    getPlayer2Id() {
        return this.player2Id;
    }

    constructor(key: string, randomMatch: boolean, player1Id: string, player2Id?: string, timeLimitPerPLayer?: number) {
        this.battle = new Battle(player2Id);
        this.key = key;
        this.player1Id = player1Id;
        this.player2Id = player2Id ? player2Id : "";
        this.randomMatch = randomMatch;
        this.timeLimit = timeLimitPerPLayer;
        this.started = false;
    }

}

export const MatchModel = getModelForClass(
    Match,
    {schemaOptions: {collection: 'matches'}}
);


