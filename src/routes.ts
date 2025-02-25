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

router.use(checkUserId);

const userRouter = Router();
const friendRouter = Router();
const chatRouter = Router();
const matchRouter = Router();
const cardsRouter = Router();

userRouter.get(``, userController.getUserAndFriends);
userRouter.get(`/find`, userController.getUserByUsernameOrUserId);
userRouter.post(`/register`, userController.registerNewUser);
userRouter.put(`/picture`, userController.changeUserPicture);

friendRouter.get(`/online`, friendController.getOnlineFriends);
friendRouter.post(`/request`, friendController.sendFriendRequest);
friendRouter.put(`/accept`, friendController.acceptFriendRequest);
friendRouter.delete(`/decline`, friendController.declineFriendRequest);

chatRouter.get(``, chatController.get);
chatRouter.get(`/unseen`, chatController.getUnseenMessages);
chatRouter.post(``, chatController.send);

matchRouter.get(``, matchController.getByKey);
matchRouter.get(`/active`, matchController.getActive);
matchRouter.get(`/last-created`, matchController.getLastCreated);
matchRouter.post(`/create`, matchController.create);
matchRouter.put(`/join`, matchController.join);
matchRouter.delete(`/decline`, matchController.decline);
matchRouter.delete(`/abandon`, matchController.abandon);
matchRouter.delete(`/leave`, matchController.leave);

cardsRouter.post(`/add`, cardController.add);
cardsRouter.get(``, cardController.getByIds);

router.use(`/user`, userRouter);
router.use(`/friend`, friendRouter);
router.use(`/chat`, chatRouter);
router.use(`/match`, matchRouter);
router.use(`/cards`, cardsRouter);

export default router;