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
  handleEditTable,
  handleGetTables,
} from "../controllers/tableControllers.js";
import {
  handleCreateCategory,
  handleDeleteCategory,
  handleEditCategory,
  handleGetCategories,
} from "../controllers/categoryControllers.js";
import {
  handleCreateMenuItem,
  handleDeleteMenuItem,
  handleEditMenuItem,
  handleGetMenuItems,
} from "../controllers/menuItemsControllers.js";

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
apiRouter.patch("/tables/update-table/:id", isLoggedIn, handleEditTable);
//category route
apiRouter.post("/categories/create-category", isLoggedIn, handleCreateCategory);
apiRouter.get("/categories/get-all", isLoggedIn, handleGetCategories);
apiRouter.patch(
  "/categories/update-category/:id",
  isLoggedIn,
  handleEditCategory
);
apiRouter.delete(
  "/categories/delete-category",
  isLoggedIn,
  handleDeleteCategory
);
//menu item route
apiRouter.post(
  "/menu-items/create-menu-item",
  isLoggedIn,
  handleCreateMenuItem
);
apiRouter.get("/menu-items/get-all", isLoggedIn, handleGetMenuItems);
apiRouter.delete(
  "/menu-items/delete-menu-item",
  isLoggedIn,
  handleDeleteMenuItem
);
apiRouter.patch(
  "/menu-items/update-menu-item/:id",
  isLoggedIn,
  handleEditMenuItem
);
