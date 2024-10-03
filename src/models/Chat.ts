import {getModelForClass, prop} from "@typegoose/typegoose";

export class Message {

    @prop()
    readonly senderId!: string;

    @prop()
    readonly messageText!: string;

    @prop()
    readonly createdAt!: Date;

    constructor(senderId: string, messageText: string) {
        this.senderId = senderId;
        this.messageText = messageText;
        this.createdAt = new Date();
    }
}

export class Chat {

    @prop()
    readonly user1Id!: string;

    @prop()
    readonly user2Id!: string;

    @prop({type: [Message], _id: false})
    readonly messages!: Message[];

    constructor(user1Id: string, user2Id: string) {
        this.user1Id = user1Id;
        this.user2Id = user2Id;
        this.messages = [];
    }

    addMessage(sender: string, message: string) {
        this.messages.push(new Message(sender, message));
    }
}

export const ChatModel = getModelForClass(
    Chat,
    {schemaOptions: {collection: 'chat'}}
);