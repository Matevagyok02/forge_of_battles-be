import {Router} from "express";
import {UserController} from "./controllers/UserController";
import {ChatController} from "./controllers/ChatController";
import {MatchController} from "./controllers/MatchController";
import {FriendController} from "./controllers/FriendController";
import {checkUserId} from "./middleware";
import {UserService} from "./services/UserService";
import {FriendService} from "./services/FriendService";
import {MatchService} from "./services/MatchService";
import {ChatService} from "./services/ChatService";
import NotificationService from "./services/NotificationService";
import {CardController} from "./controllers/CardController";
import {CardService} from "./services/CardService";
import {auth} from "express-oauth2-jwt-bearer";

const router = Router();
const userService = new UserService();
const friendService = new FriendService();
const matchService = new MatchService();
const chatService = new ChatService();
const notificationService = new NotificationService();
const cardService = new CardService();

const userController = new UserController(userService);
const friendController = new FriendController(friendService, notificationService);
const matchController = new MatchController(matchService, userService, notificationService);
const chatController = new ChatController(chatService, notificationService);
const cardController = new CardController(cardService);

const userRouter = Router();
const friendRouter = Router();
const chatRouter = Router();
const matchRouter = Router();

userRouter.get(``, userController.getUserAndFriends);
userRouter.get(`/usernames`, userController.getAllUsernames);
userRouter.get(`/find`, userController.getUserByUsernameOrUserId);
userRouter.post(`/register`, userController.registerUser);
userRouter.put(`/picture`, userController.changeUserPicture);

friendRouter.get(`/online`, friendController.getOnlineFriends);
friendRouter.post(`/request`, friendController.sendFriendRequest);
friendRouter.put(`/accept`, friendController.acceptFriendRequest);
friendRouter.delete(`/decline`, friendController.declineFriendRequest);

chatRouter.get(``, chatController.get);
chatRouter.get(`/unseen`, chatController.getUnseenMessages);
chatRouter.post(``, chatController.send);

matchRouter.get(``, matchController.getByKey);
matchRouter.get(`/active`, matchController.getMatches);
matchRouter.post(`/create`, matchController.create);
matchRouter.put(`/join`, matchController.join);
matchRouter.delete(`/decline`, matchController.decline);
matchRouter.delete(`/abandon`, matchController.abandon);
matchRouter.delete(`/leave`, matchController.leave);
matchRouter.put(`/random`, matchController.joinRandom);
matchRouter.delete(`/leave-random`, matchController.leaveRandom);
matchRouter.get(`/is-abandoned`, matchController.isAbandoned);

const authConfig = require("../auth-config.json");
const requiresAuth = auth(authConfig);

router.use(`/user`, requiresAuth, checkUserId, userRouter);
router.use(`/friend`, requiresAuth, checkUserId, friendRouter);
router.use(`/chat`, requiresAuth, checkUserId, chatRouter);
router.use(`/match`, requiresAuth, checkUserId, matchRouter);
router.post(`cards/add`, requiresAuth, checkUserId, cardController.add);
router.get(`/cards`, cardController.getByIds);

export default router;