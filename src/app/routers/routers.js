import express from "express";
import {
  handleActivateUserAccount,
  handleAddBrandMaintainUser,
  handleCreateUser,
  handleGetCurrentUser,
  handleGetUser,
  handleGetUsers,
  handleLoginUser,
  handleRefreshToken,
  handleUpdateUserAvatar,
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
import {
  handleCreateMember,
  handleDeleteMember,
  handleEditMember,
  handleGetMembers,
  handleGetSingleMemberByMobile,
} from "../controllers/memberControllers.js";
import {
  handleCreateStaff,
  handleDeleteStaff,
  handleGetStaffs,
} from "../controllers/staffControllers.js";
import {
  handleAddSoldInvoice,
  handleGetSoldInvoiceById,
  handleGetSoldInvoices,
} from "../controllers/soldInvoiceControllers.js";
import { upload } from "../middlewares/multer.js";
import {
  handleUpdateBrandInfo,
  handleUpdateBrandLogo,
} from "../controllers/brandControllers.js";

export const apiRouter = express.Router();

//user router
apiRouter.post("/users/create-user", handleCreateUser);
apiRouter.get("/users/verify/:token", handleActivateUserAccount);
apiRouter.post("/users/auth-user-login", handleLoginUser);
apiRouter.get("/users/find-user/:id", isLoggedIn, handleGetUser);
apiRouter.get("/users/find-current-user", isLoggedIn, handleGetCurrentUser);
apiRouter.get("/users/find-users", isLoggedIn, handleGetUsers);
apiRouter.get("/users/auth-manage-token", handleRefreshToken);
apiRouter.patch(
  "/users/update-avatar/:id",
  upload.single("avatar"),
  isLoggedIn,
  handleUpdateUserAvatar
);
apiRouter.post(
  "/users/auth-create-user",
  isLoggedIn,
  handleAddBrandMaintainUser
);
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
//member route
apiRouter.post("/members/create-member", isLoggedIn, handleCreateMember);
apiRouter.get("/members/get-all", isLoggedIn, handleGetMembers);
apiRouter.get(
  "/members/member/:mobile",
  isLoggedIn,
  handleGetSingleMemberByMobile
);
apiRouter.delete("/members/delete-member", isLoggedIn, handleDeleteMember);
apiRouter.patch("/members/update-member/:id", isLoggedIn, handleEditMember);
//staff route
apiRouter.post("/staffs/create-staff", isLoggedIn, handleCreateStaff);
apiRouter.get("/staffs/get-all", isLoggedIn, handleGetStaffs);
apiRouter.delete("/staffs/delete-staff", isLoggedIn, handleDeleteStaff);
//sold-invoice route
apiRouter.post(
  "/sold-invoices/add-sold-invoice",
  isLoggedIn,
  handleAddSoldInvoice
);
apiRouter.get(
  "/sold-invoices/get-sold-invoice/:invoice_id",
  isLoggedIn,
  handleGetSoldInvoiceById
);
apiRouter.get(
  "/sold-invoices/get-sold-invoices",
  isLoggedIn,
  handleGetSoldInvoices
);

// brand route
apiRouter.patch(
  "/brands/update-brand-logo",
  upload.single("brandLogo"),
  isLoggedIn,
  handleUpdateBrandLogo
);
apiRouter.patch("/brands/update-info", isLoggedIn, handleUpdateBrandInfo);
