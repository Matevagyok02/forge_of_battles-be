import {User, UserModel} from "../models/User";
import {HydratedDocument} from "mongoose";
import {busyStatusIndicator, pubRedisClient} from "../redis";

export class FriendService {

    async sendFriendRequest(fromId: string, toId: string) {
        try {
            const userIds = [fromId, toId];
            const users: User[] | null = await this.getUsersById(userIds);

            if (users) {
                const fromUser = UserModel.hydrate(users.find(user => user.userId === fromId));
                const toUser = UserModel.hydrate(users.find(user => user.userId === toId));

                if (fromUser && toUser) {
                    if (fromUser.hasRequestOrIsFriend(toId) || toUser.hasRequestOrIsFriend(fromId)) {
                        return false;
                    } else {
                        fromUser.addOutgoingRequest({
                            userId: toUser.userId,
                            username: toUser.username,
                            picture: toUser.picture
                        });
                        toUser.addIncomingRequest({
                            userId: fromUser.userId,
                            username: fromUser.username,
                            picture: fromUser.picture
                        });

                        const save =
                            await fromUser.save() &&
                            await toUser.save()
                        ;
                        if (!!save) {
                            return {userId: fromId, username: fromUser.username, picture: fromUser.picture};
                        }
                    }
                } else
                    return null;
            } else
                return null;
        } catch (error: any) {
            console.error(error);
            return null;
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

                    if (!!save && remove && accept) {
                        return users.find(user => user.userId === receiverId);
                    }
                } else
                    return null;
            } else
                return null;
        } catch (error: any) {
            console.error(error);
            return null;
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

                    if (!!save && remove && decline) {
                        return users.find(user => user.userId === receiverId);
                    }
                }
            } else
                return null;
        } catch (error: any) {
            console.error(error);
            return null;
        }
    }

    async getOnlineFriends(userId: string) {
        const onlineFriends: { userId: string, busy: boolean }[] = [];

        try {
            const friendIdList = await UserModel.findOne({userId}, 'friends').lean();
            const friends = friendIdList?.friends;

            if (friends) {
                const activeValues = await pubRedisClient.mget(friends);
                friends?.forEach((friend: string, index: number) => {
                    if (activeValues[index] !== null) {
                        const busy = activeValues[index] === busyStatusIndicator;
                        onlineFriends.push({userId: friend, busy: busy});
                    }
                });
            }

            return onlineFriends;
        } catch (error: any) {
            console.error(error);
            return onlineFriends;
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
}