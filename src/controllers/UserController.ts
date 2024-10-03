import {UserService} from "../services/UserService";
import {Request, Response} from "express";
import {getUserId, handleServerError} from "../utils";
import {friendRequest, NotificationType} from "../notifications";

const userService = new UserService();

interface UserCreationData {
    username: string;
    profilePicture?: string;
}

export class UserController {

    async getActiveFriends(req: Request, res: Response) {
        try {
            const userId = getUserId(req);

            if (userId) {
                const activeFriends = await userService.getActiveFriends(userId);
                res.status(200).json({activeFriends: activeFriends});
            } else {
                res.status(401);
            }
        } catch (error: any) {
            handleServerError(error, res);
        }
    }

    async changeUserPicture(req: Request, res: Response) {
        try {
            const userId = getUserId(req);
            const newPicture = req.query.id;

            if (typeof userId === "string" && typeof newPicture === "string") {
                await userService.changeProfilePicture(userId, newPicture);
                res.status(200).json({ message: 'Profile picture was changed successfully' });
            } else {
                res.status(400).json({ message: 'Some of the required parameters are missing' });
            }
        } catch (error: any) {
            handleServerError(error, res);
        }
    }

    async getUserAndFriends(req: Request, res: Response) {
        try {
            const userId = getUserId(req);

            if (typeof userId === "string") {
                const user = await userService.getUserAndFriends(userId);

                if (user)
                    res.json(user);
                else
                    res.status(404).json({ message: "The user was not found"});
            } else {
                res.status(400).json({ message: "Missing user id"});
            }
        } catch (error: any) {
            handleServerError(error, res);
        }
    }

    async getUserByUsernameOrUserId(req: Request, res: Response) {
        try {
            const username = req.query.username;
            const userId = req.query.id;
            let user;

                if (typeof username === "string" ) {
                    user = await userService.getUserByUsername(username);
                } else if (typeof userId === "string") {
                    user = await userService.getUserByUserId(userId);
                } else {
                    res.status(400).json({ message: 'Missing search parameter'});
                    return;
                }

                if (user) {
                    res.json(user);
                } else {
                    res.status(404).json({ message: `The user was not found`})
                }
        } catch (error: any) {
            handleServerError(error, res);
        }
    }

    async registerNewUser(req: Request, res: Response) {
        try {
            const user: UserCreationData = await req.body;
            const userId = getUserId(req);

            if (user.username && userId) {
                const usernameTaken = await userService.usernameInUse(user.username)

                if (!usernameTaken) {
                    const userInsert = await userService.insertNewUser(userId, user.username, user.profilePicture);
                    if (userInsert) {
                        res.status(201).json({ message: 'User successfully registered' });
                    } else {
                        res.status(409).json({ message: 'This user already has an account' });
                    }
                } else {
                    res.status(409).json({ message: 'This username is already taken' });
                }
            } else {
               res.status(400).json({ message: 'Some of the required parameters are missing' });
           }
        } catch (error: any) {
            handleServerError(error, res);
        }
    }

    async sendFriendRequest(req: Request, res: Response) {
        try {
            const toId = req.query.to;
            const fromId = getUserId(req);

            if (typeof toId === "string" && toId && fromId) {
                if (toId === fromId) {
                    res.status(409).json({message: "You cannot send a friend request to yourself :("});
                } else {
                    const execute = await userService.sendFriendRequest(fromId, toId);

                    if (execute) {
                        res.status(201).json({message: "The request was successfully sent"});
                        await friendRequest(toId, fromId, NotificationType.Received);
                    } else
                        res.status(409).json({message: "The user you want to invite is already your friend or a friend request has been issued between you"});
                }
            } else
                res.status(400).json({ message: "Required request params are missing"});
        } catch (error: any) {
            handleServerError(error, res);
        }
    }

    async acceptFriendRequest(req: Request, res: Response) {
        try {
            const toId = getUserId(req);
            const fromId = req.query.from;

            if (typeof fromId === "string" && toId && fromId) {
                const execute = await userService.acceptFriendRequest(fromId, toId);

                if (execute) {
                    res.status(201).json({ message: "The request was successfully accepted"});
                    await friendRequest(toId, fromId, NotificationType.Accepted);
                } else
                    res.status(409).json({ message: "The request from this user was not found"});
            } else
                res.status(400).json({ message: "Required request params are missing"});
        } catch (error: any) {
            handleServerError(error, res);
        }
    }

    async declineFriendRequest(req: Request, res: Response) {
        try {
            const toId = getUserId(req);
            const fromId = req.query.from;

            if (typeof fromId === "string" && toId && fromId) {
                const execute = await userService.declineFriendRequest(fromId, toId);

                if (execute) {
                    res.status(201).json({ message: "The request was successfully declined"});
                    await friendRequest(toId, fromId, NotificationType.Declined);
                } else
                    res.status(409).json({ message: "The request from this user was not found"});
            } else
                res.status(400).json({ message: "Required request params are missing"});
        } catch (error: any) {
            handleServerError(error, res);
        }
    }
}