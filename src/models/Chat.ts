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

export class ChatUser {

    @prop()
    readonly userId!: string;

    @prop()
    readonly lastSeenAt?: Date;

    constructor(userId: string, active: boolean) {
        this.userId = userId;
        this.lastSeenAt = active ? new Date() : undefined;
    }
}

export class Chat {

    @prop({ type: [ChatUser], _id: false })
    readonly users!: ChatUser[];

    @prop({type: [Message], _id: false})
    readonly messages!: Message[];

}

export const ChatModel = getModelForClass(
    Chat,
    {schemaOptions: {collection: 'chat'}}
);