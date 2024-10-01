import {User, UserModel} from "../models/User";
import {HydratedDocument} from "mongoose";
import {getActiveFriends} from "../notifications";
import {isUpdateSuccessful} from "../utils";

const basicParams = 'userId username profilePicture';

export class UserService {

    async changeProfilePicture(userId: string, newPicture: string) {
        try {
            const update = await UserModel.updateOne(
                {userId},
                {picture: newPicture}
            ).lean();

            return isUpdateSuccessful(update);
        } catch (error: any) {
            console.error(error);
            return false;
        }
    }

    async getActiveFriends(userId: string) {
        try {
            const friendIdList = await UserModel.findOne({userId}, 'friends').lean();
            return await getActiveFriends(friendIdList);
        } catch (error: any) {
            console.error(error);
            return null;
        }
    }

    async getUserAndFriends(userId: string){
        try {
            const user = await UserModel.findOne({userId}).lean();

            if (user) {
                const friends = await UserModel.find({userId: {$in: user.friends}}, basicParams).lean();
                return { user: user, friends: friends};
            } else
                return null;
        } catch (error: any) {
            console.error(error);
            return null;
        }
    }

    async getUserByUserId(userId: string): Promise<User | null> {
        try {
            return await UserModel.findOne({userId}, basicParams).lean();
        } catch (error: any) {
            console.error(error);
            return null;
        }
    }

    async getUserByUsername(username: string): Promise<User | null> {
        try {
            return await UserModel.findOne({username}, basicParams).lean();
        } catch (error: any) {
            console.error(error);
            return null;
        }
    }

    async insertNewUser(userId: string, username: string, profilePicture?: string) {
        try {
            const alreadyExists = await UserModel.exists({userId}).lean();

            if (!alreadyExists) {
                const newUser = new User(userId, username, profilePicture);
                await UserModel.create(newUser);
                return true;
            }
            else
                return false;
        } catch (error: any) {
            console.error(error);
            return false;
        }
    }

    async usernameInUse(username: string): Promise<boolean> {
        try {
            return !!(await UserModel.exists({username}).lean());
        } catch (error: any) {
            console.error(error);
            return true;
        }
    }

    async sendFriendRequest(fromId: string, toId: string) {
        try {
            const userIds = [fromId, toId];
            const users: User[] | null = await this.getUsersById(userIds);

            if (users) {
                const fromUser = UserModel.hydrate(users.find(user => user.userId === fromId));
                const toUser = UserModel.hydrate(users.find(user => user.userId === toId));

                if (fromUser && toUser) {
                    if (fromUser.hasRequestOrIsFriend(toId) || toUser.hasRequestOrIsFriend(fromId)) {
                        console.log(1);
                        return false;
                    } else {
                        fromUser.addOutgoingRequest(toId);
                        toUser.addIncomingRequest(fromId);

                        const save =
                            await fromUser.save() &&
                            await toUser.save()
                        ;

                        return !!save;
                    }
                } else
                    return false;
            } else
                return false;
        } catch (error: any) {
            console.error(error);
            return false;
        }
    }

    async acceptFriendRequest(senderId: string, receiverId: string) {
        try {
            const userIds = [senderId, receiverId];
            const users = await this.getUsersById(userIds);

            if (users) {
                const senderUser = UserModel.hydrate(users.find(user => user.userId === senderId));
                const receiverUser = UserModel.hydrate(users.find(user => user.userId === receiverId));

                if (senderUser && receiverUser) {
                    const remove = senderUser.removeOutgoingRequest(receiverId);
                    senderUser.addFriend(receiverId);
                    const accept = receiverUser.acceptRequest(senderId);

                    const save =
                        await senderUser.save() &&
                        await receiverUser.save();

                    return !!save && remove && accept;
                } else
                    return false;
            } else
                return false;
        } catch (error: any) {
            console.error(error);
            return true;
        }
    }

    async declineFriendRequest(senderId: string, receiverId: string) {
        try {
            const userIds = [senderId, receiverId];
            const users: User[] | null = await this.getUsersById(userIds);

            if (users && users.length > 0) {
                const senderUser = UserModel.hydrate(users.find(user => user.userId === senderId));
                const receiverUser = UserModel.hydrate(users.find(user => user.userId === receiverId));

                if (senderUser && receiverUser) {
                    const remove = senderUser.removeOutgoingRequest(receiverId);
                    const decline = receiverUser.declineRequest(senderId);

                    const save =
                        await senderUser.save() &&
                        await receiverUser.save();

                    return !!save && remove && decline;
                }
            } else
                return false;
        } catch (error: any) {
            console.error(error);
            return true;
        }
    }

    async getUsersById(userIds: string[]): Promise<HydratedDocument<User>[] |null> {
        try {
            const users: HydratedDocument<User>[] = await UserModel.find({ userId: { $in: userIds } }).exec();

            return users.length > 0 ? users : [];
        } catch (error: any) {
            console.error(error);
            return [];
        }
    }

    async areFriends(user1Id: string, user2Id: string) {
        try {
            return !! await UserModel.exists({userId: user1Id, friends: {$in: [user2Id]} }).lean();
        } catch (error: any) {
            console.error(error);
            return false;
        }
    }
}