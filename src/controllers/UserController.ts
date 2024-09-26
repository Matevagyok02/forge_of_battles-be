import {UserService} from "../services/UserService";
import {Request, Response} from "express";
import {getUserId, handleServerError} from "../utils";

const userService = new UserService();

interface UserCreationData {
    username: string;
    profilePicture?: string;
}

export class UserController {

    async getUser(req: Request, res: Response) {
        try {
            const queryId = req.query?.id && typeof req.query.id === "string" ? req.query.id : null;

            const userId: string | undefined = queryId ? queryId : getUserId(req);

            if (!userId) {
                res.status(400).json({ message: 'Missing user ID' });
            } else {
                const user = await userService.getBasicUserParams(userId);

                if (user) {
                    res.status(200).json(user);
                } else {
                    res.status(404).json({ message: 'User not found' });
                }
            }
        } catch (error: any) {
            handleServerError(error, res);
        }
    }

    async getUserByUsername(req: Request, res: Response) {
        try {
            const username = req.query.username;

            if (typeof username === "string") {
                const user = await userService.getUserByUsername(username);

                if (user) {
                    res.json(user);
                } else {
                    res.status(404).json({ message: `The user was not found`})
                }
            } else {
                res.status(403).json({ message: 'Missing search param'});
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

    async getUserFriends(req: Request, res: Response) {
        try {
            const userId = req.auth?.payload.sub;

            if (!userId) {
                res.status(401);
            } else {
                const data = await userService.getUserFriendsAndRequests(userId);

                if (data?.friends || data?.requests)
                    res.json(data);
                else
                    res.status(204);
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
                const execute = await userService.sendFriendRequest(fromId, toId);

                if (execute) {
                    res.status(201).json({ message: "The request was successfully sent"});
                } else
                    res.status(409).json({ message: "The user you want to invite is already your friend or a friend request has been issued between you"});
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
                } else
                    res.status(409).json({ message: "The request from this user was not found"});
            } else
                res.status(400).json({ message: "Required request params are missing"});
        } catch (error: any) {
            handleServerError(error, res);
        }
    }
}