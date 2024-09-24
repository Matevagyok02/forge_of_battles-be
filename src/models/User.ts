import {getModelForClass, prop} from "@typegoose/typegoose";
import {strict} from "assert";

enum ReqState {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    DECLINED = "DECLINED"
}

class Friend {

    @prop()
    public readonly username!: string;

    @prop()
    public readonly status!: string;


    constructor(username: string, status: string) {
        this.username = username;
        this.status = status;
    }
}

class FriendRequest {

    @prop()
    public readonly fromUsername!: string;

    @prop()
    public readonly createdAt!: Date;


    constructor(fromUsername: string) {
        this.fromUsername = fromUsername;
        this.createdAt = new Date();
    }
}

class UserFriends {

    @prop({ type: () => Friend, _id: false })
    public readonly friendList!: Map<string, Friend>;

    @prop({ type: () => FriendRequest, _id: false })
    public readonly requests!: Map<string, FriendRequest>;

    constructor() {
        this.friendList = new Map<string, Friend>();
        this.requests = new Map<string, FriendRequest>();
    }

    public inviteFriend(userId: string, username: string) {
        this.friendList.set(userId, new Friend(username, ReqState.PENDING));
    }

    public acceptRequest(userId: string) {
        const invite = this.requests.get(userId);

        if (invite) {
            this.friendList.set(userId, new Friend(invite.fromUsername, ReqState.ACCEPTED));
        }
    }
}

export class User{

    @prop()
    public readonly userId!: string;

    @prop()
    public readonly username!: string;

    @prop()
    private profilePicture?: string;

    @prop()
    public readonly friends?: UserFriends;

    constructor(userId: string, username: string, profilePicture?: string) {
        this.userId = userId;
        this.username = username;
        this.friends = new UserFriends();

        if (profilePicture) {
            this.profilePicture = profilePicture;
        }
    }


    getProfilePicture(): string | undefined {
        return this.profilePicture;
    }

    setProfilePicture(value: string) {
        this.profilePicture = value;
    }

    inviteFriend = (userId: string, username: string) => {
        this.friends?.inviteFriend(userId, username);
    }

    acceptRequest = (userId: string) => {
        this.friends?.acceptRequest(userId);
    }
}



export const UserModel = getModelForClass(
    User,
    {schemaOptions: {collection: 'users'}}
);