import {User, UserModel} from "../models/User";
import {HydratedDocument} from "mongoose";

const basicParams = 'userId username profilePicture';
const extendedParams = 'friends requests'

export class UserService {

    async getBasicUserParams(userId: string): Promise<User | null> {
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

    async getUserFriendsAndRequests(userId: string) {
        try {
            const friendIdList = await UserModel.findOne({userId}, extendedParams).lean();

            if (friendIdList) {
                const friends= await UserModel.find({userId: {$in: friendIdList.friends} }, basicParams).exec();
                const requests = friendIdList.requests.length > 0 ? friendIdList.requests : undefined;

                return {friends: friends, requests: requests}
            }
            return null;

        } catch (error: any) {
            console.error(error);
            return null;
        }
    }

    async insertNewUser(userId: string, username: string, profilePicture?: string) {
        try {
            const alreadyExists = await UserModel.exists({userId}).exec();

            if (!alreadyExists) {
                const newUser = new User(userId, username, profilePicture);
                await UserModel.create(newUser);
                return true
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
                    if (fromUser.hasRequestOrIsFriend(fromId, toId) || toUser.hasRequestOrIsFriend(fromId, toId)) {
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

            // Return the users found, or an empty array if none found
            return users.length > 0 ? users : [];
        } catch (error: any) {
            console.error("Error fetching users: ", error);
            return [];  // Return empty array on error
        }
    }
}