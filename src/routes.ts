import {Router} from "express";
import {UserController} from "./controllers/UserController";
import {ChatController} from "./controllers/ChatController";

const router = Router();
const userController = new UserController();
const chatController = new ChatController();

enum HttpMethod {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE'
}

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
                method: HttpMethod.POST,
                func: userController.registerNewUser
            },
            {
                path: "picture",
                method: HttpMethod.PUT,
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
                method: HttpMethod.POST,
                func: userController.sendFriendRequest
            },
            {
                path: "accept",
                method: HttpMethod.PUT,
                func: userController.acceptFriendRequest
            },
            {
                path: "decline",
                method: HttpMethod.DELETE,
                func: userController.declineFriendRequest
            }
        ]
    },
    {
        path: "chat",
        endpoints: [
            {
                path: "",
                func: chatController.getMessages
            },
            {
                path: "",
                method: HttpMethod.POST,
                func: chatController.sendMessage
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
            case HttpMethod.POST:
                router.post(fullPath, func);
                break;
            case HttpMethod.PUT:
                router.put(fullPath, func);
                break;
            case HttpMethod.DELETE:
                router.delete(fullPath, func);
                break;
            default:
                router.get(fullPath, func);
                break;
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
    method?: HttpMethod;
}