import express from "express";
import {
  handleActivateUserAccount,
  handleCreateUser,
  handleGetUser,
  handleLoginUser,
  handleRefreshToken,
} from "../controllers/userControllers.js";
import { isLoggedIn } from "../middlewares/authUser.js";
import {
  handleCreateTable,
  handleDeleteTable,
  handleGetTables,
} from "../controllers/tableControllers.js";

export const apiRouter = express.Router();

//user router
apiRouter.post("/users/create-user", handleCreateUser);
apiRouter.get("/users/verify/:token", handleActivateUserAccount);
apiRouter.post("/users/auth-user-login", handleLoginUser);
apiRouter.get("/users/find-user/:id", isLoggedIn, handleGetUser);
apiRouter.get("/users/auth-manage-token", handleRefreshToken);
//table route
apiRouter.post("/tables/create-table", isLoggedIn, handleCreateTable);
apiRouter.get("/tables/get-all", isLoggedIn, handleGetTables);
apiRouter.delete("/tables/delete-table", isLoggedIn, handleDeleteTable);
