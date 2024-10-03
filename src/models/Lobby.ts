import {getModelForClass, prop} from "@typegoose/typegoose";

class Lobby {

    @prop()
    readonly player1Id: string;

    @prop()
    readonly player2Id?: string;

    constructor(player1Id: string, player2Id: string) {
        this.player1Id = player1Id;
        this.player2Id = player2Id;
    }

}

export const LobbyModel = getModelForClass(
    Lobby,
    {schemaOptions: {collection: 'lobby'}}
);