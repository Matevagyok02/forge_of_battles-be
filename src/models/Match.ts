import {getModelForClass, modelOptions, prop} from "@typegoose/typegoose";
import {Battle} from "./Battle";

export enum MatchStage {
    pending = "pending",
    preparing = "preparing",
    started = "started"
}

@modelOptions({ schemaOptions: { timestamps: true } })
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
    private stage!: MatchStage;

    @prop({ _id: false })
    readonly updatedAt!: Date;

    setPlayer2Id(player2Id: string) {
        this.battle.setTurnOfPlayer(player2Id);
        this.player2Id = player2Id;
    }

    getPlayer2Id() {
        return this.player2Id;
    }

    getMatchStage() {
        return this.stage;
    }

    setStage(stage: MatchStage) {
        this.stage = stage;
    }

    constructor(key: string, randomMatch: boolean, player1Id: string, player2Id?: string, timeLimit?: number) {
        this.battle = new Battle(player2Id, timeLimit);
        this.key = key;
        this.player1Id = player1Id;
        this.player2Id = player2Id ? player2Id : "";
        this.randomMatch = randomMatch;
        this.stage = MatchStage.pending;
    }
}

export const MatchModel = getModelForClass(
    Match,
    {schemaOptions: {collection: 'matches'}}
);

export const setRefs = (matchDoc: any) => {
    const match = matchDoc as unknown as Match;
    match.battle.setRefProps();
    return match;
}
