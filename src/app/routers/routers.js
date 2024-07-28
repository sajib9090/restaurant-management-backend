import express from "express";
import {
  handleActivateUserAccount,
  handleAddBrandMaintainUser,
  handleChangeOwnPassword,
  handleChangeRoleAndPasswordByAuthority,
  handleCreateUser,
  handleDeleteUsers,
  handleGetCurrentUser,
  handleGetUser,
  handleGetUsers,
  handleLoginUser,
  handleLogoutUser,
  handleRefreshToken,
  handleUpdateUserAvatar,
  handleUpdateUserNameAndMobile,
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
  handleGetStaffSellRecord,
  handleGetStaffs,
} from "../controllers/staffControllers.js";
import {
  handleAddSoldInvoice,
  handleGetSoldInvoiceById,
  handleGetSoldInvoices,
} from "../controllers/soldInvoiceControllers.js";
import { upload } from "../middlewares/multer.js";
import {
  handleGetAllBrands,
  handleGetCurrentUserBrand,
  handleUpdateBrandInfo,
  handleUpdateBrandLogo,
} from "../controllers/brandControllers.js";
import {
  handleAddPlan,
  handleGetPlan,
  handleGetPlans,
  handlePurchasePlan,
} from "../controllers/planController.js";
import { verifySubscription } from "../middlewares/subscription.js";
import {
  handleAddSupplier,
  handleGetSuppliers,
} from "../controllers/supplierController.js";
// import { handleCreateBkashPayment } from "../controllers/bkashController.js";
// import axios from "axios";
// import { bkashBaseUrl } from "../helpers/bkashBaseUrl.js";

export const apiRouter = express.Router();

//user router
apiRouter.post("/users/create-user", handleCreateUser);
apiRouter.get("/users/verify/:token", handleActivateUserAccount);
apiRouter.post("/users/auth-user-login", handleLoginUser);
apiRouter.post("/users/auth-user-logout", handleLogoutUser);
apiRouter.get("/users/find-user/:id", isLoggedIn, handleGetUser);
apiRouter.post("/users/find-current-user", isLoggedIn, handleGetCurrentUser);
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
apiRouter.patch(
  "/users/update-user-info",
  isLoggedIn,
  handleUpdateUserNameAndMobile
);
apiRouter.delete("/users/delete-user/:id", isLoggedIn, handleDeleteUsers);
apiRouter.patch(
  "/users/change-own-password",
  isLoggedIn,
  handleChangeOwnPassword
);
apiRouter.patch(
  "/users/change-user-credentials-by-authority/:id",
  isLoggedIn,
  handleChangeRoleAndPasswordByAuthority
);
//table route
apiRouter.post("/tables/create-table", isLoggedIn, handleCreateTable);
apiRouter.get(
  "/tables/get-all",
  isLoggedIn,
  verifySubscription,
  handleGetTables
);
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
apiRouter.get(
  "/staffs/sell-record/:month",
  isLoggedIn,
  handleGetStaffSellRecord
);
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
apiRouter.get("/brands/current-brand", isLoggedIn, handleGetCurrentUserBrand);
apiRouter.get("/brands/get-all", isLoggedIn, handleGetAllBrands);

// plan route
apiRouter.post("/plans/create-plan", isLoggedIn, handleAddPlan);
apiRouter.get("/plans/get-all", handleGetPlans);
apiRouter.get("/plans/get/:id", handleGetPlan);
apiRouter.post("/plans/purchase-plan", isLoggedIn, handlePurchasePlan);

// supplier route
apiRouter.post("/suppliers/add-supplier", isLoggedIn, handleAddSupplier);
apiRouter.get("/suppliers/get-all", isLoggedIn, handleGetSuppliers);

// bkash
// const bkashCredentials = {
//   username: "sandboxTokenizedUser02",
//   password: "sandboxTokenizedUser02@12345",
//   app_key: "4f6o0cjiki2rfm34kfdadl1eqq",
//   app_secret: "2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b",
// };

// let grantToken = "";
// // Middleware to obtain an access token
// const obtainTokenMiddleware = async (req, res, next) => {
//   try {
//     const tokenResponse = await axios.post(
//       `https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant`,
//       {},
//       {
//         headers: {
//           username: bkashCredentials.username,
//           password: bkashCredentials.password,
//         },
//         auth: {
//           username: bkashCredentials.app_key,
//           password: bkashCredentials.app_secret,
//         },
//       }
//     );

//     console.log(tokenResponse?.data);
//     accessToken = tokenResponse.data.id_token;
//     next();
//   } catch (error) {
//     res.status(500).json({ error: "Error obtaining token" });
//   }
// };

// console.log(grantToken);
// apiRouter.post(
//   "/bkash/payment/create",
//   isLoggedIn,
//   obtainTokenMiddleware,
//   handleCreateBkashPayment
// );
