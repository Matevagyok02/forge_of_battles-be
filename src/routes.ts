import {Router} from "express";
import {UserController} from "./controllers/UserController";

const router = Router();
const userController = new UserController();

const routes: Route[] = [
    {
        path: "user",
        endpoints: [
            {
               path: "",
               func: userController.getUserAndFriends
            },
            {
                path: "find",
                func: userController.getUserByUsernameOrUserId
            },
            {
                path: "register",
                method: "POST",
                func: userController.registerNewUser
            },
            {
                path: "picture",
                method: "PUT",
                func: userController.changeUserPicture
            }
        ]
    },
    {
        path: "friend",
        endpoints: [
            {
                path: "online",
                func: userController.getActiveFriends
            },
            {
                path: "request",
                method: "POST",
                func: userController.sendFriendRequest
            },
            {
                path: "accept",
                method: "PUT",
                func: userController.acceptFriendRequest
            },
            {
                path: "decline",
                method: "DELETE",
                func: userController.declineFriendRequest
            }
        ]
    }
];

//sets up all routes
routes.forEach(entry => {
    const path = entry.path;

    entry.endpoints.forEach(endpoint => {
        const fullPath = `/${path}/${endpoint.path}`;
        const func = endpoint.func;
        const method = endpoint.method;

        switch (method) {
            case "POST":
                router.post(fullPath, func);
                break;
            case "PUT":
                router.put(fullPath, func);
                break;
            case "DELETE":
                router.delete(fullPath, func);
                break;
            default:
                router.get(fullPath, func);
        }
    })
})

export default router;

interface Route {
    path: string;
    endpoints: Endpoint[];
}

interface Endpoint {
    path: string;
    func: any;
    method?: string;
}