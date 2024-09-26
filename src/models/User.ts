import {getModelForClass, prop} from "@typegoose/typegoose";

class FriendRequest {

    @prop()
    public fromId!: string;

    @prop()
    public toId!: string;

    @prop()
    public createdAt!: Date;

    constructor(fromId: string, toId: string) {
        this.fromId = fromId;
        this.toId = toId;
        this.createdAt = new Date();
    }
}

export class User{

    @prop({required: true, unique: true})
    public userId!: string;

    @prop({required: true, unique: true})
    public username!: string;

    @prop()
    private picture?: string;

    @prop({type: [String]})
    public friends!: string[];

    @prop({type: [FriendRequest]})
    public requests!: FriendRequest[];

    constructor(userId: string, username: string, profilePicture?: string) {
        this.userId = userId;
        this.username = username;
        this.picture = profilePicture;
        this.friends = [];
        this.requests = [];
    }

    hasRequestOrIsFriend(user1Id: string, user2Id: string) {
        const hasRequest = this.requests.findIndex((req: FriendRequest) =>
            req.fromId === user1Id && req.toId === user2Id ||
            req.toId === user1Id && req.fromId === user2Id
        ) === -1;

        const isFriend =
            this.friends.indexOf(user1Id) === -1 &&
            this.friends.indexOf(user2Id) === -1;

        return hasRequest || isFriend;
    }

    removeOutgoingRequest(toId: string) {
        if (toId === this.userId)
            return false;
        else {
            const requestIndex = this.requests.findIndex((req: FriendRequest) => req.toId === toId);

            if (requestIndex !== -1) {
                this.requests.splice(requestIndex, 1);
                return true;
            } else
                return false;
        }
    }

    addFriend(friendId: string) {
        if (this.friends.indexOf(friendId) > -1) {
            this.friends.push(friendId);
        }
    }

    addIncomingRequest(fromId: string) {
        this.requests?.push(new FriendRequest(fromId, this.userId));
    }

    addOutgoingRequest(toId: string) {
        this.requests?.push(new FriendRequest(this.userId, toId));
    }

    acceptRequest(fromId: string): boolean {
        if (this.requests) {
            const requestIndex = this.requests.findIndex((req: FriendRequest) => req.fromId === fromId);

            if (requestIndex !== -1 && this.friends.indexOf(fromId) === -1) {
                this.friends.push(this.requests[requestIndex].fromId);
                this.requests.splice(requestIndex, 1);
                return true;
            }
            return false;
        }
        return false;
    }

    declineRequest(fromId: string): boolean {
        if (this.requests) {
            const requestIndex = this.requests.findIndex((req: FriendRequest) => req.fromId === fromId);

            if (requestIndex !== -1) {
                this.requests.splice(requestIndex, 1);
                return true;
            }
            return false
        }
        return false;
    }
}

export const UserModel = getModelForClass(
    User,
    {schemaOptions: {collection: 'users'}}
);